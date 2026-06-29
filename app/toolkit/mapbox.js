"use strict";

function accessToken() {
  return process.env.MAPBOX_ACCESS_TOKEN || "";
}

function enabled() {
  return Boolean(accessToken());
}

function fallback(points, reason) {
  return {
    ok: false,
    source: "mapbox-fallback",
    data: {
      pointCount: points.length,
      line: points,
      geometry: {
        type: "LineString",
        coordinates: points.map(point => [point.lng, point.lat])
      },
      summary: reason || `${points.length} 个点位的 Mapbox 占位路线。`
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

function routeProfile(params = {}) {
  const raw = params.profile || process.env.MAPBOX_PROFILE || "driving";
  const normalized = String(raw).replace(/^mapbox\//, "");
  if (["driving", "driving-traffic", "walking", "cycling"].includes(normalized)) return `mapbox/${normalized}`;
  return "mapbox/driving";
}

function categoryIds(category) {
  const value = String(category || "").toLowerCase();
  if (["restaurants", "restaurant", "food", "food_and_drink"].includes(value)) return ["restaurant", "food_and_drink", "food"];
  if (["hotels", "hotel", "lodging", "homestays"].includes(value)) return ["lodging", "hotel"];
  if (["attractions", "attraction", "sights", "poi"].includes(value)) return ["tourist_attraction", "landmark", "museum"];
  return [value || "tourist_attraction"];
}

async function routePlaces(params = {}) {
  const points = dedupePoints(params.points);
  if (points.length < 2) return fallback(points, "少于 2 个点，无法计算 Mapbox 路线。");
  const token = accessToken();
  if (!token) return fallback(points, "未配置 MAPBOX_ACCESS_TOKEN，使用占位路线。");
  if (points.length > 25) return fallback(points, "Mapbox Directions 单次最多支持 25 个坐标点。");

  const coordinates = points.map(point => `${point.lng},${point.lat}`).join(";");
  const query = new URLSearchParams({
    access_token: token,
    geometries: "geojson",
    overview: "full",
    steps: "false",
    alternatives: "false"
  });
  const profile = routeProfile(params);
  let response;
  try {
    response = await fetch(`https://api.mapbox.com/directions/v5/${profile}/${coordinates}?${query.toString()}`);
  } catch (error) {
    return fallback(points, `Mapbox Directions failed: ${error.message}`);
  }
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {}
  if (!response.ok || data?.code !== "Ok" || !data?.routes?.[0]?.geometry) {
    const info = data?.message || data?.code || `HTTP ${response.status}`;
    return fallback(points, `Mapbox Directions failed: ${info}`);
  }

  const route = data.routes[0];
  const distanceKm = Number.isFinite(route.distance) ? `${(route.distance / 1000).toFixed(1)} km` : "距离未知";
  const durationMin = Number.isFinite(route.duration) ? `${Math.round(route.duration / 60)} min` : "时间未知";
  const legs = Array.isArray(route.legs) ? route.legs : [];
  const segments = points.slice(0, -1).map((point, index) => {
    const leg = legs[index] || {};
    const from = points[index];
    const to = points[index + 1];
    return {
      from: from.name || `${index + 1}`,
      to: to.name || `${index + 2}`,
      fromIndex: index,
      toIndex: index + 1,
      distanceMeters: leg.distance,
      durationSeconds: leg.duration,
      summary: `${formatDistance(leg.distance)}, ${formatDuration(leg.duration)}`,
      geometry: null
    };
  });
  return {
    ok: true,
    source: "mapbox",
    data: {
      pointCount: points.length,
      profile,
      line: points,
      geometry: route.geometry,
      summary: `Mapbox ${profile.replace("mapbox/", "")}: ${distanceKm}, ${durationMin}`,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      mode: profile.replace("mapbox/", ""),
      segments,
      mapbox: {
        distance: route.distance,
        duration: route.duration,
        weight: route.weight,
        weightName: route.weight_name,
        uuid: data.uuid
      }
    },
    rawText: text.slice(0, 20000),
    stderr: "",
    error: null
  };
}

async function searchNearby(params = {}) {
  const token = accessToken();
  if (!token) return { ok: false, source: "mapbox-fallback", items: [], error: "未配置 MAPBOX_ACCESS_TOKEN。" };
  const center = params.center || {};
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
    return { ok: false, source: "mapbox-fallback", items: [], error: "缺少中心点坐标。" };
  }
  const limit = Math.max(1, Math.min(10, Number(params.limit || 5)));
  if (params.keyword) {
    const prompted = await forwardSearch(params, center, limit);
    if (prompted.ok) return prompted;
  }
  const categories = categoryIds(params.category);
  const errors = [];
  for (const category of categories) {
    const query = new URLSearchParams({
      access_token: token,
      language: params.language || "zh",
      limit: String(limit),
      proximity: `${center.lng},${center.lat}`
    });
    let response;
    try {
      response = await fetch(`https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(category)}?${query.toString()}`);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (_) {}
    if (!response.ok || !Array.isArray(data?.features)) {
      errors.push(data?.message || data?.error || `HTTP ${response.status}`);
      continue;
    }
    const items = data.features
      .map((feature, index) => normalizeFeature(feature, params.category, index))
      .filter(Boolean);
    if (items.length) {
      return { ok: true, source: "mapbox-search", category, items, rawText: text.slice(0, 20000), error: null };
    }
  }
  const fallback = await forwardSearch(params, center, limit);
  if (fallback.ok) return fallback;
  return { ok: false, source: "mapbox-fallback", items: [], error: errors.join("; ") || "Mapbox Search 未返回 POI。" };
}

async function forwardSearch(params, center, limit) {
  const token = accessToken();
  const queryText = [params.keyword, queryForCategory(params.category), params.destination || params.place || ""].filter(Boolean).join(" ").trim();
  const query = new URLSearchParams({
    access_token: token,
    q: queryText || queryForCategory(params.category),
    language: params.language || "zh",
    limit: String(limit)
  });
  if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) query.set("proximity", `${center.lng},${center.lat}`);
  let response;
  try {
    response = await fetch(`https://api.mapbox.com/search/searchbox/v1/forward?${query.toString()}`);
  } catch (error) {
    return { ok: false, source: "mapbox-fallback", items: [], error: error.message };
  }
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {}
  if (!response.ok || !Array.isArray(data?.features)) {
    return { ok: false, source: "mapbox-fallback", items: [], error: data?.message || `HTTP ${response.status}` };
  }
  const normalized = data.features
    .map((feature, index) => normalizeFeature(feature, params.category, index))
    .filter(Boolean);
  const poiItems = normalized.filter(item => item.featureType === "poi");
  const items = poiItems.length ? poiItems : params.acceptAny ? normalized : [];
  return { ok: Boolean(items.length), source: "mapbox-search", category: "forward", items, rawText: text.slice(0, 20000), error: items.length ? null : "Mapbox forward search 未返回具体 POI。" };
}

async function searchText(params = {}) {
  const limit = Math.max(1, Math.min(10, Number(params.limit || 5)));
  const result = await forwardSearch({
    keyword: params.query || params.keyword || params.place || "",
    category: params.category || "",
    destination: params.destination || "",
    language: params.language || "zh",
    acceptAny: true
  }, params.center || null, limit);
  return { ...result, source: result.ok ? "mapbox-text-search" : result.source };
}

function queryForCategory(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("restaurant") || value.includes("food")) return "restaurant";
  if (value.includes("hotel") || value.includes("lodging") || value.includes("homestay")) return "hotel";
  return "attraction";
}

function normalizeFeature(feature, category, index) {
  const coords = feature?.geometry?.coordinates;
  const props = feature?.properties || {};
  if (!Array.isArray(coords) || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return null;
  return {
    id: props.mapbox_id || `mapbox_${Date.now()}_${index}`,
    name: props.name || props.name_preferred || `Mapbox POI ${index + 1}`,
    type: itemType(category),
    lat: coords[1],
    lng: coords[0],
    note: [props.full_address || props.place_formatted, props.poi_category?.slice?.(0, 2)?.join("/")].filter(Boolean).join("｜"),
    source: "mapbox-search",
    confidence: "medium",
    featureType: props.feature_type || ""
  };
}

function itemType(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("hotel") || value.includes("lodging") || value.includes("homestay")) return "hotel";
  if (value.includes("restaurant") || value.includes("food")) return "restaurant";
  return "attraction";
}

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

module.exports = {
  enabled,
  routePlaces,
  searchNearby,
  searchText
};
