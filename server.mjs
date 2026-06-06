// GitHub 爆款雷达 — 本地常驻 Web 服务(Node 版,用于 launchd 开机自启)
// 启动: node server.mjs   端口默认 8788
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = join(HERE, 'snapshot.json');
const PORT = Number(process.env.RADAR_PORT || 8788);
const HOST = '127.0.0.1';
const GH = '/opt/homebrew/bin/gh';

const TRACKS = {
  'AI / LLM': ['topic:llm', 'topic:large-language-models', 'topic:ai',
    'topic:artificial-intelligence', 'topic:generative-ai', 'topic:rag'],
  'Agent / MCP': ['topic:mcp', 'topic:model-context-protocol', 'topic:ai-agent',
    'topic:agent', 'topic:autonomous-agents', 'topic:agents'],
  '自媒体 / 内容工具': ['topic:social-media', 'topic:content-creation', 'topic:twitter',
    'topic:automation', 'topic:video-generation', 'topic:tiktok'],
  '出海 / 独立开发': ['topic:saas', 'topic:boilerplate', 'topic:nextjs', 'topic:indie',
    'topic:starter-kit', 'topic:micro-saas'],
};

async function ghSearch(query) {
  try {
    const { stdout } = await execFileP(GH, ['api', '-X', 'GET', 'search/repositories',
      '-f', `q=${query}`, '-f', 'sort=stars', '-f', 'order=desc', '-f', 'per_page=30'],
      { timeout: 30000, maxBuffer: 1024 * 1024 * 10 });
    return JSON.parse(stdout).items || [];
  } catch (e) {
    process.stderr.write(`[warn] 查询失败: ${query} -> ${String(e.message).slice(0, 160)}\n`);
    return [];
  }
}

function ageDays(createdAt) {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(ms / 86400000, 0.5);
}

async function loadSnapshot() {
  if (!existsSync(SNAPSHOT)) return {};
  try { return JSON.parse(await readFile(SNAPSHOT, 'utf-8')); } catch { return {}; }
}

async function saveSnapshot(repos) {
  const data = {};
  const ts = new Date().toISOString();
  for (const r of repos) data[r.full_name] = { stars: r.stargazers_count, ts };
  await writeFile(SNAPSHOT, JSON.stringify(data, null, 2), 'utf-8');
}

// 基线最短刷新间隔:连续点扫描时,不会反复覆盖快照,始终拿这个时长之前的基线来比
const BASELINE_MIN_HOURS = 6;

function baselineTsOf(snap) {
  for (const v of Object.values(snap)) if (v && v.ts) return v.ts;
  return null;
}
function humanAge(ms) {
  if (ms == null) return null;
  const h = ms / 3600000;
  if (h < 1) return `${Math.round(h * 60)} 分钟前`;
  if (h < 24) return `${Math.round(h)} 小时前`;
  return `${Math.round(h / 24)} 天前`;
}

async function scan({ days = 90, minStars = 50, top = 10, track = null, noSave = false }) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const qualifier = `created:>${since} stars:>=${minStars}`;
  const prev = await loadSnapshot();
  const baseTs = baselineTsOf(prev);
  const baseAgeMs = baseTs ? Date.now() - new Date(baseTs).getTime() : null;
  // 距上次基线 ≥ BASELINE_MIN_HOURS 才更新基线;否则连点也拿老基线比,delta 才有意义
  const shouldRefresh = !baseTs || baseAgeMs >= BASELINE_MIN_HOURS * 3600000;
  const tracks = Object.entries(TRACKS)
    .filter(([k]) => !track || k.toLowerCase().includes(track.toLowerCase()));

  const resultTracks = [];
  const allSeen = {};
  for (const [tname, terms] of tracks) {
    const merged = {};
    for (const term of terms) {
      for (const r of await ghSearch(`${term} ${qualifier}`)) merged[r.full_name] = r;
    }
    const rows = Object.values(merged).map(r => {
      const d = ageDays(r.created_at);
      const p = prev[r.full_name];
      const diff = p ? r.stargazers_count - p.stars : 0;
      allSeen[r.full_name] = r;
      return {
        full_name: r.full_name,
        description: (r.description || '').trim(),
        stars: r.stargazers_count,
        language: r.language || '-',
        url: r.html_url,
        age_days: Math.round(d * 10) / 10,
        velocity: Math.round((r.stargazers_count / d) * 10) / 10,
        delta: diff > 0 ? diff : null,
      };
    });
    rows.sort((a, b) => b.velocity - a.velocity);
    resultTracks.push({ name: tname, hits: rows.length, repos: rows.slice(0, top) });
  }

  let risers = [];
  if (Object.keys(prev).length) {
    for (const [fn, r] of Object.entries(allSeen)) {
      const p = prev[fn];
      if (p && r.stargazers_count - p.stars > 0)
        risers.push({ full_name: fn, delta: r.stargazers_count - p.stars, stars: r.stargazers_count, url: r.html_url });
    }
    risers.sort((a, b) => b.delta - a.delta);
  }

  if (shouldRefresh && !noSave) await saveSnapshot(Object.values(allSeen));
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return {
    scanned_at: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    params: { days, min_stars: minStars, top, track: track || '全部' },
    tracks: resultTracks,
    risers: risers.slice(0, 10),
    total_seen: Object.keys(allSeen).length,
    had_snapshot: Object.keys(prev).length > 0,
    baseline_age: humanAge(baseAgeMs),     // 当前对比的基线是多久前的
    baseline_refreshed: shouldRefresh,      // 本次是否更新了基线
    baseline_min_hours: BASELINE_MIN_HOURS,
  };
}

