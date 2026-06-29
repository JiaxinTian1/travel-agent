---
name: researcher
description: >
  Use this skill when the user is unsure where to travel, gives broad destination
  scope such as global/Europe/Asia, asks "where should I go", or wants multiple
  destinations compared. This skill only selects and ranks destinations. It must
  not create a detailed 2-hour itinerary grid; detailed planning happens after
  the user chooses one destination.
---

# Travel Destination Research

Use this skill to help the user choose a destination before detailed trip planning.

## Workspace

Default project root:

```text
.
├── workspace/
│   ├── query.md     # current editable travel request
│   └── outputs/     # generated artifacts
├── app/agent/memory.md # long-term user profile: visited places, preferences, constraints
└── toolkit/
    ├── fz/flyai-env # Feizhu/FlyAI wrapper
    ├── xhs/         # Xiaohongshu MCP scripts/login state
    ├── airbnb/      # Airbnb MCP wrappers for homestay/apartment research
    ├── booking/     # Booking.com MCP wrappers for overseas hotel research
    └── google/      # Google Places/Routes wrappers and usage guard
```

Before researching:

1. Read `app/agent/memory.md` if it exists.
2. Read `workspace/query.md` if it exists.
3. Merge those files with the user's latest prompt. The latest prompt wins.
4. If visited-place memory is missing, state that difference scoring is limited.

Do not use or maintain a `queries/` folder. If a run should be preserved, save a snapshot under `workspace/outputs/<trip-id>/query.md`.

## Tools

Use local tools when live evidence matters:

```bash
./toolkit/fz/flyai-env fliggy-fast-search --query "上海出发 9月 自然风光 13天"
./toolkit/fz/flyai-env search-flight --origin "上海" --destination "第比利斯" --dep-date 2026-09-25 --back-date 2026-10-07 --sort-type 3
./toolkit/booking/booking-search destination="Tbilisi" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
./toolkit/airbnb/airbnb-search location="Tbilisi, Georgia" checkin=2026-09-25 checkout=2026-10-07 adults=2 propertyType=entire_home
mcporter call xiaohongshu-xpz.search_feeds --timeout 120000 --args '{"keyword":"格鲁吉亚 自然风光 攻略"}'
```

If Xiaohongshu MCP is unavailable, continue with other sources and mark community evidence as missing.

Use Booking.com first for overseas hotel, aparthotel, room availability, cancellation-policy, price, and review evidence.

Use Airbnb first when the user prefers homestays, apartments, villas, kitchens/laundry, family stays, long stays, or local-neighborhood lodging.

Use FlyAI/Feizhu hotel data first for domestic/Chinese-market hotel research or when Booking/Airbnb evidence is unavailable.

Use Google Places for overseas POI/restaurant/hotel coordinate checks and imported place validation. Google calls are guarded by `./toolkit/google/google-usage` when Monitoring is configured.

Never call Booking.com transaction/account tools (`booking_book`, `booking_cancel_reservation`, `booking_get_reservations`, `booking_save_property`) during destination research.

## Workflow

1. Parse the request: dates, duration, departure city/cities, return city/cities, broad region, travelers, preferences, exclusions, budget, flight constraints.
   - Multiple origins such as `出发地 上海、北京、深圳` mean different travelers start separately and must each fly to the same candidate destination.
   - Unless the user gives separate return cities, each traveler returns to their own origin city.
   - If return cities are given, pair them by order with origins: origin 1 returns to return city 1, etc. If counts differ, state the assumption and use each origin as its own return city.
2. Use memory to penalize destinations that are already visited or too similar to visited trips.
3. Create a destination seed and candidate pool:
   - If the user provides `seed`, reuse it exactly so the same request can reproduce the same candidate set.
   - If no seed is provided, generate a new short seed such as `202609-nature-A7K3`.
   - Build a broad candidate pool first, then use the seed to select and shuffle 5-8 destinations. A new seed should usually produce a different set of destinations while still respecting the request.
   - For global or open-ended requests, use the global stratified sampling rules below. Do not repeatedly select destinations from previous runs just because they already have cached evidence.
   - Always show the seed in the assumption block so the user can rerun or change it.
4. Gather detail evidence for every selected destination:
   - flight feasibility and rough price from FlyAI/Feizhu where possible.
   - For multiple origins, search each origin-destination-origin round trip separately and keep per-origin evidence. Do not collapse flight evidence before the detail table.
   - hotel or stay-cost estimate. For overseas hotels, use Booking.com first where possible.
   - Airbnb homestay/apartment availability and nightly price when the user prefers homestays or the destination is better served by apartment/villa stays.
   - price premium versus three comparable alternative date ranges.
   - season and weather suitability.
   - distinctive natural features.
   - human/cultural features.
   - holiday crowd and disruption risks.
   - Xiaohongshu/community validation when useful.
