---
name: travel-agent
description: >
  Use this skill when the user wants Codex to operate this repository's travel
  planning app: edit query or memory, run destination research, create/load
  planners, recommend hotels/restaurants/attractions/airports, import places,
  calculate map routes, or summarize the current board. Use the local server API
  instead of manually editing board state.
---

# Travel Agent App Operator

Operate the app through its local server. The app owns state and product logic.

## Repository

Default root:

```text
/home/snowbolwer/travel-agent
```

Important files:

```text
app/server.js
app/index.html
app/agent/runner.js
app/agent/modelRunner.js
app/agent/tools.js
app/agent/memory.md
workspace/query.md
workspace/app-state/board.json
```

## Server

Start server if needed:

```bash
cd /home/snowbolwer/travel-agent
node app/server.js
```

Health:

```bash
curl -sS http://127.0.0.1:8080/api/health
```

Useful fields:

- `llmEnabled`: model calls are configured.
- `googleServiceEnabled`: Google Maps backend key is loaded.
- `googleUsage.source`: `local`, `auto`, or `monitoring`.
- `googleUsage.monitoringConfigured`: Cloud Monitoring usage guard is available.
- `queryPath`: active query file.
- `memoryPath`: active memory file.

## State APIs

```bash
curl -sS http://127.0.0.1:8080/api/board
curl -sS http://127.0.0.1:8080/api/query
curl -sS http://127.0.0.1:8080/api/memory
```

Update query or memory:

```bash
curl -sS -X PUT http://127.0.0.1:8080/api/query \
  -H 'content-type: application/json' \
  --data '{"content":"..."}'

curl -sS -X PUT http://127.0.0.1:8080/api/memory \
  -H 'content-type: application/json' \
  --data '{"content":"..."}'
```

Memory is for durable user facts: visited places, lodging style, flight constraints,
pace, budget style, and food constraints. One-off trip requirements belong in query.

## Research

Run researcher reroll:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/research/reroll \
  -H 'content-type: application/json' \
  --data '{"query":"..."}'
```

The API writes `query` to `workspace/query.md`, reads current memory, updates
`workspace/app-state/board.json`, and returns the new researcher set.

## Planner

Create or load one planner for a researcher candidate:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/planners \
  -H 'content-type: application/json' \
  --data '{"destinationKey":"<candidate.plannerId-or-id>"}'
```

Recommend one item:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/planners/<planner-id>/recommend \
  -H 'content-type: application/json' \
  --data '{"category":"restaurants","prompt":"local traditional food"}'
```

Categories:

```text
restaurants | hotels | attractions | flights
```

Import a user-provided place or Google Maps URL into staging:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/planners/<planner-id>/import-place \
  -H 'content-type: application/json' \
  --data '{"query":"place name or maps URL","category":"restaurants"}'
```

## Routes

Calculate route for scheduled itinerary points:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/planners/<planner-id>/route \
  -H 'content-type: application/json' \
  --data '{}'
```

Route sources:

```text
google-routes | mapbox | amap | mixed-route | llm-agent | agent-runner-fallback
```

China planners prefer AMap. Overseas planners prefer Google Routes, then Mapbox.

## Tooling Rules

- Do not expose API keys or token values.
- Do not manually edit `workspace/app-state/board.json` unless repairing corrupt state.
- Do not commit `.env`, `toolkit/**/.env`, `workspace/app-state/`, or generated outputs.
- Prefer app APIs for query, memory, research, planner, recommendations, imports, and routes.
- For Google usage issues, run `./toolkit/google/google-usage`.
- For login state, run `./toolkit/login/login-status`.

## Reporting

When reporting results:

1. Say whether the API call succeeded.
2. For research, summarize top candidates and the active seed.
3. For planner creation, report planner id and destination.
4. For recommendations/imports, report item name, source, provider, confidence, and coordinates if relevant.
5. For routes, report source, summary, and whether real service geometry exists.
