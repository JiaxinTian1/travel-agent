# Google Maps Toolkit

Google Maps 是海外地点和路线的主 provider。

## 配置

```env
GOOGLE_MAPS_API_KEY=
GOOGLE_USAGE_SOURCE=monitoring
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_MONTHLY_LIMIT_PLACES=5000
GOOGLE_MONTHLY_LIMIT_DETAILS=5000
GOOGLE_MONTHLY_LIMIT_GEOCODE=10000
GOOGLE_MONTHLY_LIMIT_ROUTES=10000
```

推荐用 ADC 登录，不使用 service-account JSON key：

```bash
./install.sh --install-gcloud
./toolkit/google/google-login
```

## 用量保护

当 `GOOGLE_USAGE_SOURCE=monitoring` 时，每次调用 Google API 前都会先查 Cloud Monitoring。若当月真实用量已经达到配置上限，toolkit 会返回 fallback，不再调用 Google。

查看用量：

```bash
./toolkit/google/google-usage
```

## 命令

```bash
./toolkit/google/google-search-place query="restaurants in Shkoder Albania" category=restaurants
./toolkit/google/google-geocode address="Hotel Shkodra L, Shkoder Albania" category=hotels
./toolkit/google/google-place-details placeId="<google-place-id>"
./toolkit/google/google-directions points='[{"name":"A","lat":42.0,"lng":19.5},{"name":"B","lat":42.2,"lng":19.7}]' mode=driving
```

## App 使用规则

- 海外餐厅/景点推荐优先用 Google Places。
- Booking 酒店结果可以用 Google 补坐标。
- 用户导入地点优先用 Google Places 解析。
- 海外路线优先用 Google Routes，再 fallback 到 Mapbox。
- 中国国内 planner 仍优先高德。
