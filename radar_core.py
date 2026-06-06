#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""GitHub 爆款雷达 — 核心扫描逻辑(CLI 与 Web 服务共用)。"""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT = os.path.join(HERE, "snapshot.json")

# ── 赛道配置:每个赛道一组搜索词(topic: 是 GitHub 话题标签,其余是关键词) ──
TRACKS = {
    "AI / LLM": [
        "topic:llm", "topic:large-language-models", "topic:ai",
        "topic:artificial-intelligence", "topic:generative-ai", "topic:rag",
    ],
    "Agent / MCP": [
        "topic:mcp", "topic:model-context-protocol", "topic:ai-agent",
        "topic:agent", "topic:autonomous-agents", "topic:agents",
    ],
    "自媒体 / 内容工具": [
        "topic:social-media", "topic:content-creation", "topic:twitter",
        "topic:automation", "topic:video-generation", "topic:tiktok",
    ],
    "出海 / 独立开发": [
        "topic:saas", "topic:boilerplate", "topic:nextjs", "topic:indie",
        "topic:starter-kit", "topic:micro-saas",
    ],
}


def gh_search(query, per_page=30):
    """调本机已登录的 gh CLI 搜索仓库,返回 items 列表。失败返回 []。"""
    cmd = [
        "gh", "api", "-X", "GET", "search/repositories",
        "-f", f"q={query}",
        "-f", "sort=stars",
        "-f", "order=desc",
        "-f", f"per_page={per_page}",
    ]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if out.returncode != 0:
            sys.stderr.write(f"[warn] 查询失败: {query} -> {out.stderr.strip()[:200]}\n")
            return []
        return json.loads(out.stdout).get("items", [])
    except Exception as e:
        sys.stderr.write(f"[warn] 查询异常: {query} -> {e}\n")
        return []


def age_days(created_at):
    dt = datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    return max((datetime.now(timezone.utc) - dt).total_seconds() / 86400, 0.5)


def load_snapshot():
    if os.path.exists(SNAPSHOT):
        try:
            with open(SNAPSHOT, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_snapshot(repos):
    data = {
        r["full_name"]: {"stars": r["stargazers_count"], "ts": datetime.now(timezone.utc).isoformat()}
        for r in repos
    }
    with open(SNAPSHOT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def scan(days=90, min_stars=50, top=10, track=None, save=True):
    """执行一次扫描,返回结构化结果 dict。"""
    today = datetime.now(timezone.utc).date()
    since = today.fromordinal(today.toordinal() - days).isoformat()
    qualifier = f"created:>{since} stars:>={min_stars}"

    prev = load_snapshot()
    tracks = {k: v for k, v in TRACKS.items()
              if (not track or track.lower() in k.lower())}

    result_tracks = []
    all_seen = {}
    for tname, terms in tracks.items():
        merged = {}
        for term in terms:
            for r in gh_search(f"{term} {qualifier}"):
                merged[r["full_name"]] = r
        rows = []
        for r in merged.values():
            d = age_days(r["created_at"])
            delta = None
            p = prev.get(r["full_name"])
            if p:
                diff = r["stargazers_count"] - p["stars"]
                if diff > 0:
                    delta = diff
            rows.append({
                "full_name": r["full_name"],
                "description": (r.get("description") or "").strip(),
                "stars": r["stargazers_count"],
                "language": r.get("language") or "-",
                "url": r["html_url"],
                "age_days": round(d, 1),
                "velocity": round(r["stargazers_count"] / d, 1),
                "delta": delta,
            })
            all_seen[r["full_name"]] = r
        rows.sort(key=lambda x: x["velocity"], reverse=True)
        result_tracks.append({"name": tname, "hits": len(rows), "repos": rows[:top]})

    # 自上次扫描·新增最多
    risers = []
    if prev:
        for fn, r in all_seen.items():
            p = prev.get(fn)
            if p:
                diff = r["stargazers_count"] - p["stars"]
                if diff > 0:
                    risers.append({
                        "full_name": fn, "delta": diff,
                        "stars": r["stargazers_count"], "url": r["html_url"],
                    })
        risers.sort(key=lambda x: x["delta"], reverse=True)

    if save:
        save_snapshot(list(all_seen.values()))

    return {
        "scanned_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "params": {"days": days, "min_stars": min_stars, "top": top, "track": track or "全部"},
        "tracks": result_tracks,
        "risers": risers[:10],
        "total_seen": len(all_seen),
        "had_snapshot": bool(prev),
    }


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="GitHub 爆款雷达 (CLI)")
    ap.add_argument("--days", type=int, default=90)
    ap.add_argument("--min-stars", type=int, default=50)
    ap.add_argument("--top", type=int, default=10)
    ap.add_argument("--track", type=str, default=None)
    args = ap.parse_args()
    data = scan(args.days, args.min_stars, args.top, args.track)
    print(f"\n🛰 GitHub 爆款雷达  {data['scanned_at']}  近{args.days}天·≥{args.min_stars}星\n")
    for t in data["tracks"]:
        print(f"\n▎{t['name']}  (命中{t['hits']})")
        for i, r in enumerate(t["repos"], 1):
            d = f"  🔥+{r['delta']}" if r["delta"] else ""
            print(f"  {i:>2}. {r['full_name']:<42} ⭐{r['stars']:<6} 🚀{r['velocity']:.0f}/天 📅{r['age_days']:.0f}天{d}")
            print(f"      {r['description'][:70]}")
            print(f"      [{r['language']}] {r['url']}")
    if data["risers"]:
        print("\n🔥 自上次扫描·新增最多:")
        for r in data["risers"]:
            print(f"  +{r['delta']:<5} ⭐{r['stars']:<6} {r['full_name']}")
    print(f"\n✅ 已存快照 {data['total_seen']} 个仓库\n")
