# Travel Agent

<p>
  <a href="../../README.md"><strong>English</strong></a>
  &nbsp;|&nbsp;
  <a href="README.md"><strong>中文</strong></a>
  &nbsp;|&nbsp;
  <a href="../index.html"><strong>文档首页</strong></a>
</p>

这个仓库是一个面向 Codex 的旅行规划工作区，核心由两个可用 skill 和一组 live data 工具组成：

- `travel-destination-research`：目的地还没确定时，用来比较和排序候选目的地。
- `travel-itinerary-plan`：目的地确定后，用来比较路线方案并生成 2 小时时间块日程表。

`toolkit/` 目录提供飞猪/FlyAI、小红书、Airbnb 等数据工具。这个仓库的主产品是 skill；toolkit 是这些 skill 调用实时证据时使用的工具层。

## 目录结构

```text
.
├── skills/
│   ├── travel-destination-research/
│   └── travel-itinerary-plan/
├── toolkit/
│   ├── fz/        # 飞猪/FlyAI CLI 包装器
│   ├── xhs/       # 小红书 MCP 脚本和登录状态
│   ├── airbnb/    # Airbnb MCP 包装器
│   └── login/     # 统一登录/配置检查脚本
├── workspace/
│   ├── memory.md  # 长期偏好、去过的地方、约束
│   ├── query.md   # 当前可编辑旅行需求
│   └── outputs/   # 生成的方案和证据快照
├── install.sh
├── commands.md
└── status.md
```

除非命令特别说明，请在仓库根目录执行。

## 安装

安装或检查可选 live-data 依赖：

```bash
./install.sh
./install.sh --doctor
```

安装脚本会处理项目包装器、下载小红书 MCP 二进制文件，并在 `npm` 可用时安装 npm CLI：

- `@fly-ai/flyai-cli`：用于 FlyAI/飞猪航班、酒店、POI 和快速旅行产品搜索。
- `mcporter`：用于从 shell 调用 MCP 工具。

安装脚本不会登录小红书。默认也不会安装 Node.js/npm 或 Chromium 系统依赖。要通过 apt 安装 Linux Node.js/npm：

```bash
./install.sh --install-system
```

## Skills

目的地还没确定时使用 `travel-destination-research`：

```text
9月底从上海出发，想要自然风光、小众一点，去哪几个地方值得比？
```

目的地确定后使用 `travel-itinerary-plan`：

```text
就选格鲁吉亚，帮我做 9/25-10/7 的路线和 2 小时日程表。
```

两个 skill 都会读取 `workspace/memory.md` 和 `workspace/query.md`，再和用户最新提示合并。生成物应保存到 `workspace/outputs/<trip-id>/`。

## 飞猪 / FlyAI

FlyAI 配置在 `toolkit/fz/.env`。

```bash
./toolkit/fz/flyai-env search-flight --origin "上海" --destination "北京" --dep-date 2026-07-01 --sort-type 3
./toolkit/fz/fz-status
```

## 登录 / 配置

检查所有工具登录和配置状态：

```bash
./toolkit/login/login-status
```

运行交互式登录/配置流程：

```bash
./toolkit/login/login-all
```

通常只有小红书需要扫码登录。FlyAI 使用 `toolkit/fz/.env`，Airbnb 当前不需要账号登录。

## 小红书 MCP

当前小红书 MCP 服务是 `xiaohongshu-xpz` mcporter 注册项：

```bash
./toolkit/xhs/xhs-mcp-start
./toolkit/xhs/xhs-mcp-status
./toolkit/xhs/xhs-mcp-stop
```

如果需要跳过启动前的可视化登录检查：

```bash
XHS_SKIP_LOGIN=1 ./toolkit/xhs/xhs-mcp-start
```

跳过登录检查不代表匿名搜索一定可用；小红书仍可能要求有效 session。

后续需要扫码时：

```bash
./toolkit/xhs/xhs-login-qr
./toolkit/xhs/xhs-login-watch
```

## Airbnb MCP

Airbnb 支持通过本地 wrapper 调用 `openbnb-org/mcp-server-airbnb`，适合用户偏好民宿、公寓、villa、家庭住宿、厨房/洗衣、长住或本地街区住宿时使用。

```bash
./toolkit/airbnb/airbnb-mcp-list
./toolkit/airbnb/airbnb-search location="Tbilisi, Georgia" checkin=2026-09-25 checkout=2026-10-07 adults=2 propertyType=entire_home
./toolkit/airbnb/airbnb-details id=12345678 checkin=2026-09-25 checkout=2026-10-07 adults=2
```

默认 wrapper 会传入 `--ignore-robots-txt`，以便 live Airbnb 搜索返回数据。可选配置见 `toolkit/airbnb/.env.example`。

## 更多命令

完整命令笔记见 `commands.md`，历史集成状态见 `status.md`。
