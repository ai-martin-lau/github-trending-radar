#!/bin/bash
# 双击重装开机自启服务(移动过文件夹、或服务异常时用)
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.martin.github-radar"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"
mkdir -p "$HOME/Library/LaunchAgents"
sed "s|__DIR__|$DIR|g" "$DIR/$LABEL.plist" > "$PLIST_DST"
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"
echo "🚀 已重装并启动开机自启服务"
sleep 2
if curl -s -o /dev/null "http://127.0.0.1:8788/"; then
  echo "✅ 运行中 → http://127.0.0.1:8788"
  open "http://127.0.0.1:8788"
else
  echo "⚠️ 未检测到,看 /tmp/github-radar.launchd.err"
fi
read -n 1 -s -r -p "按任意键关闭…"
