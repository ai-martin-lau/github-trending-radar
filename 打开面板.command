#!/bin/bash
# 双击打开雷达面板(服务没在跑会自动拉起)
PORT=8788
LABEL="com.martin.github-radar"
if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/"; then
  launchctl load "$HOME/Library/LaunchAgents/$LABEL.plist" 2>/dev/null
  sleep 2
fi
open "http://127.0.0.1:$PORT"
