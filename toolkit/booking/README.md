# Booking.com MCP Toolkit

This folder wraps `markswendsen-code/mcp-booking`, published as `@striderlabs/mcp-booking`, for anonymous international hotel research.

The MCP server is not vendored into this repository. Wrappers run it through:

```bash
npx -y @striderlabs/mcp-booking
```

## Scope

Default travel research uses only read-only hotel tools:

- `booking_search`
- `booking_get_property`
- `booking_check_availability`
- `booking_get_prices`
- `booking_get_reviews`

Do not use booking or cancellation tools from automated research flows:

- `booking_book`
- `booking_cancel_reservation`
- `booking_get_reservations`
- `booking_save_property`

Those tools involve account state or transactions and require explicit manual handling.

## Requirements

- Linux Node.js 18+
- `npx`
- `mcporter`
- Playwright Chromium when the package requires a local browser
- Network access for npm package download and Booking.com queries

Install Chromium if needed:

```bash
npx playwright install chromium
```

## Config

Copy `.env.example` to `.env` only when you need local overrides:

```bash
cp toolkit/booking/.env.example toolkit/booking/.env
```

Anonymous search does not require Booking.com login. Login cookies are only needed for reservation, wishlist, or account workflows and are stored by the upstream server under `~/.strider/booking/`.

## Commands

List tool schemas:

```bash
./toolkit/booking/booking-mcp-list
```

Search hotels:

```bash
./toolkit/booking/booking-search destination="Tbilisi, Georgia" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
```

Get property details:

```bash
./toolkit/booking/booking-property propertyUrl="<propertyId-or-url-from-booking-search>"
```

Check availability:

```bash
./toolkit/booking/booking-availability propertyUrl="<propertyId-or-url-from-booking-search>" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
```

Get prices:

```bash
./toolkit/booking/booking-prices propertyUrl="<propertyId-or-url-from-booking-search>" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
```

Get reviews:

```bash
./toolkit/booking/booking-reviews propertyUrl="<propertyId-or-url-from-booking-search>"
```

## Travel Skill Usage

Use Booking first for overseas hotel, aparthotel, room availability, cancellation-policy, and review research.

Use Airbnb first when the user prefers homestays, apartments, villas, kitchens/laundry, family stays, long stays, or local-neighborhood lodging.
