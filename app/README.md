# Travel Agent App

This folder contains the local web app and server.

## Files

```text
index.html        browser UI
server.js         local HTTP API and static file server
agent/            runner, model integration, memory store, tool registry
toolkit/          JS adapters for external data providers
schema/           board/researcher/planner JSON schemas
data/             sample board state
```

## Start

```bash
node app/server.js
```

Open:

```text
http://127.0.0.1:8080/
```

## Config

Copy and edit:

```bash
cp app/.env.example app/.env
```

Useful provider groups:

- LLM: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
- Google: `GOOGLE_MAPS_API_KEY`, `GOOGLE_USAGE_SOURCE`, `GOOGLE_CLOUD_PROJECT_ID`
- Mapbox: `MAPBOX_ACCESS_TOKEN`
- AMap/Gaode: `AMAP_MAPS_API_KEY`, `AMAP_JS_API_KEY`
- Toolkit timeouts and wrapper settings

## Runtime State

```text
workspace/query.md
app/agent/memory.md
workspace/app-state/board.json
workspace/app-state/google-usage.json
```

Do not commit `.env` or `workspace/app-state/`.
