"use strict";

function mapKey() {
  return process.env.AMAP_MAPS_API_KEY || process.env.AMAP_WEB_SERVICE_KEY || process.env.AMAP_API_KEY || "";
}

function fallback(points, reason) {
  return {
    ok: false,
    source: "amap-fallback",
    data: {
      pointCount: points.length,
      line: points,
      geometry: {
        type: "LineString",
        coordinates: points.map(point => [point.lng, point.lat])
      },
      summary: reason || `${points.length} 个点位的高德占位路线。`
    },
    rawText: "",
    stderr: reason || "",
    error: reason || null
  };
}

function dedupePoints(rawPoints) {
  return (Array.isArray(rawPoints) ? rawPoints : [])
    .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .filter((point, index, points) => {
      const prev = points[index - 1];
      return !prev || prev.lat !== point.lat || prev.lng !== point.lng;
    });
}

function parsePolyline(value) {
  return String(value || "")
    .split(";")
    .map(pair => pair.split(",").map(Number))
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
}

function pathFromV3(data) {
  const path = data?.route?.paths?.[0];
  const coordinates = [];
  for (const step of path?.steps || []) coordinates.push(...parsePolyline(step.polyline));
  return {
    coordinates,
    distance: Number(path?.distance),
    duration: Number(path?.duration)
  };
}

function transitFromV3(data) {
  const transit = data?.route?.transits?.[0];
  const segments = Array.isArray(transit?.segments) ? transit.segments : [];
  const coordinates = [];
  for (const segment of segments) {
    for (const step of segment.walking?.steps || []) coordinates.push(...parsePolyline(step.polyline));
    for (const busline of segment.bus?.buslines || []) coordinates.push(...parsePolyline(busline.polyline));
    if (segment.railway?.departure_stop?.location) coordinates.push(...parsePolyline(segment.railway.departure_stop.location));
    if (segment.railway?.arrival_stop?.location) coordinates.push(...parsePolyline(segment.railway.arrival_stop.location));
  }
  return {
    coordinates,
    distance: Number(transit?.distance),
    duration: Number(transit?.duration)
  };
}

function routeMode(params = {}) {
  const mode = String(params.mode || params.profile || process.env.AMAP_PROFILE || "driving").toLowerCase();
  if (["walking", "walk"].includes(mode)) return "walking";
  if (["transit", "bus", "public", "public-transit"].includes(mode)) return "transit";
  if (["bicycling", "cycling", "bike"].includes(mode)) return "bicycling";
  return "driving";
}

function modeLabel(mode) {
  return {
    driving: "驾车",
    walking: "步行",
    transit: "公交",
    bicycling: "骑行"
  }[mode] || "驾车";
}

function keywordForCategory(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("restaurant") || value.includes("food")) return "美食|餐厅";
  if (value.includes("hotel") || value.includes("lodging") || value.includes("homestay")) return "酒店|住宿";
  return "景点|旅游景点";
}

function itemType(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("restaurant") || value.includes("food")) return "restaurant";
  if (value.includes("hotel") || value.includes("lodging") || value.includes("homestay")) return "hotel";
  return "attraction";
}

function pathFromV5(data) {
  const paths = data?.route?.paths;
  const path = Array.isArray(paths) ? paths[0] : paths;
  const steps = Array.isArray(path?.steps) ? path.steps : path?.steps ? [path.steps] : [];
  const coordinates = [];
  for (const step of steps) coordinates.push(...parsePolyline(step.polyline));
  return {
    coordinates,
    distance: Number(path?.distance),
    duration: Number(path?.cost?.duration ?? path?.duration)
  };
}

