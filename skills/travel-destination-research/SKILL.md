---
name: travel-destination-research
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
/home/snowbolwer/travel-agent/
├── workspace/
│   ├── memory.md    # long-term user profile: visited places, preferences, constraints
│   ├── query.md     # current editable travel request
│   └── outputs/     # generated artifacts
└── toolkit/
    ├── fz/flyai-env # Feizhu/FlyAI wrapper
    └── xhs/         # Xiaohongshu MCP scripts/login state
```

Before researching:

1. Read `/home/snowbolwer/travel-agent/workspace/memory.md` if it exists.
2. Read `/home/snowbolwer/travel-agent/workspace/query.md` if it exists.
3. Merge those files with the user's latest prompt. The latest prompt wins.
4. If visited-place memory is missing, state that difference scoring is limited.

Do not use or maintain a `queries/` folder. If a run should be preserved, save a snapshot under `workspace/outputs/<trip-id>/query.md`.

## Tools

Use local tools when live evidence matters:

```bash
/home/snowbolwer/travel-agent/toolkit/fz/flyai-env fliggy-fast-search --query "上海出发 9月 自然风光 13天"
/home/snowbolwer/travel-agent/toolkit/fz/flyai-env search-flight --origin "上海" --destination "第比利斯" --dep-date 2026-09-25 --back-date 2026-10-07 --sort-type 3
mcporter call xiaohongshu-xpz.search_feeds --timeout 120000 --args '{"keyword":"格鲁吉亚 自然风光 攻略"}'
```

If Xiaohongshu MCP is unavailable, continue with other sources and mark community evidence as missing.

## Workflow

1. Parse the request: dates, duration, departure city, broad region, travelers, preferences, exclusions, budget, flight constraints.
2. Use memory to penalize destinations that are already visited or too similar to visited trips.
3. Create a destination seed and candidate pool:
   - If the user provides `seed`, reuse it exactly so the same request can reproduce the same candidate set.
   - If no seed is provided, generate a new short seed such as `202609-nature-A7K3`.
   - Build a broad candidate pool first, then use the seed to select and shuffle 5-8 destinations. A new seed should usually produce a different set of destinations while still respecting the request.
   - Always show the seed in the assumption block so the user can rerun or change it.
4. Gather detail evidence for every selected destination:
   - flight feasibility and rough price from FlyAI/Feizhu where possible.
   - hotel or stay-cost estimate from FlyAI/Feizhu where possible.
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

## Price Premium

Price premium compares the target trip cost against three other comparable date ranges.

For each destination:

1. Estimate target total travel cost:
   - round-trip flight price for the requested dates.
   - hotel price for the requested stay length, or nightly estimate multiplied by nights.
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

If flight or hotel data cannot be fetched, use `待查` or `估算`, and lower the evidence confidence in the summary. Do not invent exact prices.

## Detail Table

The detail table is descriptive, not scored. It must contain these exact destination rows that will also appear in the score table.

Required detail table columns:

```text
地点 | 自然特色 | 人文特色 | 季节天气 | 网络评价 | 航班数量 | 成本预算 | 价格溢价 | 飞行时间
```

Column guidance:

- `自然特色`: name concrete landscapes, such as mountains, lakes, deserts, glaciers, coastlines, canyons.
- `人文特色`: local culture, towns, food, history, architecture, festivals, road-trip texture.
- `季节天气`: describe weather fit and risks for the requested dates, including rainy season, closures, daylight, temperature, crowd.
- `网络评价`: summarize Xiaohongshu or web/community comments. Prefer 2-4 short paraphrased points; do not overquote.
- `航班数量`: describe observed number and quality of flight options from FlyAI/Feizhu, such as direct, one-stop, two-stop, sparse, frequent.
- `成本预算`: estimate total per-person or per-trip cost where possible. Mark as `实查`, `参考`, or `估算`.
- `价格溢价`: show target total, three-date reference average, absolute premium, and premium rate when data is available.
- `飞行时间`: describe shortest/typical flight duration and transfer burden.

## Score Table

Score each detail-table column from 0-10. The score table must use exactly the same destinations and order as the detail table.

Required score table columns:

```text
地点 | 自然特色 | 人文特色 | 季节天气 | 网络评价 | 航班数量 | 成本预算 | 价格溢价 | 飞行时间 | 总分 | 排名
```

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
/home/snowbolwer/travel-agent/workspace/outputs/<trip-id>/
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