// ── v2 实时爆发榜:用 stargazers 时间戳算「当前星速」 ──
const STAR_HEADER = 'Accept: application/vnd.github.star+json';

async function ghStargazersPage(fullName, page) {
  const { stdout } = await execFileP(GH,
    ['api', `repos/${fullName}/stargazers?per_page=100&page=${page}`, '-H', STAR_HEADER, '--include'],
    { timeout: 30000, maxBuffer: 1024 * 1024 * 10 });
  const sep = stdout.search(/\r?\n\r?\n/);
  const head = sep >= 0 ? stdout.slice(0, sep) : '';
  const body = sep >= 0 ? stdout.slice(sep).trim() : stdout;
  let items = [];
  try { items = JSON.parse(body); } catch {}
  return { head, items };
}

function lastPageOf(head) {
  const m = head.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return m ? parseInt(m[1], 10) : 1;
}

// 算单个仓库的「当前星速」(stars/天)
async function burstRate(fullName, totalStars) {
  try {
    const first = await ghStargazersPage(fullName, 1);
    const lastPage = lastPageOf(first.head);
    const capped = lastPage >= 400;                 // 翻页封顶=看不到最新star
    const last = lastPage === 1 ? first : await ghStargazersPage(fullName, lastPage);
    const times = last.items.map(x => new Date(x.starred_at).getTime())
      .filter(Boolean).sort((a, b) => a - b);
    if (times.length < 2) return null;
    const t0 = times[0], t1 = times[times.length - 1], n = times.length, now = Date.now();
    let perDay, basis;
    if (!capped) {
      // 末页=最新star,直接算这~100颗的真实速率 = 当前实时星速
      const spanDays = (t1 - t0) / 86400000;
      perDay = spanDays > 0 ? (n - 1) / spanDays : null;
      basis = 'realtime';
    } else {
      // 超4万封顶:看不到最新,用「自第~4万颗以来的平均」近似
      const reachable = lastPage * 100;
      const daysSince = (now - t1) / 86400000;
      perDay = daysSince > 0 ? Math.max(totalStars - reachable, 0) / daysSince : null;
      basis = 'approx';
    }
    if (perDay == null) return null;
    return { per_day: Math.round(perDay), capped, basis, last_star_ago: humanAge(now - t1) };
  } catch { return null; }
}

async function burstBoard({ days = 90, minStars = 50, track = null, candidates = 12 }) {
  // 先普通扫一遍拿候选池(不动基线)
  const base = await scan({ days, minStars, top: 30, track, noSave: true });
  const pool = {};
  for (const t of base.tracks) for (const r of t.repos) pool[r.full_name] = r;
  const cands = Object.values(pool).sort((a, b) => b.velocity - a.velocity).slice(0, candidates);
  const out = [];
  for (let i = 0; i < cands.length; i += 4) {          // 限流:每批4个
    const batch = cands.slice(i, i + 4);
    const rates = await Promise.all(batch.map(c => burstRate(c.full_name, c.stars)));
    batch.forEach((c, j) => { if (rates[j]) out.push({ ...c, burst: rates[j] }); });
  }
  out.sort((a, b) => b.burst.per_day - a.burst.per_day);
  return {
    scanned_at: base.scanned_at,
    params: { days, min_stars: minStars, track: track || '全部', candidates: cands.length },
    board: out,
  };
}

const json = (res, code, obj) => {
  const body = Buffer.from(JSON.stringify(obj), 'utf-8');
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
  res.end(body);
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  if (url.pathname === '/' || url.pathname === '/index.html') {
    try {
      const html = await readFile(join(HERE, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': html.length });
      res.end(html);
    } catch { res.writeHead(404).end('index.html not found'); }
    return;
  }
  if (url.pathname === '/api/tracks') return json(res, 200, Object.keys(TRACKS));
  if (url.pathname === '/api/burst') {
    const q = url.searchParams;
    try {
      const data = await burstBoard({
        days: parseInt(q.get('days') || '90', 10),
        minStars: parseInt(q.get('min_stars') || '50', 10),
        track: q.get('track') || null,
        candidates: parseInt(q.get('candidates') || '12', 10),
      });
      return json(res, 200, data);
    } catch (e) { return json(res, 500, { error: String(e.message) }); }
  }
  if (url.pathname === '/api/scan') {
    const q = url.searchParams;
    try {
      const data = await scan({
        days: parseInt(q.get('days') || '90', 10),
        minStars: parseInt(q.get('min_stars') || '50', 10),
        top: parseInt(q.get('top') || '10', 10),
        track: q.get('track') || null,
      });
      return json(res, 200, data);
    } catch (e) { return json(res, 500, { error: String(e.message) }); }
  }
  json(res, 404, { error: 'not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`🛰  GitHub 爆款雷达已启动 → http://${HOST}:${PORT}`);
});