5. Output a detail table first. It is evidence-heavy and descriptive.
6. Output a score table second. It must use the exact same destinations as the detail table.
7. Add a concise summary comment after both tables.
8. Ask the user to choose a destination, reroll with a new seed, reuse the same seed with changed constraints, or request more candidates.

## Candidate Seed

The destination set should not be identical every run unless the user asks to reuse a seed.

Seed behavior:

- `seed: same-value` => same candidates and order, unless live availability removes a destination.
- no seed => generate a new seed and vary candidates.
- `换一批` / `reroll` => generate a new seed and keep the same query constraints.

Use the seed only for candidate selection and ordering. Do not randomize factual evidence or scores.

## Global Candidate Sampling

When the query scope is `全球`, `不限`, `不知道去哪`, or otherwise open-ended, candidate generation must be intentionally broad before live evidence is gathered.

Use this process:

1. Build a longlist of at least 24 destinations before selecting finalists.
2. Cover at least 5 world regions in the longlist when the user did not restrict the region:
   - Central Asia / Caucasus
   - South Asia / Himalaya
   - Southeast Asia / islands
   - Europe
   - Middle East / North Africa
   - Sub-Saharan Africa
   - Oceania / Pacific
   - Latin America
3. Cover at least 5 landscape types when the user asks for nature:
   - mountains / glaciers
   - lakes / fjords / coast
   - desert / canyon
   - rainforest / volcano
   - island / reef
   - grassland / steppe
4. Use the seed to select 6-8 finalists from different region/landscape buckets. Unless the user asks for a narrow theme, avoid more than 2 finalists from the same world region and avoid more than 2 finalists with the same primary landscape type.
5. Then apply hard exclusions from memory and query, such as already visited countries, visa impossibility if known, severe season mismatch, or no reasonable flight path.
6. If a selected destination is removed after evidence lookup, replace it with the next seeded destination from a different bucket, not with a destination from the previous report.
7. Record the selected seed, longlist size, and bucket coverage in the report assumptions or data-source notes.

Do not treat previous outputs as the default candidate pool. Previous destinations may appear again only if the seed selects them from the longlist and they still fit the constraints.

Example global nature longlist buckets, to be expanded or adapted per query:

```text
Central Asia / Caucasus: Almaty + Kolsai, Kyrgyzstan Issyk-Kul + Ala Archa, Georgia Kazbegi, Armenia Dilijan + Tatev
South Asia / Himalaya: Nepal Pokhara + Annapurna foothills, Sri Lanka hill country + south coast, Ladakh, Bhutan valleys
Southeast Asia / islands: Sabah Borneo, Flores + Komodo, Lombok + Rinjani, Palawan, Laos north
Europe: Slovenia Julian Alps, Norway Lofoten, Madeira, Azores, Faroe Islands, Albania Alps, Montenegro Durmitor
Middle East / North Africa: Morocco Atlas + Sahara, Oman Jebel Akhdar + wadis, Jordan Wadi Rum + Dana, Tunisia desert oases
Sub-Saharan Africa: Kenya Rift Valley, Tanzania Kilimanjaro foothills + Zanzibar, Namibia Sossusvlei, Madagascar highlands + coast
Oceania / Pacific: New Zealand South Island, Fiji outer islands, Samoa, Tasmania, New Caledonia
Latin America: Peru Sacred Valley, Chile Atacama, Argentina Patagonia, Colombia coffee region + Cocora, Costa Rica volcano + cloud forest, Guatemala Atitlan + volcanoes
```

## Price Premium

Price premium compares the target trip cost against three other comparable date ranges.

For each destination:

1. Estimate target total travel cost:
   - round-trip flight price for the requested dates.
   - For multiple origins, compute one flight target cost and one flight premium per origin/return pair.
   - lodging price for the requested stay length. Use Booking.com prices first for overseas hotels, FlyAI/Feizhu first for domestic/Chinese-market hotels, and Airbnb first when the user prefers homestays/apartments/villas.
2. Select three comparison date ranges with the same trip length. Prefer dates outside the target holiday peak and roughly near the requested season, for example:
   - one range 3-5 weeks before.
   - one range 3-5 weeks after.
   - one range 8-12 weeks away.
3. Estimate each comparison total cost using the same method.
4. Compute:

```text
reference_average = average(comparison_total_1, comparison_total_2, comparison_total_3)
price_premium = target_total - reference_average
price_premium_rate = price_premium / reference_average
```

For multiple origins:

- Detail table must show each origin's target flight price, available route quality, flight premium, and flight duration.
- Lodging cost is shared at the destination level unless the travelers need separate rooms/homes.
- Aggregated destination cost should show both `per-origin flight subtotal` and `group total = sum(all travelers' flights) + lodging`.
- Aggregated premium should summarize the worst origin, best origin, and average/total premium if data is available.

If flight or hotel data cannot be fetched, use `待查` or `估算`, and lower the evidence confidence in the summary. Do not invent exact prices.

## Detail Table

