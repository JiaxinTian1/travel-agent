# Integration Status

## App

- Local server: `node app/server.js`
- Health endpoint: `http://127.0.0.1:8080/api/health`
- Board state: `workspace/app-state/board.json`
- Query: `workspace/query.md`
- Memory: `app/agent/memory.md`

## Google Maps

Status: working.

- Places Search: primary overseas restaurant/attraction/hotel coordinate source.
- Routes: primary overseas route provider.
- Cloud Monitoring usage guard: working through gcloud ADC.
- Current usage can be checked with `./toolkit/google/google-usage`.

Expected health fields:

```text
googleServiceEnabled: true
googleUsage.source: monitoring
googleUsage.monitoringConfigured: true
```

## Map Rendering

- Mapbox remains the primary browser map renderer for global maps.
- AMap/Gaode is kept for China planners.
- SVG route diagram remains a fallback when map tokens or browser map tiles fail.

## Booking

Status: integrated as read-only hotel research.

- Wrapper package: `@striderlabs/mcp-booking`
- Use for overseas hotels, aparthotels, prices, availability, cancellation policy, and reviews.
- Booking/account transaction tools are intentionally not exposed.

## Airbnb

Status: integrated for homestay-style lodging research.

- Wrapper package: `@openbnb/mcp-server-airbnb`
- Use for apartments, villas, kitchens/laundry, family stays, long stays, and local-neighborhood lodging.

## FlyAI / Fliggy

Status: integrated through CLI wrapper.

- Use for flights, domestic/China-market hotels, POIs, and fast travel product search.
- Config lives in `toolkit/fz/.env`.

## Xiaohongshu

Status: available when MCP service and login state are healthy.

- Start: `./toolkit/xhs/xhs-mcp-start`
- Status: `./toolkit/xhs/xhs-mcp-status`
- Login helper: `./toolkit/xhs/xhs-login-watch`
- MCP registration: `xiaohongshu-xpz`

The platform may still require QR/security confirmation or throttle searches.

## Repository Layout

- User-facing docs live under `docs/en` and `docs/zh`.
- Generated reports and transient route results stay out of the committed baseline.
