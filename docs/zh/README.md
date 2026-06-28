# Travel Agent ✈️

<p>
  <a href="../../README.md"><strong>English</strong></a>
  &nbsp;|&nbsp;
  <a href="README.md"><strong>中文</strong></a>
  &nbsp;|&nbsp;
  <a href="../index.html"><strong>文档首页</strong></a>
</p>

Travel Agent 是一个 agent 驱动的旅行规划工作区。它帮助旅行负责人从“去哪玩？”开始，逐步生成候选目的地、可编辑 planner、住宿/餐厅/景点/航班推荐，以及路线视图。

## 产品特色 🌍

- **目的地调研**：当目的地还不确定时，生成多个候选地点并做横向比较。
- **个性化规划**：结合可编辑的 `query` 和 `memory`，考虑偏好、去过的地方、住宿风格、航班约束和预算信号。
- **多个 planner**：每个候选目的地可以生成独立 planner，并保留可编辑状态。
- **拖拽式日程**：把航班、酒店、餐厅和景点安排进 2 小时时间块表格。
- **工具联动**：通过本地工具层连接 Booking、Airbnb、小红书、飞猪/FlyAI、Mapbox、高德地图和 OpenRouteService。
- **路线视图**：配置后优先使用 Mapbox 全球地图，也可使用高德地图，并保留 OpenRouteService 和 SVG 路线图 fallback。
- **Codex skill 支持**：内置轻量 `travel-agent` skill，让 Codex 可以通过本地 server API 操作 app。

## 能做什么 🧭

Travel Agent 不只是生成一段文本，而是把旅行计划保存成可继续编辑的状态：

- `query` 保存当前旅行需求。
- `memory` 保存长期偏好和个人信息。
- `researcher` 负责筛选和比较目的地。
- `planner` 负责把选定目的地变成可编辑行程。
- Web UI 和 Codex 都可以读取并更新同一份状态。

## 启动 🚀

在仓库根目录运行：

```bash
node app/server.js
```

然后打开：

```text
http://127.0.0.1:8080/
```

可选配置：

```bash
cp app/.env.example app/.env
```

如果需要模型调用、Mapbox、高德地图、OpenRouteService 路线计算，或工具层 API key，可以填写 `app/.env`。

## 可选安装 🛠️

检查或安装可选 live-data 依赖：

```bash
./install.sh
./install.sh --doctor
```

## 项目结构 📁

```text
app/        Web UI、本地 server、agent runner、工具函数
skills/     Codex skills
toolkit/    外部数据工具包装器
workspace/  可编辑 query、本地状态、生成结果
docs/       文档
```

## 当前状态 🧪

这是一个 local-first 的活跃原型。主流程是：

```text
query + memory -> researcher -> planner -> editable itinerary -> route view
```
