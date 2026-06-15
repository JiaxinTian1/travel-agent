---
name: travel-planner-deprecated
description: >
  Deprecated project copy. Do not install or use directly. Use travel-destination-research
  for open-ended destination selection and travel-itinerary-plan after the user chooses
  a destination.
---

# Travel Planner Deprecated

This combined skill has been split into two active skills:

- `travel-destination-research`: choose and rank destinations. Does not output a full 2-hour itinerary grid.
- `travel-itinerary-plan`: build detailed route and 2-hour itinerary after the destination is selected.

The active project copies live under `skills/`.

This skill turns a user's travel intent into decision-ready travel plans. It has two modes:

1. `destination-research`: user is unsure where to go. Research candidate destinations and rank them.
2. `itinerary-plan`: user has chosen a destination. Research route options and build a detailed schedule.

The required user-facing output in both modes is:

1. A scored table ranked from best to worst.
2. A 2-hour itinerary grid with dates as columns and time blocks as rows.

## Workspace

Use this workspace by default:

```text
.
├── workspace/
│   ├── memory.md      # long-term user preferences, visited places, constraints
│   ├── query.md       # current editable request
│   └── outputs/       # generated artifacts and source snapshots
├── toolkit/
│   ├── fz/flyai-env   # Feizhu/FlyAI CLI wrapper
│   └── xhs/           # Xiaohongshu MCP scripts/login state
└── skills/travel-planner/
```

Before planning:

1. Read `workspace/memory.md` if it exists.
2. Read `workspace/query.md` if it exists.
3. Merge those files with the user's latest prompt. Latest prompt wins.
4. If a key field is missing and cannot be inferred, ask only the minimum needed question. Do not ask if a reasonable assumption can be stated in the output.

Do not maintain a historical `queries/` folder. If a run should be preserved, save a snapshot under `workspace/outputs/<trip-id>/query.md`.

## Tools

Use Bash for local tools.

| Tool | Command | Use |
|---|---|---|
| FlyAI / Feizhu | `./toolkit/fz/flyai-env ...` | flights, hotels, POIs, fast travel-product search |
| Xiaohongshu MCP | `mcporter call xiaohongshu-xpz.search_feeds ...` | real user notes and community validation |
| Web search | available web/search tool | weather, official sites, route facts, general research |

FlyAI examples:

```bash
./toolkit/fz/flyai-env fliggy-fast-search --query "上海出发 9月 自然风光 13天"
./toolkit/fz/flyai-env search-flight --origin "上海" --destination "奥克兰" --dep-date 2026-09-25 --back-date 2026-10-07 --sort-type 3
./toolkit/fz/flyai-env search-hotel --dest-name "皇后镇" --check-in-date 2026-09-26 --check-out-date 2026-09-28
```

Xiaohongshu examples:

```bash
mcporter call xiaohongshu-xpz.search_feeds --timeout 120000 --args '{"keyword":"新西兰南岛 自然风光 自驾 攻略"}'
mcporter call xiaohongshu-xpz.search_feeds --timeout 120000 --args '{"keyword":"挪威峡湾 9月 旅行 攻略"}'
```

If a tool hangs, report it briefly and continue with other sources. For Xiaohongshu, the user can restart with:

```bash
./toolkit/xhs/xhs-mcp-stop
./toolkit/xhs/xhs-mcp-start
```

## Mode Selection

Choose `destination-research` when:

- destination is missing, broad, or open-ended: "全球", "不知道去哪", "哪里好玩", "推荐几个地方".
- user asks to compare destinations.

Choose `itinerary-plan` when:

- destination is fixed: a country, region, city, route, or selected destination.
- user asks for detailed daily plan.

If the user gives a broad area plus a strong constraint, still use `destination-research` first.

## Mode A: Destination Research

Goal: choose where to go.

Process:

1. Parse query: dates, duration, departure city, travelers, destination scope, preferences, exclusions, budget, flight constraints.
2. Read memory for visited places and recurring preferences. If memory is empty, say that visited-place filtering is limited.
3. Generate 6-10 candidates from multiple sources:
   - FlyAI travel-product search for feasible destinations.
   - Flight feasibility for top candidates where possible.
   - Web research for season/weather and unique natural features.
   - Xiaohongshu for real user validation when useful.
