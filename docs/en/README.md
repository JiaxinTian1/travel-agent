# Travel Agent

<p>
  <a href="README.md"><strong>English</strong></a>
  &nbsp;|&nbsp;
  <a href="../zh/README.md"><strong>中文</strong></a>
  &nbsp;|&nbsp;
  <a href="../index.html"><strong>Docs</strong></a>
</p>

Travel Agent is a local-first travel planning app controlled by a lightweight agent runner. It keeps research, planner tabs, candidate places, itinerary cells, and routes as editable app state.

## Product Flow

```text
workspace/query.md + app/agent/memory.md
  -> researcher tab
  -> planner tabs
  -> editable itinerary grid
  -> route map
```

## Main Components

| Area | Path | Purpose |
|---|---|---|
| Web app | `app/index.html` | Researcher tab, planner tabs, drag/drop itinerary, map route view |
| Server | `app/server.js` | Local API for board state, query, memory, research, planner actions |
| Agent runner | `app/agent/` | Model calls, tool routing, recommendation logic, memory store |
| Toolkit adapters | `app/toolkit/` | JS adapters for Booking, Airbnb, FlyAI, Xiaohongshu, Google, Mapbox, AMap |
| Shell wrappers | `toolkit/` | CLI wrappers and login helpers for external tools |
| Skills | `skills/` | Codex-facing workflows for researcher, planner, and app operation |
| Runtime workspace | `workspace/` | Editable query and local app state |

## Start

```bash
cd /home/snowbolwer/travel-agent
node app/server.js
```

Open:

```text
http://127.0.0.1:8080/
```

## Install And Login

```bash
./install.sh --doctor
./install.sh --install-gcloud
./toolkit/login/login-status
./toolkit/login/login-all
```

`login-all` covers Google Monitoring login and Xiaohongshu login. Booking and Airbnb anonymous search do not need account login.

## Google Maps

Google is the primary global source for Places and Routes. The app checks Cloud Monitoring before Google API calls when configured:

```env
GOOGLE_USAGE_SOURCE=monitoring
GOOGLE_CLOUD_PROJECT_ID=your-project-id
```

Login with user ADC:

```bash
./toolkit/google/google-login
./toolkit/google/google-usage
```

## Toolkit Rules

- Google Places: primary source for overseas restaurants, attractions, hotels coordinates, and import-place resolution.
- Google Routes: primary overseas route provider.
- AMap/Gaode: primary map and route provider for mainland China planners.
- Mapbox: global map rendering and route fallback.
- Booking: overseas hotel price/availability/review research.
- Airbnb: homestays, apartments, villas, kitchens/laundry, family stays, and long stays.
- FlyAI/Fliggy: flights, China-market hotels, and domestic POI/product search.
- Xiaohongshu: social/community evidence when the MCP service is logged in and available.

## Local State

Do not commit these files:

```text
app/.env
toolkit/**/.env
workspace/app-state/
workspace/outputs/
```

Important editable files:

```text
workspace/query.md       # current trip request
app/agent/memory.md      # durable travel memory
```

## More

- [Command reference](commands.md)
- [Current integration status](status.md)
- [Google toolkit](toolkit/google.md)
- [Booking toolkit](toolkit/booking.md)
- [Airbnb toolkit](toolkit/airbnb.md)
- [FlyAI toolkit](toolkit/fz.md)
