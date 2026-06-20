# Travel Agent 命令

## 安装 / 诊断

```bash
./install.sh
./install.sh --doctor
```

`./install.sh` 也会检查并可安装 Booking.com MCP 酒店搜索需要的 Playwright Chromium：

```bash
npx playwright install chromium
```

## 登录 / 配置状态

检查所有 toolkit 的认证和配置状态：

```bash
./toolkit/login/login-status
```

运行交互式登录/配置流程。当前通常只有小红书需要扫码；FlyAI 使用 `.env`，Airbnb 和 Booking.com 匿名搜索不需要账号登录。

```bash
./toolkit/login/login-all
```

## FlyAI

```bash
./toolkit/fz/flyai-env search-flight --origin "上海" --destination "北京" --dep-date 2026-07-01 --sort-type 3
./toolkit/fz/flyai-env search-hotel --dest-name "北京" --check-in-date 2026-07-01 --check-out-date 2026-07-03
./toolkit/fz/flyai-env search-poi --city-name "北京" --category "历史古迹"
./toolkit/fz/flyai-env fliggy-fast-search --query "云南 5天 亲子游"
```

检查 FlyAI 配置并跑航班 smoke test：

```bash
./toolkit/fz/fz-status
```

## 小红书 mcporter

先加载 `toolkit/xhs/.env`。

```bash
mcporter list
mcporter call xiaohongshu.search_notes keyword="弥勒 带娃 亲子游" page_size=10 sort="popularity_descending"
mcporter call xiaohongshu.search_notes_with_comments keyword="弥勒 带娃 亲子游" page_size=5 max_comments_per_note=10 sort="popularity_descending"
mcporter call xiaohongshu.get_note_comments note_id="笔记ID"
```

## 小红书 xpzouying/xiaohongshu-mcp

安装位置：

```text
toolkit/xhs/xhs-mcp
```

启动 HTTP MCP 服务：

```bash
./toolkit/xhs/xhs-mcp-start
```

`xhs-mcp-start` 会先运行可视化登录助手。未登录时会打开 Chromium 窗口进行二维码登录。登录成功后，HTTP MCP 服务会在 `18060` 端口启动。

检查服务监听、登录状态和搜索可用性：

```bash
./toolkit/xhs/xhs-mcp-status
```

重启前或浏览器自动化卡住时停止服务：

```bash
./toolkit/xhs/xhs-mcp-stop
```

只启动服务、跳过可视化登录检查：

```bash
XHS_SKIP_LOGIN=1 ./toolkit/xhs/xhs-mcp-start
```

已注册为 mcporter 工具：

```bash
mcporter list xiaohongshu-xpz --schema
mcporter call xiaohongshu-xpz.check_login_status
mcporter call xiaohongshu-xpz.list_feeds --timeout 180000
mcporter call xiaohongshu-xpz.search_feeds --timeout 180000 --args '{"keyword":"弥勒 带娃 亲子游","filters":{"sort_by":"最多收藏","note_type":"图文","publish_time":"半年内"}}'
```

生成新的登录二维码。脚本会先删除旧二维码，所以目录里只保留最新图片：

```bash
./toolkit/xhs/xhs-login-qr
```

生成新二维码并轮询到登录成功或二维码过期：

```bash
./toolkit/xhs/xhs-login-watch
```

当前备注：

```text
登录可用，搜索能返回结果。如果搜索调用卡住，先停止再重启 MCP 服务。
```

## Airbnb MCP

Airbnb 通过本地 wrapper 和 `npx` 调用 `openbnb-org/mcp-server-airbnb`。

当用户偏好民宿、公寓、villa、厨房/洗衣、家庭住宿、长住或本地街区住宿时使用。海外酒店偏好优先使用 Booking.com；国内/中文生态酒店调研优先使用 FlyAI/飞猪。

```bash
./toolkit/airbnb/airbnb-mcp-list
./toolkit/airbnb/airbnb-search location="Tbilisi, Georgia" checkin=2026-09-25 checkout=2026-10-07 adults=2 propertyType=entire_home
./toolkit/airbnb/airbnb-details id=12345678 checkin=2026-09-25 checkout=2026-10-07 adults=2
```

默认值：

```text
AIRBNB_IGNORE_ROBOTS=true
DISABLE_GEOCODING=false
```

仅在需要本地覆盖配置时，把 `toolkit/airbnb/.env.example` 复制为 `toolkit/airbnb/.env`。

## Booking.com MCP

Booking.com 酒店搜索通过本地 wrapper 和 `npx` 调用 `markswendsen-code/mcp-booking`，npm 包名是 `@striderlabs/mcp-booking`。

海外酒店、酒店式公寓、房型可订、取消政策、价格和评论调研优先使用它。wrapper 只暴露只读工具；不要在调研流程中自动订房或取消订单。

```bash
./toolkit/booking/booking-mcp-list
./toolkit/booking/booking-search destination="Tbilisi, Georgia" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
./toolkit/booking/booking-property propertyUrl="<booking-search 返回的 propertyId 或 url>"
./toolkit/booking/booking-availability propertyUrl="<booking-search 返回的 propertyId 或 url>" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
./toolkit/booking/booking-prices propertyUrl="<booking-search 返回的 propertyId 或 url>" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
./toolkit/booking/booking-reviews propertyUrl="<booking-search 返回的 propertyId 或 url>"
```

仅在需要本地覆盖配置时，把 `toolkit/booking/.env.example` 复制为 `toolkit/booking/.env`。

## Travel Skills

项目内 active skill 副本位于：

```text
skills/researcher
skills/planner
```

这些 skill 使用的小红书 MCP 注册名是 `xiaohongshu-xpz`。可用时，用 `search_feeds` 获取社区证据。
