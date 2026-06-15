# Airbnb MCP Toolkit

这个目录把 `openbnb-org/mcp-server-airbnb` 包装成 travel research 可调用的本地命令。

MCP server 不会 vendored 到仓库里。wrapper 会通过下面的命令运行它：

```bash
npx -y @openbnb/mcp-server-airbnb
```

服务暴露两个工具：

- `airbnb_search`：按地点、日期、人数、价格和房源类型搜索房源。
- `airbnb_listing_details`：按房源 id 获取详情。

## 依赖

- Linux Node.js 18+
- `npx`
- 首次运行需要网络访问 npm 包和 Airbnb 查询

在 WSL 中优先安装 Linux 内的 Node。Windows npm shim 可能会失败。

## 配置

仅当需要本地覆盖配置时，把 `.env.example` 复制为 `.env`：

```bash
cp toolkit/airbnb/.env.example toolkit/airbnb/.env
```

默认值：

- `AIRBNB_IGNORE_ROBOTS=true`：绕过 robots.txt，使 live search 能返回数据。
- `DISABLE_GEOCODING=false`：允许 Photon/Nominatim geocoding，用于国际地点。

如果要严格遵守 robots.txt，可在 `.env` 中设置：

```text
AIRBNB_IGNORE_ROBOTS=false
```

## 命令

列出工具 schema：

```bash
./toolkit/airbnb/airbnb-mcp-list
```

搜索房源：

```bash
./toolkit/airbnb/airbnb-search location="Tbilisi, Georgia" checkin=2026-09-25 checkout=2026-10-07 adults=2 propertyType=entire_home
```

获取详情：

```bash
./toolkit/airbnb/airbnb-details id=12345678 checkin=2026-09-25 checkout=2026-10-07 adults=2
```

## Travel Skill 用法

只有当用户偏好民宿、公寓、villa、家庭住宿、长住、厨房/洗衣或本地街区住宿时，优先使用 Airbnb。普通酒店偏好应先用 FlyAI/飞猪酒店搜索。
