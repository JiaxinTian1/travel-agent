# Airbnb MCP Toolkit

This folder wraps `openbnb-org/mcp-server-airbnb` for travel research.

The MCP server is not vendored into this repository. Wrappers run it through:

```bash
npx -y @openbnb/mcp-server-airbnb
```

The server exposes:

- `airbnb_search`: search listings by location, dates, guests, price, and property type.
- `airbnb_listing_details`: fetch details for a listing id.

## Requirements

- Linux Node.js 18+
- `npx`
- Network access for npm package download and Airbnb queries

In WSL, prefer installing Node inside Linux. Windows npm shims may fail.

## Config

Copy `.env.example` to `.env` only when you need local overrides:

```bash
cp toolkit/airbnb/.env.example toolkit/airbnb/.env
```

Defaults:

- `AIRBNB_IGNORE_ROBOTS=true`: bypass robots.txt so live search calls return data.
- `DISABLE_GEOCODING=false`: allow Photon/Nominatim geocoding for international locations.

Set `AIRBNB_IGNORE_ROBOTS=false` in `.env` if you want strict robots.txt compliance.

## Commands

List tool schemas:

```bash
./toolkit/airbnb/airbnb-mcp-list
```

Search homes:

```bash
./toolkit/airbnb/airbnb-search location="Tbilisi, Georgia" checkin=2026-09-25 checkout=2026-10-07 adults=2 propertyType=entire_home
```

Get details:

```bash
./toolkit/airbnb/airbnb-details id=12345678 checkin=2026-09-25 checkout=2026-10-07 adults=2
```

## Travel Skill Usage

Use Airbnb only when the user prefers homestays, apartments, villas, family stays, long stays, kitchens/laundry, or local-neighborhood lodging. For ordinary hotel preference, use FlyAI/Feizhu hotel search first.
