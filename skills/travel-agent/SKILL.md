---
name: travel-agent
description: >
  Use this skill when the user wants Codex to operate this repository's travel
  agent app, including editing query or memory, running destination research,
  creating/loading planners, recommending hotels/restaurants/attractions/flights,
  calculating map routes, or summarizing the current travel board. This skill
  uses the local app server API instead of manually editing board state.
---

# Travel Agent App Operator

Use this skill to operate the travel-agent repository through its local app server.
The app owns the product logic; this skill is only the Codex operating guide.

## Repository

Default root:

```text
/home/snowbolwer/travel-agent
```

If the current working directory is different, locate the repo before running commands.

Important files:

```text
app/server.js                  # local HTTP server
app/agent/runner.js            # app runner
app/agent/modelRunner.js       # optional LLM model runner
app/agent/tools.js             # agent function registry
app/toolkit/*.js               # JS wrappers around toolkit commands
app/agent/memory.md            # agent memory
workspace/query.md             # current editable user query
workspace/app-state/board.json # local board state, git-ignored
```

## Server

Prefer API calls over direct file edits.

Start server when it is not running:

```bash
cd /home/snowbolwer/travel-agent
node app/server.js
```

Health check:

```bash
curl -sS http://127.0.0.1:8080/api/health
```

Useful fields:

- `llmEnabled`: model key/config was loaded.
- `model`: active model name.
- `orsEnabled`: OpenRouteService key/config was loaded.
- `queryPath`: query file used by the server.
- `memoryPath`: memory file used by the server.

## State APIs

Read board:

```bash
curl -sS http://127.0.0.1:8080/api/board
```

Read/update current query:

```bash
curl -sS http://127.0.0.1:8080/api/query
curl -sS -X PUT http://127.0.0.1:8080/api/query \
  -H 'content-type: application/json' \
  --data '{"content":"..."}'
```

Read/update agent memory:

```bash
curl -sS http://127.0.0.1:8080/api/memory
curl -sS -X PUT http://127.0.0.1:8080/api/memory \
  -H 'content-type: application/json' \
  --data '{"content":"..."}'
curl -sS -X POST http://127.0.0.1:8080/api/memory/update \
  -H 'content-type: application/json' \
  --data '{"note":"..."}'
```

Memory is for durable user facts: visited places, lodging preferences, flight
constraints, pace, budget style, food constraints. Do not store one-off query
details in memory unless the user says they are durable preferences.

## Research

Run destination research reroll:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/research/reroll \
  -H 'content-type: application/json' \
  --data '{"query":"..."}'
```

Behavior:

- If `query` is provided, the server writes it to `workspace/query.md` before running.
- Runner receives current query and `app/agent/memory.md`.
- Result is written to `workspace/app-state/board.json`.
- Summarize the new researcher set from the returned JSON or `/api/board`.

## Planner

Create or load one planner for a researcher candidate:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/planners \
  -H 'content-type: application/json' \
  --data '{"destinationKey":"planner_seed_destination-id"}'
```

Use `candidate.plannerId`, `candidate.id`, or a stable planner id from the board.
If a planner already exists, the API loads it instead of creating a duplicate.

Recommend one item in a planner:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/planners/<planner-id>/recommend \
  -H 'content-type: application/json' \
  --data '{"category":"hotels"}'
```

Categories:

```text
restaurants | hotels | attractions | flights
```

With a working model config, this route can call model-selected agent functions.
Without a working model or if a tool fails, runner returns fallback candidates.

## Map Routes

Calculate route for the current itinerary:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/planners/<planner-id>/route \
  -H 'content-type: application/json' \
  --data '{}'
```

Expected route fields:

- `route.source`: `openrouteservice`, `openrouteservice-fallback`, `llm-agent`, or `agent-runner-fallback`.
- `route.summary`: distance/time or fallback note.
- `route.geometry`: GeoJSON `LineString` for map drawing when available.

If `orsEnabled` is true but route source is fallback, inspect `route.error`.
Common causes: coordinates are approximate, too far from roads, or the itinerary
contains repeated/placeholder points.

## Output Guidance

When reporting back to the user:

1. State whether the server/API call succeeded.
2. For research, summarize top candidates and mention the active seed.
3. For planner, summarize created/loaded planner id and destination.
4. For recommendations, report the item name, type, source, and confidence.
5. For routes, report route source, summary, and whether real ORS geometry exists.

Do not dump full `board.json` unless the user asks.

## Rules

- Do not manually edit `workspace/app-state/board.json` unless repairing corrupt state.
- Do not commit `.env` or `workspace/app-state/board.json`.
- Do not expose API keys in output.
- Prefer API calls to direct edits for query, memory, research, planner, recommendations, and routes.
- If the local app server is unavailable, start it before using app APIs.
