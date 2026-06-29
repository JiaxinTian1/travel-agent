# 集成状态

## App

- 本地 server：`node app/server.js`
- 健康检查：`http://127.0.0.1:8080/api/health`
- Board 状态：`workspace/app-state/board.json`
- Query：`workspace/query.md`
- Memory：`app/agent/memory.md`

## Google Maps

状态：可用。

- Places Search：海外餐厅、景点、酒店坐标的主数据源。
- Routes：海外路线优先 provider。
- Cloud Monitoring 用量保护：已通过 gcloud ADC 跑通。
- 当前用量：`./toolkit/google/google-usage`

健康检查应看到：

```text
googleServiceEnabled: true
googleUsage.source: monitoring
googleUsage.monitoringConfigured: true
```

## 地图渲染

- Mapbox 仍作为全球浏览器地图渲染主方案。
- 高德保留给中国国内 planner。
- 如果地图 token 或瓦片失败，保留 SVG 路线图 fallback。

## Booking

状态：已作为只读酒店调研工具接入。

- Wrapper 包：`@striderlabs/mcp-booking`
- 用于海外酒店、酒店式公寓、价格、可订、取消政策和评论。
- 订房/账号/收藏工具不暴露给自动调研流程。

## Airbnb

状态：已接入民宿类住宿调研。

- Wrapper 包：`@openbnb/mcp-server-airbnb`
- 用于公寓、villa、厨房洗衣、家庭住宿、长住和本地街区住宿。

## FlyAI / 飞猪

状态：通过 CLI wrapper 接入。

- 用于机票、国内/中文生态酒店、POI 和旅行产品搜索。
- 配置在 `toolkit/fz/.env`。

## 小红书

状态：MCP 服务和登录状态健康时可用。

- 启动：`./toolkit/xhs/xhs-mcp-start`
- 状态：`./toolkit/xhs/xhs-mcp-status`
- 登录助手：`./toolkit/xhs/xhs-login-watch`
- MCP 注册名：`xiaohongshu-xpz`

平台可能仍要求二维码/安全确认，或对搜索限流。

## 仓库结构

- 面向用户的文档统一放在 `docs/en` 和 `docs/zh`。
- 生成报告和临时路线结果不作为仓库基线提交。
