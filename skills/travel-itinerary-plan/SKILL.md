---
name: travel-itinerary-plan
description: >
  Use this skill only after the user has chosen a specific destination, country,
  region, city, or route and wants a detailed travel plan. This skill compares route
  variants and produces a detailed 2-hour itinerary grid. Do not use for open-ended
  "where should I go" destination selection.
---

# Travel Itinerary Plan

Use this skill after the user has selected a destination and wants an executable trip plan.

## Workspace

Default project root:

```text
.
├── workspace/
│   ├── memory.md    # long-term user profile: visited places, preferences, constraints
│   ├── query.md     # current editable travel request
│   └── outputs/     # generated artifacts
└── toolkit/
    ├── fz/flyai-env # Feizhu/FlyAI wrapper
    └── xhs/         # Xiaohongshu MCP scripts/login state
```

Before planning:

1. Read `workspace/memory.md` if it exists.
2. Read `workspace/query.md` if it exists.
3. Merge those files with the user's latest prompt. The latest prompt wins.
4. Confirm the destination is fixed. If not fixed, use `travel-destination-research` instead.

## Tools

Use local tools when live evidence matters:

```bash
./toolkit/fz/flyai-env search-flight --origin "上海" --destination "第比利斯" --dep-date 2026-09-25 --back-date 2026-10-07 --sort-type 3
./toolkit/fz/flyai-env search-hotel --dest-name "第比利斯" --check-in-date 2026-09-25 --check-out-date 2026-09-27
mcporter call xiaohongshu-xpz.search_feeds --timeout 120000 --args '{"keyword":"格鲁吉亚 高加索 自驾 攻略"}'
```

If Xiaohongshu MCP is unavailable, continue with other sources and mark community evidence as missing.

## Workflow

1. Parse fixed destination, dates, departure city, travelers, pace, budget, transport preferences, must-see/must-avoid places.
2. Research route variants before choosing individual attractions.
3. Score 2-4 route options.
4. Pick the best route, or ask the user to choose if tradeoffs are close.
5. Produce a detailed 2-hour itinerary grid.
6. Add concise support notes: flights, hotels/areas, budget confidence, booking checklist, risks.

## Route Scoring

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

## Itinerary Grid

Required grid:

- Columns: each trip date.
- Rows: `08:00-10:00`, `10:00-12:00`, `12:00-14:00`, `14:00-16:00`, `16:00-18:00`, `18:00-20:00`, `20:00-22:00`.
- Cell format: `地点｜活动｜交通/耗时｜费用/预订｜备注`.
- Keep meals inside the relevant time block.
- Arrival/departure days should be lighter.
- Reserve buffers for weather, transport, and rest.
- Mark uncertain data with `待确认`.

## Output Contract

Start with a compact assumption block:

```text
使用信息：...
缺失/假设：...
模式：itinerary-plan
```

Then output these sections in order:

1. `路线评分表`
2. `2小时日程表`
3. `下一步选择`

Optional supporting sections may follow:

- `航班与交通`
- `住宿区域`
- `预算与价格可靠度`
- `风险与待确认`
- `证据与数据来源`

## Persistence

For substantial results, save artifacts under:

```text
workspace/outputs/<trip-id>/
├── query.md
├── result.md
├── route_score_table.json
├── itinerary_grid.json
└── sources/
```

Use `<trip-id>` like `2026-09-georgia-caucasus` or append `-v2` if the folder already exists.

## Quality Rules

- Do not compare unrelated countries here; that belongs to destination research.
- Prefer live/tool data for prices and availability.
- Mark every price as `实查`, `参考`, or `估算`.
- Make the itinerary executable, but do not bury the two required tables below long prose.
- If the destination is too broad, first score route variants inside the chosen country/region.
