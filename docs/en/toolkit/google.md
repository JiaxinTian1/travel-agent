# Google Maps Toolkit

Google Maps is the primary global provider for Places and Routes.

## Config

```env
GOOGLE_MAPS_API_KEY=
GOOGLE_USAGE_SOURCE=monitoring
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_MONTHLY_LIMIT_PLACES=5000
GOOGLE_MONTHLY_LIMIT_DETAILS=5000
GOOGLE_MONTHLY_LIMIT_GEOCODE=10000
GOOGLE_MONTHLY_LIMIT_ROUTES=10000
```

Use ADC login instead of service-account JSON keys:

```bash
./install.sh --install-gcloud
./toolkit/google/google-login
```

## Usage Guard

When `GOOGLE_USAGE_SOURCE=monitoring`, each Google API call checks Cloud Monitoring before the request. If the monthly count is at or above the configured limit, the toolkit returns a fallback result and does not call Google.

Check usage:

```bash
./toolkit/google/google-usage
```

## Commands

```bash
./toolkit/google/google-search-place query="restaurants in Shkoder Albania" category=restaurants
./toolkit/google/google-geocode address="Hotel Shkodra L, Shkoder Albania" category=hotels
./toolkit/google/google-place-details placeId="<google-place-id>"
./toolkit/google/google-directions points='[{"name":"A","lat":42.0,"lng":19.5},{"name":"B","lat":42.2,"lng":19.7}]' mode=driving
```

## App Usage

- Overseas restaurant/attraction recommendations use Google Places first.
- Booking hotel results can be enriched with Google coordinates.
- Imported user places are resolved through Google Places when possible.
- Overseas routes use Google Routes before Mapbox fallback.
- China planners still prefer AMap/Gaode.
