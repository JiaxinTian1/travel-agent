# Travel Agent 状态

## 2026-06-14 小红书测试

已加载环境值：

- `XIAOHONGSHU_COOKIE`：存在
- `XIAOHONGSHU_XS`：存在
- `XIAOHONGSHU_XS_COMMON`：存在

直接 client 调用成功访问 `edith.xiaohongshu.com`，返回 HTTP 200，API `code: 0`。

观察到的结果：

```text
{"code":0,"success":true,"msg":"成功","data":{"has_more":false}}
```

测试关键词：

- `成都 亲子游`
- `成都`
- `成都亲子游`
- `北京旅游`

这些请求都返回 `code: 0`，但 `items` 为空。

可能原因：已安装的 `xiaohongshu-mcp-steve` 包会转发静态 `x-s` 和 `x-s-common` 头，但不会为每个请求体/search id 生成新的签名。小红书 web search API 似乎需要按请求生成签名。当前 cookie/header 能证明认证能到达 API，但该 MCP 包不足以稳定获取搜索笔记。

当前实际状态：

- FlyAI：通过 `./toolkit/fz/flyai-env` 可用。
- 小红书 cookie 加载：可用。
- 小红书 direct API auth：部分可用。
- 通过当前包获取小红书笔记：不可用，返回空结果。
- 该包的 `mcporter` stdio 集成：仍离线。

## 2026-06-14 xpzouying/xiaohongshu-mcp 测试

下载 release：

- tag: `v2026.06.12.1403-5c43e3d`
- asset: `xiaohongshu-mcp-linux-amd64.tar.gz`
- sha256: `6467e0179b755508fb1d71405d4da8234472f7a43464ce2253d6682da6306322`

安装目录：

```text
toolkit/xhs/xhs-mcp/
```

二进制：

- `xiaohongshu-mcp-linux-amd64`
- `xiaohongshu-login-linux-amd64`

MCP HTTP 服务可以在下面地址初始化：

```text
http://localhost:18060/mcp
```

`mcporter list xiaohongshu-xpz --schema` 能检测到 13 个工具，包括：

- `check_login_status`
- `get_login_qrcode`
- `search_feeds`
- `get_feed_detail`
- `list_feeds`

当时阻塞点：

```text
Failed to launch the browser:
.../rod/browser/chromium-1321438/chrome: error while loading shared libraries: libnss3.so: cannot open shared object file
```

结论：这个仓库结构上可用，也匹配 travel-planner 工具命名，但 WSL 缺少 Linux Chromium 运行库。登录/搜索前需要安装 Chromium 依赖。

## 2026-06-14 xpzouying 登录成功

可视化浏览器流程已确认登录成功。纯二维码 MCP 流程可以显示二维码，但在当前 WSL 环境下没有稳定持久化 cookies。可靠路径是：

1. 安装 Chromium 运行库。
2. 运行 `./toolkit/xhs/xhs-mcp-start`。
3. 通过浏览器流程登录，并在 REDNote 中确认第二个安全二维码。

cookies 现在存在：

```text
toolkit/xhs/xhs-mcp/data/cookies.json
```

已验证：

- `check_login_status`：返回已登录。
- `list_feeds`：成功返回 feed 数据。

待处理：

- 带 filters 的 `search_feeds` 在 180 秒测试中超时。MCP/browser/login 栈可用，但搜索自动化可能需要单独调试或可视化浏览器会话。

## 2026-06-16 Airbnb MCP Wrapper

已把 `openbnb-org/mcp-server-airbnb` 集成为本地 wrapper：

```text
toolkit/airbnb/
```

命令：

- `airbnb-mcp-list`
- `airbnb-search`
- `airbnb-details`

wrapper 使用 `mcporter` 连接 `npx -y @openbnb/mcp-server-airbnb` 的 stdio 服务。默认传入 `--ignore-robots-txt`，并通过 `toolkit/airbnb/.env` 暴露 `AIRBNB_IGNORE_ROBOTS` 和 `DISABLE_GEOCODING`。

当前验证：

```text
node v22.22.1
npm 9.2.0
npx 9.2.0
airbnb-mcp-list OK
airbnb-search reaches the MCP server; default wrapper behavior bypasses robots.txt
```
