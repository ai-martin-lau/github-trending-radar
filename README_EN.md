<p align="center">
  <a href="README.md">简体中文</a> · <a href="README_EN.md">English</a> · <a href="README_JA.md">日本語</a> · <a href="README_KO.md">한국어</a> · <a href="README_ES.md">Español</a>
</p>

# 🛰 GitHub Trending Radar

A locally running radar for high-potential GitHub repos, the mirror image of the "X Hotspot Radar" — except it watches GitHub instead.
It picks up repos that were "recently created + already gaining stars," helping you spot tech trends, content topics, and open-source projects worth studying.

## What it does

- Scans 4 tracks: **AI / LLM**, **Agent / MCP**, **Creator / Content Tools**, **Going Global / Indie Dev**
- The core metric is **star velocity (⭐/day) = total stars ÷ age in days**, not total star count — low age + high velocity = taking off
- Records snapshots, and from the second scan on it shows **🔥 new since last time** (a true rising signal)
- **Real-time Breakout Board (auto-appended after each scan)**: once a scan finishes, the 12 candidates with the highest velocity automatically get their real star timestamps pulled to compute the **current real-time star velocity** (the actual rate of the latest ~100 stars), letting you tell "blowing up right now" from "already cooled off" — something the average velocity can't reveal. The board renders as its own section, and the 🟢 real-time tag is also stamped back onto the matching cards in the track lists. Note: GitHub caps pagination for repos over 40k stars, so only an approximate value can be taken (the UI marks it 🟢 real-time / ⚪ approximate)
- Uses your locally logged-in `gh` CLI auth — high rate limits, zero config
- Light Apple-style UI, consistent with the X Hotspot Radar

## Auto-start on boot already configured (launchd)

The service is installed to **auto-start on boot** (the same launchd setup as the X Hotspot Radar, run with Homebrew's node,
so it can read the Desktop directory). It runs in the background automatically after boot — just open the address below anytime:

**Dashboard URL → http://127.0.0.1:8788**

### Double-click scripts

| Script | Purpose |
|------|------|
| `打开面板.command` | Opens the web dashboard (launches it automatically if not running) |
| `重装自启服务.command` | When you've moved the folder / the service is misbehaving, reinstall and start it |
| `卸载自启服务.command` | Stop and disable auto-start on boot |

> ⚠️ If you **move the entire folder** elsewhere, auto-start will break (the plist records the old path).
> Just double-click `重装自启服务.command` once after moving to fix it.

## Command-line only usage (no web)

```bash
python3 radar_core.py                 # all tracks, last 90 days, ≥50 stars
python3 radar_core.py --days 30       # only fresh sprouts from the last 30 days
python3 radar_core.py --track AI      # scan only one track
python3 radar_core.py --min-stars 200 --top 15
```

## How to read the dashboard

- **🚀 stars/day**: star velocity, the higher the faster it's climbing — **this is the one to watch**
- **📅 age in days**: how many days since the repo was created; smaller means more "early stage"
- **🔥 +N**: stars added since the last scan (appears from the second scan on)
- **🟢 real-time N/day**: the current real-time star velocity auto-appended after the scan (computed from the latest ~100 stars) — check this for how fast it's growing *right now*
- The top "Most new stars since last scan" = the Top 10 fastest climbers across all tracks

## Want to change the tracks

The track keywords live in two places (changing one is enough — depends on which entry point you use):
- Web / auto-start service: `TRACKS` at the top of `server.mjs`
- Command line: `TRACKS` at the top of `radar_core.py`

`topic:xxx` is a GitHub topic tag.

## File reference

| File | Purpose |
|------|------|
| `server.mjs` | Local web service (Node; used by launchd auto-start) |
| `radar_core.py` | Core scanning logic (for command-line use) |
| `index.html` | Web dashboard |
| `com.martin.github-radar.plist` | launchd auto-start config template |
| `打开面板.command` / `重装自启服务.command` / `卸载自启服务.command` | Double-click scripts |
| `snapshot.json` | Auto-generated, records the last scan (used to compute "new") |

## Environment

- A logged-in GitHub CLI (`gh auth status` shows you're logged in)
- Homebrew node (`/opt/homebrew/bin/node`) — used by the auto-start service
- Python 3 (for command-line use; bundled with macOS)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ai-martin-lau/github-trending-radar&type=Date)](https://star-history.com/#ai-martin-lau/github-trending-radar&Date)
