# Commands

Run from the repository root.

## App

```bash
node app/server.js
curl -sS http://127.0.0.1:8080/api/health
```

## Install

```bash
./install.sh --doctor
./install.sh --install-system
./install.sh --install-gcloud
```

`--install-gcloud` installs Google Cloud CLI under `~/.local` without sudo.

## Login And Status

```bash
./toolkit/login/login-status
./toolkit/login/login-all
```

Provider-specific login:

```bash
./toolkit/google/google-login
./toolkit/google/google-usage
./toolkit/xhs/xhs-mcp-start
./toolkit/xhs/xhs-login-watch
```

## Google Maps

```bash
./toolkit/google/google-search-place query="restaurants in Shkoder Albania" category=restaurants
./toolkit/google/google-geocode address="Hotel Shkodra L, Shkoder Albania" category=hotels
./toolkit/google/google-place-details placeId="<google-place-id>"
./toolkit/google/google-directions points='[{"name":"A","lat":42.0,"lng":19.5},{"name":"B","lat":42.2,"lng":19.7}]' mode=driving
./toolkit/google/google-usage
```

## Booking

```bash
./toolkit/booking/booking-mcp-list
./toolkit/booking/booking-search destination="Tbilisi, Georgia" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
./toolkit/booking/booking-property propertyUrl="<propertyId-or-url>"
./toolkit/booking/booking-availability propertyUrl="<propertyId-or-url>" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
./toolkit/booking/booking-prices propertyUrl="<propertyId-or-url>" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
./toolkit/booking/booking-reviews propertyUrl="<propertyId-or-url>"
```

## Airbnb

```bash
./toolkit/airbnb/airbnb-mcp-list
./toolkit/airbnb/airbnb-search location="Tbilisi, Georgia" checkin=2026-09-25 checkout=2026-10-07 adults=2 propertyType=entire_home
./toolkit/airbnb/airbnb-details id=12345678 checkin=2026-09-25 checkout=2026-10-07 adults=2
```

## FlyAI / Fliggy

```bash
./toolkit/fz/fz-status
./toolkit/fz/flyai-env search-flight --origin "上海" --destination "北京" --dep-date 2026-07-01 --sort-type 3
./toolkit/fz/flyai-env search-hotel --dest-name "北京" --check-in-date 2026-07-01 --check-out-date 2026-07-03
./toolkit/fz/flyai-env search-poi --city-name "北京" --category "历史古迹"
./toolkit/fz/flyai-env fliggy-fast-search --query "云南 5天 亲子游"
```

## Xiaohongshu

```bash
./toolkit/xhs/xhs-mcp-start
./toolkit/xhs/xhs-mcp-status
./toolkit/xhs/xhs-mcp-stop
./toolkit/xhs/xhs-login-qr
./toolkit/xhs/xhs-login-watch
```

MCP call example:

```bash
mcporter call xiaohongshu-xpz.search_feeds --timeout 180000 --args '{"keyword":"阿尔巴尼亚 旅行 攻略"}'
```
