# 🛰 GitHub 爆款雷达

一个本地运行的 GitHub 潜力仓库雷达,和「X 热点雷达」对称——只不过盯的是 GitHub。
抓「最近创建 + 已经开始涨星」的仓库,帮你发现技术趋势、内容选题、可学习的开源项目。

## 它做什么

- 扫描 4 个赛道:**AI / LLM**、**Agent / MCP**、**自媒体/内容工具**、**出海/独立开发**
- 核心指标是 **星速(⭐/天)= 总星 ÷ 天龄**,而不是总星数 —— 天龄小 + 星速高 = 正在起飞
- 记录快照,第二次扫描起会显示 **🔥 自上次新增**(真正的上升信号)
- 走本机已登录的 `gh` CLI 认证,限速高、零配置
- 浅色 Apple 风界面,和 X 热点雷达一致

## 已配置开机自启(launchd)

服务已装成 **开机自启**(和 X 热点雷达同款 launchd 方案,用 Homebrew 的 node 运行,
所以能读桌面目录)。开机后自动在后台运行,随时打开下面地址即可:

**面板地址 → http://127.0.0.1:8788**

### 双击脚本

| 脚本 | 作用 |
|------|------|
| `打开面板.command` | 打开网页面板(没在跑会自动拉起) |
| `重装自启服务.command` | 移动过文件夹 / 服务异常时,重装并启动 |
| `卸载自启服务.command` | 停止并取消开机自启 |

> ⚠️ 如果把整个文件夹**移动到别处**,自启会失效(plist 里记的是旧路径)。
> 移动后双击一次 `重装自启服务.command` 即可修复。

## 纯命令行用法(不开网页)

```bash
python3 radar_core.py                 # 全赛道,近90天,≥50星
python3 radar_core.py --days 30       # 只看近30天新苗子
python3 radar_core.py --track AI      # 只扫某赛道
python3 radar_core.py --min-stars 200 --top 15
```

## 面板怎么看

- **🚀 星/天**:星速,越高涨得越猛 —— **最该看这个**
- **📅 天龄**:仓库创建多少天,越小越「早期」
- **🔥 +N**:自上次扫描以来新增的星(第二次扫描起出现)
- 顶部「自上次扫描·新增星最多」= 全赛道里涨得最猛的 Top10

## 想改赛道

赛道关键词在两处(改一处就够,看你用哪个入口):
- 网页/自启服务:`server.mjs` 顶部的 `TRACKS`
- 命令行:`radar_core.py` 顶部的 `TRACKS`

`topic:xxx` 是 GitHub 话题标签。

## 文件说明

| 文件 | 作用 |
|------|------|
| `server.mjs` | 本地 Web 服务(Node,launchd 自启用它) |
| `radar_core.py` | 扫描核心逻辑(命令行用) |
| `index.html` | 网页面板 |
| `com.martin.github-radar.plist` | launchd 自启配置模板 |
| `打开面板.command` / `重装自启服务.command` / `卸载自启服务.command` | 双击脚本 |
| `snapshot.json` | 自动生成,记录上次扫描(算「新增」用) |

## 环境

- 已登录的 GitHub CLI(`gh auth status` 能看到已登录)
- Homebrew node(`/opt/homebrew/bin/node`)— 用于自启服务
- Python 3(命令行用,macOS 自带)