4. Score each candidate on a 0-100 scale.
5. Recommend the top 3 and explain tradeoffs.
6. Build a rough 2-hour itinerary grid for the top recommendation. Keep it high-level; it is for decision support, not final booking.

Destination score dimensions:

| Dimension | Weight | Notes |
|---|---:|---|
| Natural uniqueness | 20 | Distinctive landscapes, not generic sightseeing |
| Season fit | 15 | Weather, daylight, scenery state, closures |
| Flight feasibility | 15 | Direct/one-stop preference, total time, connection pain |
| Price reasonableness | 15 | Flight/hotel premium vs typical or observed alternatives |
| Difference from memory | 10 | Avoid places similar to visited destinations when memory exists |
| Route maturity | 10 | Whether a smooth 8-14 day route exists |
| Crowd/risk control | 10 | Holiday crowding, safety, weather disruptions |
| Evidence confidence | 5 | Quality of sources and live data |

Required score table columns:

```text
排名 | 目的地 | 综合分 | 自然独特性 | 季节匹配 | 航班可达 | 价格合理 | 差异化 | 路线成熟 | 风险控制 | 推荐理由 | 主要风险 | 证据
```

Required rough itinerary grid:

- Columns: dates.
- Rows: 2-hour blocks from `08:00-10:00` to `20:00-22:00`.
- Each cell: `地点｜做什么｜交通/耗时｜备注`.
- If exact flights are not selected, use placeholder cells like `上海出发｜飞行/转机｜待比价｜优先直飞或一次转机`.

After output, ask the user to pick one destination or ask for deeper comparison.

## Mode B: Itinerary Plan

Goal: build a detailed plan for a chosen destination.

Process:

1. Confirm destination and travel dates.
2. Research route variants first, not individual attractions immediately.
3. Score 2-4 route方案.
4. Select the best route, or ask user to choose if tradeoffs are close.
5. Build a detailed 2-hour itinerary grid.
6. Add concise supporting notes: flights, hotels/areas, budget confidence, booking checklist, risks.

Route score dimensions:

| Dimension | Weight |
|---|---:|
| Landscape density | 20 |
| Travel pace fit | 15 |
| Transport smoothness | 15 |
| Hotel/base convenience | 10 |
| Weather robustness | 10 |
| Cost control | 10 |
| Food/rest support | 5 |
| Community validation | 10 |
| Evidence confidence | 5 |

Required route score table columns:

```text
排名 | 路线方案 | 综合分 | 风光密度 | 节奏舒适 | 交通顺畅 | 住宿便利 | 天气弹性 | 成本控制 | 推荐理由 | 不适合点
```

Required detailed itinerary grid:

- Columns: each date in the trip.
- Rows: `08:00-10:00`, `10:00-12:00`, `12:00-14:00`, `14:00-16:00`, `16:00-18:00`, `18:00-20:00`, `20:00-22:00`.
- Cell format: `地点｜活动｜交通/耗时｜费用/预订｜备注`.
- Keep meals inside the relevant time block.
- Reserve buffers. Arrival/departure days should be lighter.
- Mark uncertain data with `待确认`.

## Output Contract

Always start with a compact assumption block:

```text
使用信息：...
缺失/假设：...
模式：destination-research 或 itinerary-plan
```

Then output exactly these primary sections:

1. `评分表`
2. `2小时日程表`
3. `下一步选择`

Optional supporting sections may follow:

- `证据与数据来源`
- `预算与价格可靠度`
- `风险与待确认`

Do not bury the two required tables below long prose.

## Persistence

When producing a substantial result, save artifacts under:

```text
workspace/outputs/<trip-id>/
├── query.md
├── result.md
├── score_table.json
├── itinerary_grid.json
└── sources/
```

Use `<trip-id>` like `2026-09-global-nature` or `2026-09-new-zealand`.

Do not overwrite existing output folders unless the user asks. If needed, append `-v2`.

## Quality Rules

- Prefer live/tool data for prices and availability.
- Mark every price as one of: `实查`, `参考`, `估算`.
- If memory lacks visited places, do not pretend to know them.
- If the user wants nature and novelty, penalize generic city-heavy destinations.
- For flight constraints, penalize routes requiring 2+ transfers unless exceptional.
- For long holidays, include crowd and price-premium risk.
- Keep the first answer decision-oriented. Deep hotel/restaurant detail belongs after the user chooses a destination or route.
