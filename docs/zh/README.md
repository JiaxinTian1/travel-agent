# Travel Agent ✈️

<p>
  <a href="../../README.md"><strong>English</strong></a>
  &nbsp;|&nbsp;
  <a href="README.md"><strong>中文</strong></a>
  &nbsp;|&nbsp;
  <a href="../index.html"><strong>文档首页</strong></a>
</p>

Travel Agent 是一个 local-first 的旅行规划应用，由轻量 agent runner 驱动。它把目的地调研、planner tab、候选地点、行程单元格和路线图都保存成可继续编辑的状态。

## 产品流程

```text
workspace/query.md + app/agent/memory.md
  -> researcher tab
  -> planner tabs
  -> 可编辑日程表
  -> 路线地图
```

## 主要组件

| 区域 | 路径 | 用途 |
|---|---|---|
| Web app | `app/index.html` | Researcher、planner、拖拽日程、地图路线 |
| Server | `app/server.js` | 本地 API：状态、query、memory、research、planner action |
| Agent runner | `app/agent/` | 模型调用、工具路由、推荐逻辑、memory 管理 |
| Toolkit adapter | `app/toolkit/` | Booking、Airbnb、FlyAI、小红书、Google、Mapbox、高德的 JS 适配 |
| Shell wrapper | `toolkit/` | 外部工具命令和登录脚本 |
| Skills | `skills/` | Codex 使用的 researcher、planner、travel-agent workflow |
| Workspace | `workspace/` | 当前 query 和本地运行状态 |

## 启动

```bash
cd /home/snowbolwer/travel-agent
node app/server.js
```

打开：

```text
http://127.0.0.1:8080/
```

## 安装和登录

```bash
./install.sh --doctor
./install.sh --install-gcloud
./toolkit/login/login-status
./toolkit/login/login-all
```

`login-all` 会包含 Google Monitoring 登录和小红书登录。Booking 和 Airbnb 匿名搜索不需要账号登录。

## Google Maps

Google 是海外地点和路线的主数据源。配置后，app 会在调用 Google API 前先查 Cloud Monitoring 真实用量：

```env
GOOGLE_USAGE_SOURCE=monitoring
GOOGLE_CLOUD_PROJECT_ID=your-project-id
```

使用用户授权登录：

```bash
./toolkit/google/google-login
./toolkit/google/google-usage
```

## 工具使用规则

- Google Places：海外餐厅、景点、酒店坐标、导入地点解析的主数据源。
- Google Routes：海外路线计算优先。
- 高德：国内 planner 的地图和路线优先。
- Mapbox：全球地图渲染和路线 fallback。
- Booking：海外酒店价格、可订、评论和取消政策调研。
- Airbnb：民宿、公寓、villa、厨房洗衣、家庭住宿和长住。
- FlyAI/飞猪：机票、国内酒店、国内 POI 和旅行产品搜索。
- 小红书：MCP 已登录可用时，用于社区评价和社交证据。

## 本地状态

不要提交这些文件：

```text
app/.env
toolkit/**/.env
workspace/app-state/
workspace/outputs/
```

重要可编辑文件：

```text
workspace/query.md       # 当前旅行需求
app/agent/memory.md      # 长期旅行记忆
```

## 更多文档

- [命令手册](commands.md)
- [当前集成状态](status.md)
- [Google toolkit](toolkit/google.md)
- [Booking toolkit](toolkit/booking.md)
- [Airbnb toolkit](toolkit/airbnb.md)
- [FlyAI toolkit](toolkit/fz.md)
