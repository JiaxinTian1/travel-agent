# Google Maps toolkit

Lightweight wrappers around `app/toolkit/google.js`.

Required app env:

```env
GOOGLE_MAPS_API_KEY=...
```

Optional Cloud Monitoring guard:

```env
GOOGLE_USAGE_SOURCE=monitoring
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json
```

The service account needs `Monitoring Viewer`. You can also use local ADC:

```bash
gcloud auth application-default login
```

If your organization blocks JSON key creation, use impersonation instead:

```env
GOOGLE_IMPERSONATE_SERVICE_ACCOUNT=travel-agent-monitoring@your-project.iam.gserviceaccount.com
```

Your user needs `Service Account Token Creator` on that service account, and the
service account needs `Monitoring Viewer` on the project.

Examples:

```bash
./toolkit/google/google-search-place query="restaurants in Shkoder Albania" category=restaurants
./toolkit/google/google-geocode address="Hotel Shkodra L, Shkoder Albania" category=hotels
./toolkit/google/google-place-details placeId="..."
./toolkit/google/google-directions points='[{"name":"A","lat":42.0,"lng":19.5},{"name":"B","lat":42.2,"lng":19.7}]' mode=driving
./toolkit/google/google-usage
```

Local guard usage is tracked in `workspace/app-state/google-usage.json`.
When `GOOGLE_USAGE_SOURCE=monitoring`, each Google API request checks Cloud
Monitoring before calling Places/Routes/Geocoding.
