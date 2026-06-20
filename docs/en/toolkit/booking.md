# Booking.com MCP Toolkit

This folder wraps `markswendsen-code/mcp-booking`, published as `@striderlabs/mcp-booking`, for anonymous international hotel research.

The MCP server is not vendored into this repository. Wrappers run it through:

```bash
npx -y @striderlabs/mcp-booking
```

Use Booking first for overseas hotels, aparthotels, availability, cancellation-policy, price, and review research. Use Airbnb first for homestays, apartments, villas, kitchens/laundry, family stays, long stays, or local-neighborhood lodging.

## Commands

```bash
./toolkit/booking/booking-mcp-list
./toolkit/booking/booking-search destination="Tbilisi, Georgia" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
./toolkit/booking/booking-property propertyUrl="<propertyId-or-url-from-booking-search>"
./toolkit/booking/booking-availability propertyUrl="<propertyId-or-url-from-booking-search>" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
./toolkit/booking/booking-prices propertyUrl="<propertyId-or-url-from-booking-search>" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
./toolkit/booking/booking-reviews propertyUrl="<propertyId-or-url-from-booking-search>"
```

## Safety

The local wrappers intentionally expose only read-only research tools.

Do not automate these transaction/account tools from travel research flows:

- `booking_book`
- `booking_cancel_reservation`
- `booking_get_reservations`
- `booking_save_property`

Booking.com account login is not required for anonymous hotel research. Account cookies are only needed for reservation or wishlist workflows.
