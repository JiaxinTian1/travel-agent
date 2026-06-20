# Travel Agent ✈️

<p>
  <a href="README.md"><strong>English</strong></a>
  &nbsp;|&nbsp;
  <a href="docs/zh/README.md"><strong>中文</strong></a>
  &nbsp;|&nbsp;
  <a href="docs/index.html"><strong>Docs</strong></a>
</p>

Travel Agent is an agent-driven travel planning workspace. It helps a trip organizer move from "where should we go?" to an editable route board with candidate destinations, planner tabs, lodging/food/place recommendations, and route visualization.

## What It Does 🌍

- **Destination research**: compare possible destinations when the trip is still open.
- **Personalized planning**: use editable query and memory files to reflect user preferences, visited places, lodging style, flight constraints, and budget signals.
- **Planner boards**: generate one planner per selected destination and keep multiple plans editable.
- **Drag-and-drop itinerary**: organize flights, hotels, restaurants, and attractions into a 2-hour schedule grid.
- **Agent tools**: connect model-driven decisions to Booking, Airbnb, Xiaohongshu, FlyAI/Fliggy, and OpenRouteService wrappers.
- **Route view**: calculate routes with OpenRouteService and display a stable route diagram without relying on fragile map tiles.
- **Codex-ready skill**: includes a thin `travel-agent` skill so Codex can operate the app through the server API.

## Why It Is Different 🧭

Most travel planners stop at text. This project keeps the plan as editable state:

- `query` is the current trip request.
- `memory` is durable user preference.
- `researcher` chooses destinations.
- `planner` turns a selected destination into an editable board.
- the app state can be used by both the web UI and Codex.

## Start 🚀

From the repository root:

```bash
node app/server.js
```

Open:

```text
http://127.0.0.1:8080/
```

Optional setup:

```bash
cp app/.env.example app/.env
```

Fill `app/.env` if you want model calls, OpenRouteService routes, or toolkit-specific keys.

## Install Helpers 🛠️

Optional live-data dependencies can be checked or installed with:

```bash
./install.sh
./install.sh --doctor
```

## Project Shape 📁

```text
app/        web UI, local server, agent runner, toolkit functions
skills/     Codex skills for operating the travel workflow
toolkit/    external data wrappers
workspace/  editable query, local state, generated outputs
docs/       extra documentation
```

## Status 🧪

This is an active local-first prototype. The main product path is:

```text
query + memory -> researcher -> planner -> editable itinerary -> route view
```
