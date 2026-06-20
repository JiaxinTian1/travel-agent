---
name: planner
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
    ├── xhs/         # Xiaohongshu MCP scripts/login state
    ├── airbnb/      # Airbnb MCP wrappers for homestay/apartment research
    └── booking/     # Booking.com MCP wrappers for overseas hotel research
```

Before planning:

1. Read `workspace/memory.md` if it exists.
2. Read `workspace/query.md` if it exists.
3. Merge those files with the user's latest prompt. The latest prompt wins.
4. Confirm the destination is fixed. If not fixed, use `researcher` instead.

## Tools

Use local tools when live evidence matters:

```bash
./toolkit/fz/flyai-env search-flight --origin "上海" --destination "第比利斯" --dep-date 2026-09-25 --back-date 2026-10-07 --sort-type 3
./toolkit/fz/flyai-env search-hotel --dest-name "第比利斯" --check-in-date 2026-09-25 --check-out-date 2026-09-27
./toolkit/booking/booking-search destination="Tbilisi" checkIn=2026-09-25 checkOut=2026-09-27 adults=2 rooms=1
./toolkit/airbnb/airbnb-search location="Tbilisi, Georgia" checkin=2026-09-25 checkout=2026-09-27 adults=2 propertyType=entire_home
mcporter call xiaohongshu-xpz.search_feeds --timeout 120000 --args '{"keyword":"格鲁吉亚 高加索 自驾 攻略"}'
```

If Xiaohongshu MCP is unavailable, continue with other sources and mark community evidence as missing.

Use Booking.com first for overseas hotel, aparthotel, room availability, cancellation-policy, price, and review evidence.

Use Airbnb first when the user prefers homestays, apartments, villas, kitchens/laundry, family stays, long stays, or local-neighborhood lodging.

Use FlyAI/Feizhu hotel data first for domestic/Chinese-market hotel research or when Booking/Airbnb evidence is unavailable.

Never call Booking.com transaction/account tools (`booking_book`, `booking_cancel_reservation`, `booking_get_reservations`, `booking_save_property`) during itinerary planning.

## Workflow

1. Parse fixed destination, dates, departure city/cities, return city/cities, travelers, pace, budget, transport preferences, must-see/must-avoid places, food preferences, lodging style, and route constraints.
   - Multiple origins such as `出发地 上海、北京、重庆` mean different travelers start separately.
   - Unless the user gives separate return cities, each traveler returns to their own origin city.
   - For multiple origins, plan separate inbound flights first, then start the shared itinerary only after all travelers have arrived at the meeting airport/city.
   - Plan separate outbound flights at the end when return cities differ.
2. Research route variants before choosing individual attractions.
3. For each route variant, identify practical bases/hotels and daily geographic clusters before filling time blocks.
4. Score 2-4 route options.
5. Pick the best route, or ask the user to choose if tradeoffs are close.
6. Produce a detailed 2-hour itinerary grid from 06:00 to 24:00.
7. Validate that each consecutive cell is geographically reachable within the time block, using route/map evidence when available. If no route API is available, mark travel times as `估算` and add a risk note.
8. Add concise support notes: flights, hotels/homestays/areas, restaurants, map route data, budget confidence, booking checklist, risks.

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
- Rows: `06:00-08:00`, `08:00-10:00`, `10:00-12:00`, `12:00-14:00`, `14:00-16:00`, `16:00-18:00`, `18:00-20:00`, `20:00-22:00`, `22:00-24:00`.
- Cell format: `当前地点｜做什么｜下一段交通/耗时｜费用/预订｜证据/备注`.
- Every cell must identify where the traveler is during that time block.
  - Meal blocks should use a concrete restaurant/cafe/market name, not just `午餐` or `晚餐`.
  - Late-night blocks should use a concrete hotel/homestay/base name or `航班/机场` when in transit.
  - Flight blocks should show flight route, departure/arrival airport, flight number if known, and whether the value is `实查`, `参考`, or `待确认`.
- The first shared itinerary block starts only after all travelers have reached the meeting city/airport. Before that, use separate per-origin cells inside the same date cell, such as `上海: ...; 北京: ...; 重庆: ...`.
- The last date must include separate outbound flights/airport transfers when travelers return to different cities.
- Arrival/departure days should be lighter and include airport transfer buffers.
- Reserve buffers for weather, transport, and rest.
- Mark uncertain data with `待确认`.
- Do not over-pack. A table that cannot be physically followed is invalid even if it contains attractive places.

## Route Feasibility

The itinerary must be executable, not just descriptive.

For each day:

1. Cluster attractions, meals, and lodging by geography before assigning time blocks.
2. Prefer routes where the day forms a practical chain, such as `hotel -> morning sight -> lunch -> afternoon sight -> dinner -> hotel`.
3. For every transition, estimate travel time and mode: walk, taxi, public transport, train, rental car, private driver, ferry, flight.
4. Add buffers:
   - city walking/taxi: at least 15-30 minutes beyond nominal route time.
   - intercity ground transfer: at least 30-60 minutes beyond nominal route time.
   - airport transfer/check-in: at least 2-3 hours before international flights unless local evidence says otherwise.
5. If route API/matrix evidence is available, use it for travel durations. If not, clearly mark `估算`.
6. Penalize any route variant that repeatedly requires backtracking, cross-city zigzags, or meal stops far from the current route.

## Map Output

When map or coordinate tooling is available, add a map-ready artifact:

```text
workspace/outputs/<trip-id>/map.geojson
workspace/outputs/<trip-id>/map.html
```

Map requirements:

- One marker per airport, hotel/base, restaurant, attraction, and transit terminal used in the itinerary.
- Markers must include: `name`, `type`, `date`, `time_block`, `address_or_area`, `source`, and `confidence`.
- Draw daily route lines in itinerary order.
- If exact coordinates cannot be fetched, use approximate coordinates and mark confidence as `low`.
- The map must match the itinerary table; do not include unused points.

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
- `民宿/酒店候选`
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
├── route_points.json
├── map.geojson
├── map.html
└── sources/
```

Use `<trip-id>` like `2026-09-georgia-caucasus` or append `-v2` if the folder already exists.

## Quality Rules

- Do not compare unrelated countries here; that belongs to destination research.
- Prefer live/tool data for prices and availability.
- Mark every price as `实查`, `参考`, or `估算`.
- Make the itinerary executable, but do not bury the two required tables below long prose.
- If the destination is too broad, first score route variants inside the chosen country/region.
- A meal cell without a restaurant/market/cafe name is incomplete unless food data is unavailable and marked `待查`.
- A sleep/rest cell without a hotel/base name is incomplete unless lodging has not been selected and marked `待选`.
- A transition without a travel mode and duration is incomplete unless route data is unavailable and marked `待查`.