The detail table is descriptive, not scored. It must contain these exact destination rows that will also appear in the score table.

Required detail table columns:

```text
地点 | 自然特色 | 人文特色 | 季节天气 | 网络评价 | 航班数量 | 成本预算 | 价格溢价 | 飞行时间
```

If there are multiple origins, use these columns instead:

```text
地点 | 自然特色 | 人文特色 | 季节天气 | 网络评价 | 各出发地航班数量 | 各出发地成本预算 | 各出发地价格溢价 | 各出发地飞行时间
```

Column guidance:

- `自然特色`: name concrete landscapes, such as mountains, lakes, deserts, glaciers, coastlines, canyons.
- `人文特色`: local culture, towns, food, history, architecture, festivals, road-trip texture.
- `季节天气`: describe weather fit and risks for the requested dates, including rainy season, closures, daylight, temperature, crowd.
- `网络评价`: summarize Xiaohongshu or web/community comments. Prefer 2-4 short paraphrased points; do not overquote.
- `航班数量` / `各出发地航班数量`: describe observed number and quality of flight options from FlyAI/Feizhu, such as direct, one-stop, two-stop, sparse, frequent. For multiple origins, include one line per origin like `上海: ...; 北京: ...; 深圳: ...`.
- `成本预算` / `各出发地成本预算`: estimate total per-person or per-trip cost where possible. For multiple origins, show each origin's flight cost and the shared lodging estimate, then show group total. Mark as `实查`, `参考`, or `估算`.
- `价格溢价` / `各出发地价格溢价`: show target total, three-date reference average, absolute premium, and premium rate when data is available. For multiple origins, show each origin separately, then summarize group-level premium.
- `飞行时间` / `各出发地飞行时间`: describe shortest/typical flight duration and transfer burden. For multiple origins, list each origin separately.

When Airbnb is used, mention property type, rough nightly price/range, and whether listings are concentrated near useful bases. Do not treat Airbnb availability as guaranteed inventory; mark it as `实查` only for the query moment.

When Booking.com is used, mention hotel/property type, rough total price or nightly range, review score/count if returned, cancellation-policy signals if available, and whether listings are concentrated near useful bases. Treat availability as query-time evidence, not guaranteed inventory.

## Score Table

Score each detail-table column from 0-10. The score table must use exactly the same destinations and order as the detail table.

Required score table columns:

```text
地点 | 自然特色 | 人文特色 | 季节天气 | 网络评价 | 航班数量 | 成本预算 | 价格溢价 | 飞行时间 | 总分 | 排名
```

For multiple origins, keep the score table columns above. `航班数量`, `成本预算`, `价格溢价`, and `飞行时间` are aggregated scores across all origins:

- Use the weakest origin as the floor: a destination should not score high if one traveler has no reasonable route or severe premium.
- Prefer average score only when all origins are broadly comparable.
- Mention the limiting origin in the summary, e.g. `北京出发拖低航班分` or `深圳出发成本溢价最高`.

Scoring rules:

- `自然特色`: higher means more distinctive and aligned with the user's nature preference.
- `人文特色`: higher means more distinctive and additive without overwhelming the nature focus.
- `季节天气`: higher means better weather/season fit and fewer closures.
- `网络评价`: higher means stronger user/community validation and fewer repeated complaints.
- `航班数量`: higher means more direct/one-stop options, better schedules, and less fragility.
- `成本预算`: inverse score. Lower cost and better value score higher; expensive destinations score lower.
- `价格溢价`: inverse score. Lower premium or discount scores higher; high holiday premium scores lower.
- `飞行时间`: inverse score. Shorter and simpler trips score higher; long multi-transfer trips score lower.

Default total score:

```text
总分 = average(8 column scores) * 10
```

If the user gives explicit weights, apply them and show the weights in the summary.

## Output Contract

Start with a compact assumption block:

```text
使用信息：...
缺失/假设：...
模式：destination-research
```

Then output these sections in order:

1. `细节表`
2. `评分表`
3. `下一步选择`
4. `总结评论`

Do not output a full 2-hour itinerary grid in this skill. The user has not chosen a destination yet.

Optional supporting sections may follow:

- `证据与数据来源`
- `预算与价格可靠度`
- `风险与待确认`

## Persistence

For substantial results, save artifacts under:

```text
workspace/outputs/<trip-id>/
├── query.md
├── result.md
├── detail_table.json
├── score_table.json
└── sources/
```

Use `<trip-id>` like `2026-09-global-nature` or append `-v2` if the folder already exists.

## Quality Rules

- Keep the first answer decision-oriented.
- Penalize generic city-heavy trips when the user asks for nature and novelty.
- Do not pretend to know visited places if memory is empty.
- Do not over-plan a destination before the user chooses it.
- Ensure `细节表` and `评分表` contain exactly the same destinations.
- End by asking for a destination choice, a new seed/reroll, or a constraint change.
