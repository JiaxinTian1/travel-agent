# Travel Planner App 🗺️

This is the web app for Travel Agent. It gives the trip organizer a visual board for destination research, planner tabs, itinerary editing, recommendations, and routes.

## Highlights ✨

- One fixed **researcher** tab for destination comparison.
- Multiple editable **planner** tabs for selected destinations.
- Query editor for the current trip request.
- Agent memory editor for durable preferences and constraints.
- Candidate pools for restaurants, hotels, attractions, and flights.
- Drag-and-drop 2-hour itinerary grid.
- Route calculation through the local agent runner.
- Mapbox or AMap/Gaode map background when configured, with a stable SVG route diagram fallback.

## Start 🚀

From the repository root:

```bash
node app/server.js
```

Open:

```text
http://127.0.0.1:8080/
```

## Optional Config ⚙️

Create local app config:

```bash
cp app/.env.example app/.env
```

Use it for model providers, Mapbox, AMap/Gaode, OpenRouteService, and toolkit settings. The app still opens without map or model config, but route display and recommendations will use fallback behavior.

## Data 🧠

- Current trip request: `workspace/query.md`
- Agent memory: `app/agent/memory.md`
- Local board state: `workspace/app-state/board.json`

`workspace/app-state/board.json` is local runtime state and should not be committed.
