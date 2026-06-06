#!/bin/bash
# 双击停止并卸载开机自启服务
LABEL="com.martin.github-radar"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"
launchctl unload "$PLIST_DST" 2>/dev/null && echo "✅ 服务已停止" || echo "服务本就未运行"
rm -f "$PLIST_DST" && echo "✅ 已移除开机自启配置"
read -n 1 -s -r -p "按任意键关闭…"