async function routePlaces(params = {}) {
  const points = dedupePoints(params.points);
  if (points.length < 2) return fallback(points, "少于 2 个点，无法计算高德路线。");
  const key = mapKey();
  if (!key) return fallback(points, "未配置 AMAP_MAPS_API_KEY，使用占位路线。");
  const mode = routeMode(params);

  const coordinates = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let lastRawText = "";
  let lastInfocode = "";
  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const segment = await routeSegment(key, points[index], points[index + 1], mode);
    if (!segment.ok) return fallback(points, segment.error);
    lastRawText = segment.rawText;
    lastInfocode = segment.infocode;
    totalDistance += Number.isFinite(segment.distance) ? segment.distance : 0;
    totalDuration += Number.isFinite(segment.duration) ? segment.duration : 0;
    const segmentCoordinates = segment.coordinates.length
      ? segment.coordinates
      : [[points[index].lng, points[index].lat], [points[index + 1].lng, points[index + 1].lat]];
    segments.push({
      from: points[index].name || `${index + 1}`,
      to: points[index + 1].name || `${index + 2}`,
      fromIndex: index,
      toIndex: index + 1,
      distanceMeters: segment.distance,
      durationSeconds: segment.duration,
      summary: `${formatDistance(segment.distance)}, ${formatDuration(segment.duration)}`,
      geometry: {
        type: "LineString",
        coordinates: segmentCoordinates
      }
    });
    if (!coordinates.length) coordinates.push(...segmentCoordinates);
    else coordinates.push(...segmentCoordinates.slice(1));
  }
  const distanceKm = totalDistance > 0 ? `${(totalDistance / 1000).toFixed(1)} km` : "距离未知";
  const durationMin = totalDuration > 0 ? `${Math.round(totalDuration / 60)} min` : "时间未知";
  return {
    ok: true,
    source: "amap",
    data: {
      pointCount: points.length,
      line: points,
      geometry: {
        type: "LineString",
        coordinates
      },
      summary: `高德${modeLabel(mode)}路线：${distanceKm}, ${durationMin}`,
      distanceMeters: totalDistance,
      durationSeconds: totalDuration,
      mode,
      segments,
      amap: {
        distance: totalDistance,
        duration: totalDuration,
        infocode: lastInfocode,
        segments: points.length - 1
      }
    },
    rawText: lastRawText.slice(0, 20000),
    stderr: "",
    error: null
  };
}

async function searchNearby(params = {}) {
  const key = mapKey();
  if (!key) return { ok: false, source: "amap-fallback", items: [], error: "未配置 AMAP_MAPS_API_KEY。" };
  const center = params.center || {};
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
    return { ok: false, source: "amap-fallback", items: [], error: "缺少中心点坐标。" };
  }
  const query = new URLSearchParams({
    key,
    location: `${center.lng},${center.lat}`,
    keywords: params.keyword || keywordForCategory(params.category),
    radius: String(Math.max(200, Math.min(10000, Number(params.radiusMeters || 3000)))),
    offset: String(Math.max(1, Math.min(20, Number(params.limit || 8)))),
    page: "1",
    extensions: "base",
    output: "json"
  });
  let response;
  try {
    response = await fetch(`https://restapi.amap.com/v3/place/around?${query.toString()}`);
  } catch (error) {
    return { ok: false, source: "amap-fallback", items: [], error: error.message };
  }
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {}
  if (!response.ok || data?.status !== "1") {
    return { ok: false, source: "amap-fallback", items: [], error: data?.info || `HTTP ${response.status}` };
  }
  const type = itemType(params.category);
  const items = (data.pois || [])
    .map((poi, index) => {
      const [lng, lat] = String(poi.location || "").split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        id: poi.id || `amap_${Date.now()}_${index}`,
        name: poi.name || `高德 POI ${index + 1}`,
        type,
        lat,
        lng,
        note: [poi.address, poi.type, poi.distance ? `${poi.distance}m` : ""].filter(Boolean).join("｜"),
        source: "amap-place",
        confidence: "medium"
      };
    })
    .filter(Boolean);
  return { ok: Boolean(items.length), source: "amap-place", items, rawText: text.slice(0, 20000), error: items.length ? null : "高德周边搜索未返回 POI。" };
}

async function routeSegment(key, originPoint, destinationPoint, mode = "driving") {
  const query = new URLSearchParams({
    key,
    origin: `${originPoint.lng},${originPoint.lat}`,
    destination: `${destinationPoint.lng},${destinationPoint.lat}`,
    output: "json",
    extensions: "base"
  });
  if (mode === "transit") query.set("city", "全国");
  let response;
  try {
    response = await fetch(`https://restapi.amap.com/v3/direction/${mode}?${query.toString()}`);
  } catch (error) {
    return { ok: false, error: `高德路线规划失败：${error.message}`, rawText: "" };
  }
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {}
  if (!response.ok || data?.status !== "1") {
    const info = data?.info || `HTTP ${response.status}`;
    return { ok: false, error: `高德路线规划失败：${info}`, rawText: text };
  }
  const parsed = mode === "transit" ? transitFromV3(data) : pathFromV3(data);
  return {
    ok: true,
    coordinates: parsed.coordinates,
    distance: parsed.distance,
    duration: parsed.duration,
    infocode: data.infocode,
    rawText: text
  };
}

function enabled() {
  return Boolean(mapKey());
}

module.exports = {
  enabled,
  pathFromV5,
  routePlaces,
  searchNearby
};

function formatDistance(value) {
  const meters = Number(value);
  if (!Number.isFinite(meters)) return "距离未知";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return "时间未知";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
