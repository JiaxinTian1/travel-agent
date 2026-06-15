# 飞猪 / FlyAI

这个目录保存 travel agent 使用的飞猪/FlyAI 配置和辅助命令。

## 文件

- `.env`：FlyAI API key。
- `flyai-env`：加载 `.env` 后运行全局 FlyAI CLI。
- `fz-status`：检查配置并运行航班 smoke test。

## 命令

```bash
./toolkit/fz/flyai-env search-flight --origin "上海" --destination "北京" --dep-date 2026-07-01 --sort-type 3
./toolkit/fz/flyai-env search-hotel --dest-name "北京" --check-in-date 2026-07-01 --check-out-date 2026-07-03
./toolkit/fz/flyai-env search-poi --city-name "北京" --category "历史古迹"
./toolkit/fz/flyai-env fliggy-fast-search --query "云南 5天 亲子游"
```

## MCP / API

实时飞猪数据需要 FlyAI API。当前不需要单独的飞猪 MCP，因为 FlyAI CLI 已经覆盖旅行 agent 需要的核心操作：航班、酒店、POI 和快速旅行产品搜索。

当前 key 可能是体验模式。需要更完整结果、更高额度或生产稳定性时，应使用正式 FlyAI API key。
