"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
loadEnvFile(path.join(ROOT, "app", ".env"));
const USAGE_PATH = process.env.GOOGLE_USAGE_PATH || path.join(ROOT, "workspace", "app-state", "google-usage.json");
let monitoringTokenCache = null;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function apiKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function enabled() {
  return Boolean(apiKey()) && process.env.GOOGLE_MAPS_DISABLED !== "true";
}

function monthlyLimit(sku) {
  const defaults = { places: 5000, geocode: 10000, routes: 10000, details: 5000 };
  const envKey = `GOOGLE_MONTHLY_LIMIT_${sku.toUpperCase()}`;
  return Math.max(0, Number(process.env[envKey] || defaults[sku] || 5000));
}

function usageSource() {
  return String(process.env.GOOGLE_USAGE_SOURCE || "local").toLowerCase();
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function readUsage() {
  try {
    return JSON.parse(fs.readFileSync(USAGE_PATH, "utf8"));
  } catch (_) {
    return { month: currentMonth(), counts: {} };
  }
}

function writeUsage(usage) {
  fs.mkdirSync(path.dirname(USAGE_PATH), { recursive: true });
  fs.writeFileSync(USAGE_PATH, JSON.stringify(usage, null, 2));
}

async function reserveQuota(sku) {
  const source = usageSource();
  if (["monitoring", "auto"].includes(source) && monitoringConfigured()) {
    const monitored = await monitoredQuota(sku);
    if (monitored.ok || source === "monitoring" || process.env.GOOGLE_MONITORING_STRICT === "true") return monitored;
  }
  if (source === "monitoring" && process.env.GOOGLE_MONITORING_STRICT !== "false") {
    return { ok: false, error: "Google Monitoring usage check is not configured or failed." };
  }
  return reserveLocalQuota(sku);
}

function reserveLocalQuota(sku, extra = {}) {
  const usage = readUsage();
  const month = currentMonth();
  if (usage.month !== month) {
    usage.month = month;
    usage.counts = {};
  }
  const limit = monthlyLimit(sku);
  const used = Number(usage.counts?.[sku] || 0);
  if (limit <= 0 || used >= limit) {
    return { ok: false, error: `Google ${sku} monthly quota reached: ${used}/${limit}` };
  }
  usage.counts[sku] = used + 1;
  if (extra.monitoring) {
    usage.monitoring = {
      ...(usage.monitoring || {}),
      [sku]: extra.monitoring
    };
  }
  writeUsage(usage);
  return { ok: true, used: usage.counts[sku], limit, source: "local-guard" };
}

async function monitoredQuota(sku) {
  const limit = monthlyLimit(sku);
  if (limit <= 0) return { ok: false, error: `Google ${sku} monthly quota reached: 0/${limit}` };
  const result = await queryMonitoringUsage(sku);
  if (!result.ok) return { ok: false, error: result.error || "Google Monitoring usage check failed." };
  if (result.count >= limit) {
    return { ok: false, error: `Google ${sku} monthly quota reached by Monitoring: ${result.count}/${limit}` };
  }
  reserveLocalQuota(sku, { monitoring: result });
  return { ok: true, used: result.count, limit, source: "cloud-monitoring", monitoring: result };
}

function quotaFallback(source, sku, error, extra = {}) {
  return { ok: false, source, items: [], data: null, rawText: "", error: error || `Google ${sku} quota unavailable`, ...extra };
}

async function googleFetch(sku, url, options = {}) {
  if (!enabled()) return { ok: false, error: "未配置 GOOGLE_MAPS_API_KEY。" };
  const quota = await reserveQuota(sku);
  if (!quota.ok) return quota;
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {}
  if (!response.ok) {
    return { ok: false, error: data?.error?.message || data?.error_message || `HTTP ${response.status}`, data, rawText: text };
  }
  return { ok: true, data, rawText: text };
}

function monitoringConfigured() {
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_MONITORING_PROJECT_ID)
    && Boolean(process.env.GOOGLE_MONITORING_ACCESS_TOKEN || process.env.GOOGLE_APPLICATION_CREDENTIALS || hasGcloud());
}

function hasGcloud() {
  try {
    execFileSync(gcloudCommand(), ["--version"], { stdio: "ignore", timeout: 2000 });
    return true;
  } catch (_) {
    return false;
  }
}

function gcloudCommand() {
  const candidates = [
    process.env.GCLOUD_BIN,
    path.join(process.env.HOME || "", ".local", "bin", "gcloud"),
    path.join(process.env.HOME || "", ".local", "google-cloud-sdk", "bin", "gcloud"),
    "gcloud"
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate === "gcloud") return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }
  return "gcloud";
}

function monitoringProjectId() {
  return process.env.GOOGLE_MONITORING_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT_ID || "";
}

function monitoringServices(sku) {
  const envValue = process.env[`GOOGLE_MONITORING_SERVICES_${sku.toUpperCase()}`] || "";
  if (envValue) return envValue.split(",").map(value => value.trim()).filter(Boolean);
  if (["places", "details"].includes(sku)) return ["places.googleapis.com"];
  if (sku === "routes") return ["routes.googleapis.com"];
  if (sku === "geocode") return ["geocoding-backend.googleapis.com", "geocoding.googleapis.com"];
  return [];
}

function monitoringMethods(sku) {
  const envValue = process.env[`GOOGLE_MONITORING_METHODS_${sku.toUpperCase()}`] || "";
  if (envValue) return envValue.split(",").map(value => value.trim()).filter(Boolean);
  if (sku === "places") {
    return [
      "google.maps.places.v1.Places.SearchText",
      "google.maps.places.v1.Places.SearchNearby"
    ];
  }
  if (sku === "details") return ["google.maps.places.v1.Places.GetPlace"];
  if (sku === "routes") return ["google.maps.routing.v2.Routes.ComputeRoutes"];
  if (sku === "geocode") return [];
  return [];
}

function monitoringCredentialId() {
  return process.env.GOOGLE_MONITORING_CREDENTIAL_ID || "";
}

function monthInterval() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  return { startTime: start.toISOString(), endTime: now.toISOString() };
}

async function queryMonitoringUsage(sku) {
  const projectId = monitoringProjectId();
  if (!projectId) return { ok: false, source: "cloud-monitoring", sku, error: "未配置 GOOGLE_CLOUD_PROJECT_ID。" };
  const services = monitoringServices(sku);
  if (!services.length) return { ok: false, source: "cloud-monitoring", sku, error: `未配置 ${sku} 对应的 Monitoring service。` };
  let token;
  try {
    token = await monitoringAccessToken();
  } catch (error) {
    return { ok: false, source: "cloud-monitoring", sku, error: error.message };
  }
  const counts = [];
  for (const service of services) {
    const methods = monitoringMethods(sku);
    if (methods.length) {
      for (const method of methods) {
        counts.push(await queryMonitoringService({ projectId, token, service, method }));
      }
    } else {
      counts.push(await queryMonitoringService({ projectId, token, service }));
    }
  }
  const failed = counts.filter(item => !item.ok);
  const successful = counts.filter(item => item.ok);
  if (!successful.length) {
    return { ok: false, source: "cloud-monitoring", sku, services, error: failed.map(item => item.error).filter(Boolean).join("; ") || "Monitoring did not return usage." };
  }
  return {
    ok: true,
    source: "cloud-monitoring",
    sku,
    services,
    count: successful.reduce((sum, item) => sum + item.count, 0),
    byService: successful,
    failedServices: failed,
    interval: monthInterval()
  };
}

async function queryMonitoringService({ projectId, token, service, method }) {
  const { startTime, endTime } = monthInterval();
  const filterParts = [
    'metric.type = "serviceruntime.googleapis.com/api/request_count"',
    'resource.type = "consumed_api"',
    `resource.labels.service = "${service}"`
  ];
  const credentialId = monitoringCredentialId();
  if (credentialId) filterParts.push(`resource.labels.credential_id = "${credentialId}"`);
  if (method) filterParts.push(`resource.labels.method = "${method}"`);
  const query = new URLSearchParams({
    filter: filterParts.join(" AND "),
    "interval.startTime": startTime,
    "interval.endTime": endTime,
    "aggregation.alignmentPeriod": "86400s",
    "aggregation.perSeriesAligner": "ALIGN_SUM",
    "aggregation.crossSeriesReducer": "REDUCE_SUM",
    view: "FULL",
    pageSize: "1000"
  });
  const url = `https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(projectId)}/timeSeries?${query.toString()}`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {}
  if (!response.ok) {
    return { ok: false, service, count: 0, error: data?.error?.message || `Monitoring HTTP ${response.status}` };
  }
  const count = sumTimeSeries(data?.timeSeries || []);
  return { ok: true, service, method: method || "", count, rawSeries: Array.isArray(data?.timeSeries) ? data.timeSeries.length : 0 };
}

function sumTimeSeries(series) {
  return series.reduce((sum, item) => {
    const points = Array.isArray(item.points) ? item.points : [];
    return sum + points.reduce((inner, point) => inner + typedValueNumber(point.value), 0);
  }, 0);
}

function typedValueNumber(value = {}) {
  for (const key of ["int64Value", "doubleValue", "distributionValue"]) {
    if (key === "distributionValue") continue;
    const number = Number(value[key]);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

async function monitoringAccessToken() {
  if (process.env.GOOGLE_MONITORING_ACCESS_TOKEN) return process.env.GOOGLE_MONITORING_ACCESS_TOKEN;
  if (monitoringTokenCache && monitoringTokenCache.expiresAt > Date.now() + 60000) return monitoringTokenCache.token;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const token = await serviceAccountAccessToken(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    monitoringTokenCache = token;
    return token.token;
  }
  if (process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT) {
    try {
      const token = execFileSync(gcloudCommand(), [
        "auth",
        "print-access-token",
        `--impersonate-service-account=${process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT}`
      ], { encoding: "utf8", timeout: 10000 }).trim();
      if (token) return token;
    } catch (_) {}
  }
  try {
    const token = execFileSync(gcloudCommand(), ["auth", "application-default", "print-access-token"], { encoding: "utf8", timeout: 10000 }).trim();
    if (token) return token;
  } catch (_) {}
  try {
    const token = execFileSync(gcloudCommand(), ["auth", "print-access-token"], { encoding: "utf8", timeout: 10000 }).trim();
    if (token) return token;
  } catch (_) {}
  throw new Error("未找到 Google Monitoring OAuth token；请配置 GOOGLE_APPLICATION_CREDENTIALS 或运行 gcloud auth application-default login。");
}

async function serviceAccountAccessToken(filePath) {
  const account = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/monitoring.read",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(account.private_key);
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) throw new Error(data?.error_description || data?.error || `OAuth token HTTP ${response.status}`);
  return { token: data.access_token, expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000 };
}

function base64Url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function categoryQuery(category) {
  const value = String(category || "").toLowerCase();
  if (["restaurants", "restaurant", "food"].includes(value)) return "restaurant";
  if (["hotels", "hotel", "lodging", "homestays"].includes(value)) return "hotel";
  if (["flights", "flight", "airport"].includes(value)) return "airport";
  return "tourist attraction";
}

function includedType(category) {
  const value = String(category || "").toLowerCase();
  if (["restaurants", "restaurant", "food"].includes(value)) return "restaurant";
  if (["hotels", "hotel", "lodging", "homestays"].includes(value)) return "lodging";
  if (["flights", "flight", "airport"].includes(value)) return "airport";
  return "tourist_attraction";
}

function itemType(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("restaurant") || value.includes("food")) return "restaurant";
  if (value.includes("hotel") || value.includes("lodging") || value.includes("homestay")) return "hotel";
  if (value.includes("flight") || value.includes("airport")) return "flight";
  return "attraction";
}

function matchesCategory(place, category) {
  const types = Array.isArray(place.types) ? place.types : [];
  const primary = String(place.primaryType || "").toLowerCase();
  const value = String(category || "").toLowerCase();
  if (["restaurants", "restaurant", "food"].includes(value)) {
    return primary === "restaurant" || (types.includes("restaurant") && !["lodging", "hotel"].includes(primary));
  }
  if (["hotels", "hotel", "lodging", "homestays"].includes(value)) {
    return primary === "lodging" || types.includes("lodging");
  }
  if (["flights", "flight", "airport"].includes(value)) {
    return primary === "airport" || types.includes("airport");
  }
  return true;
}

function normalizePlace(place, category, index) {
  if (!matchesCategory(place, category)) return null;
  const location = place.location || {};
  const lat = Number(location.latitude);
  const lng = Number(location.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const name = place.displayName?.text || place.name || `Google place ${index + 1}`;
  const rating = Number(place.rating);
  const note = [
    place.formattedAddress,
    Number.isFinite(rating) ? `评分 ${rating}` : "",
    place.userRatingCount ? `${place.userRatingCount} 条评价` : "",
    place.primaryTypeDisplayName?.text || place.primaryType || "",
    place.googleMapsUri || ""
  ].filter(Boolean).join("｜");
  return {
    id: place.id || place.name || `google_${Date.now()}_${index}`,
    placeId: place.id || "",
    name,
    type: itemType(category),
    lat,
    lng,
    note,
    source: "google-place",
    provider: "google",
    confidence: "high",
    featureType: "poi",
    url: place.googleMapsUri || "",
    raw: place
  };
}

function placesFieldMask() {
  return [
    "places.id",
    "places.name",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.types",
    "places.primaryType",
    "places.primaryTypeDisplayName",
    "places.rating",
    "places.userRatingCount",
    "places.websiteUri",
    "places.googleMapsUri",
    "places.nationalPhoneNumber"
  ].join(",");
}

function circleRestriction(center, radiusMeters) {
  return {
    circle: {
      center: { latitude: center.lat, longitude: center.lng },
      radius: Math.max(200, Math.min(50000, Number(radiusMeters || 5000)))
    }
  };
}

function rectangleRestriction(center, radiusMeters) {
  const radius = Math.max(200, Math.min(50000, Number(radiusMeters || 5000)));
  const latDelta = radius / 111320;
  const lngDelta = radius / (111320 * Math.max(0.2, Math.cos(center.lat * Math.PI / 180)));
  return {
    rectangle: {
      low: {
        latitude: center.lat - latDelta,
        longitude: center.lng - lngDelta
      },
      high: {
        latitude: center.lat + latDelta,
        longitude: center.lng + lngDelta
      }
    }
  };
}

async function searchPlaces(params = {}) {
  const query = [params.query || params.keyword, categoryQuery(params.category), params.destination || params.place].filter(Boolean).join(" ").trim();
  if (!query) return quotaFallback("google-place-fallback", "places", "缺少 Google Places 搜索关键词。");
  const body = {
    textQuery: query,
    languageCode: params.language || "zh-CN",
    maxResultCount: Math.max(1, Math.min(20, Number(params.limit || 8)))
  };
  const center = params.center || {};
  if (Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
    const locationKey = params.strictLocation === false ? "locationBias" : "locationRestriction";
    body[locationKey] = locationKey === "locationRestriction"
      ? rectangleRestriction(center, params.radiusMeters)
      : circleRestriction(center, params.radiusMeters);
  }
  const result = await googleFetch("places", "https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey(),
      "x-goog-fieldmask": placesFieldMask()
    },
    body: JSON.stringify(body)
  });
  if (!result.ok) return quotaFallback("google-place-fallback", "places", result.error, { rawText: result.rawText || "" });
  const items = (result.data?.places || []).map((place, index) => normalizePlace(place, params.category, index)).filter(Boolean);
  return { ok: Boolean(items.length), source: "google-place", items, rawText: result.rawText.slice(0, 20000), error: items.length ? null : "Google Places 未返回可用地点。" };
}

async function searchNearby(params = {}) {
  const center = params.center || {};
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
    return quotaFallback("google-place-fallback", "places", "缺少中心点坐标。");
  }
  if (params.keyword) {
    const textResult = await searchPlaces(params);
    if (textResult.items?.length) return textResult;
  }
  const body = {
    includedTypes: [includedType(params.category)],
    languageCode: params.language || "zh-CN",
    maxResultCount: Math.max(1, Math.min(20, Number(params.limit || 8))),
    locationRestriction: {
      ...circleRestriction(center, params.radiusMeters)
    }
  };
  const result = await googleFetch("places", "https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey(),
      "x-goog-fieldmask": placesFieldMask()
    },
    body: JSON.stringify(body)
  });
  if (!result.ok) return quotaFallback("google-place-fallback", "places", result.error, { rawText: result.rawText || "" });
  const items = (result.data?.places || []).map((place, index) => normalizePlace(place, params.category, index)).filter(Boolean);
  return { ok: Boolean(items.length), source: "google-place", items, rawText: result.rawText.slice(0, 20000), error: items.length ? null : "Google Nearby Search 未返回可用地点。" };
}

async function placeDetails(params = {}) {
  const placeId = params.placeId || params.id;
  if (!placeId) return quotaFallback("google-details-fallback", "details", "缺少 Google placeId。");
  const encoded = encodeURIComponent(placeId);
  const result = await googleFetch("details", `https://places.googleapis.com/v1/places/${encoded}`, {
    headers: {
      "x-goog-api-key": apiKey(),
      "x-goog-fieldmask": [
        "id",
        "name",
        "displayName",
        "formattedAddress",
        "location",
        "types",
        "primaryType",
        "primaryTypeDisplayName",
        "rating",
        "userRatingCount",
        "websiteUri",
        "googleMapsUri",
        "nationalPhoneNumber",
        "regularOpeningHours",
        "reviews"
      ].join(",")
    }
  });
  if (!result.ok) return quotaFallback("google-details-fallback", "details", result.error, { rawText: result.rawText || "" });
  const item = normalizePlace(result.data, params.category, 0);
  return { ok: Boolean(item), source: "google-details", item, data: result.data, rawText: result.rawText.slice(0, 20000), error: item ? null : "Google Place Details 未返回坐标。" };
}

async function geocode(params = {}) {
  const address = params.address || params.query || params.place;
  if (!address) return quotaFallback("google-geocode-fallback", "geocode", "缺少地址。");
  const query = new URLSearchParams({
    address,
    key: apiKey(),
    language: params.language || "zh-CN"
  });
  const result = await googleFetch("geocode", `https://maps.googleapis.com/maps/api/geocode/json?${query.toString()}`);
  if (!result.ok) return quotaFallback("google-geocode-fallback", "geocode", result.error, { rawText: result.rawText || "" });
  if (result.data?.status !== "OK") {
    return quotaFallback("google-geocode-fallback", "geocode", result.data?.error_message || result.data?.status || "Google Geocoding failed", { rawText: result.rawText || "" });
  }
  const items = (result.data.results || []).map((row, index) => {
    const location = row.geometry?.location || {};
    const lat = Number(location.lat);
    const lng = Number(location.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      id: row.place_id || `google_geocode_${index}`,
      placeId: row.place_id || "",
      name: row.formatted_address || address,
      type: itemType(params.category),
      lat,
      lng,
      note: [row.formatted_address, row.types?.slice?.(0, 3)?.join("/")].filter(Boolean).join("｜"),
      source: "google-geocode",
      provider: "google",
      confidence: row.geometry?.location_type === "ROOFTOP" ? "high" : "medium",
      featureType: row.types?.includes?.("establishment") ? "poi" : "geocode",
      raw: row
    };
  }).filter(Boolean);
  return { ok: Boolean(items.length), source: "google-geocode", items, item: items[0] || null, rawText: result.rawText.slice(0, 20000), error: items.length ? null : "Google Geocoding 未返回坐标。" };
}

function routeTravelMode(mode) {
  const value = String(mode || "driving").toLowerCase();
  if (["walking", "walk"].includes(value)) return "WALK";
  if (["cycling", "bicycling", "bike"].includes(value)) return "BICYCLE";
  if (["transit", "public", "bus", "public-transit"].includes(value)) return "TRANSIT";
  return "DRIVE";
}

function appRouteMode(mode) {
  const value = String(mode || "driving").toLowerCase();
  if (["walking", "walk"].includes(value)) return "walking";
  if (["cycling", "bicycling", "bike"].includes(value)) return "cycling";
  if (["transit", "public", "bus", "public-transit"].includes(value)) return "transit";
  return "driving";
}

function decodePolyline(encoded) {
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < String(encoded || "").length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([lng / 1e5, lat / 1e5]);
  }
  return coordinates;
}

function durationSeconds(value) {
  const match = String(value || "").match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Number(match[1]) : undefined;
}

async function routePlaces(params = {}) {
  const points = (Array.isArray(params.points) ? params.points : []).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  if (points.length < 2) return routeFallback(points, "少于 2 个点，无法计算 Google 路线。");
  const mode = routeTravelMode(params.mode || params.profile);
  const normalizedMode = appRouteMode(params.mode || params.profile);
  const segments = [];
  const coordinates = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let lastRawText = "";
  for (let index = 0; index < points.length - 1; index += 1) {
    const segment = await routeSegment(points[index], points[index + 1], mode);
    if (!segment.ok) return routeFallback(points, segment.error);
    lastRawText = segment.rawText || lastRawText;
    totalDistance += Number.isFinite(segment.distanceMeters) ? segment.distanceMeters : 0;
    totalDuration += Number.isFinite(segment.durationSeconds) ? segment.durationSeconds : 0;
    const segmentCoordinates = segment.geometry.coordinates.length ? segment.geometry.coordinates : [[points[index].lng, points[index].lat], [points[index + 1].lng, points[index + 1].lat]];
    segments.push({
      from: points[index].name || `${index + 1}`,
      to: points[index + 1].name || `${index + 2}`,
      fromIndex: index,
      toIndex: index + 1,
      distanceMeters: segment.distanceMeters,
      durationSeconds: segment.durationSeconds,
      summary: `${formatDistance(segment.distanceMeters)}, ${formatDuration(segment.durationSeconds)}`,
      geometry: { type: "LineString", coordinates: segmentCoordinates }
    });
    if (!coordinates.length) coordinates.push(...segmentCoordinates);
    else coordinates.push(...segmentCoordinates.slice(1));
  }
  return {
    ok: true,
    source: "google-routes",
    data: {
      pointCount: points.length,
      line: points,
      geometry: { type: "LineString", coordinates },
      summary: `Google ${normalizedMode} route: ${formatDistance(totalDistance)}, ${formatDuration(totalDuration)}`,
      distanceMeters: totalDistance,
      durationSeconds: totalDuration,
      mode: normalizedMode,
      segments
    },
    rawText: lastRawText.slice(0, 20000),
    error: null
  };
}

async function routeSegment(from, to, mode) {
  const result = await googleFetch("routes", "https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey(),
      "x-goog-fieldmask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode: mode,
      computeAlternativeRoutes: false,
      languageCode: "zh-CN",
      units: "METRIC"
    })
  });
  if (!result.ok) return { ok: false, error: result.error, rawText: result.rawText || "" };
  const route = result.data?.routes?.[0];
  if (!route) return { ok: false, error: "Google Routes 未返回路线。", rawText: result.rawText || "" };
  const coordinates = decodePolyline(route.polyline?.encodedPolyline || "");
  return {
    ok: true,
    distanceMeters: Number(route.distanceMeters),
    durationSeconds: durationSeconds(route.duration),
    geometry: { type: "LineString", coordinates },
    rawText: result.rawText || ""
  };
}

function routeFallback(points, reason) {
  return {
    ok: false,
    source: "google-routes-fallback",
    data: {
      pointCount: points.length,
      line: points,
      geometry: { type: "LineString", coordinates: points.map(point => [point.lng, point.lat]) },
      summary: reason || "Google Routes unavailable."
    },
    rawText: "",
    error: reason || null
  };
}

function usageStatus() {
  const usage = readUsage();
  const base = usage.month !== currentMonth()
    ? { month: currentMonth(), counts: {}, limits: usageLimits() }
    : { month: usage.month, counts: usage.counts || {}, limits: usageLimits(), monitoring: usage.monitoring || {} };
  return {
    ...base,
    source: usageSource(),
    monitoringConfigured: monitoringConfigured()
  };
}

async function usageStatusAsync() {
  const base = usageStatus();
  if (!["monitoring", "auto"].includes(usageSource()) || !monitoringConfigured()) return base;
  const monitored = {};
  for (const sku of ["places", "details", "geocode", "routes"]) {
    monitored[sku] = await queryMonitoringUsage(sku);
  }
  return { ...base, monitored };
}

function usageLimits() {
  return {
    places: monthlyLimit("places"),
    details: monthlyLimit("details"),
    geocode: monthlyLimit("geocode"),
    routes: monthlyLimit("routes")
  };
}

function formatDistance(value) {
  const meters = Number(value);
  if (!Number.isFinite(meters) || meters < 0) return "距离未知";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return "时间未知";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function parseArgs(argv) {
  const params = {};
  for (const arg of argv) {
    const index = arg.indexOf("=");
    if (index === -1) continue;
    const key = arg.slice(0, index);
    const raw = arg.slice(index + 1);
    if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
      try {
        params[key] = JSON.parse(raw);
        continue;
      } catch (_) {}
    }
    params[key] = raw;
  }
  return params;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const params = parseArgs(args);
  const actions = {
    "search-place": () => searchPlaces(params),
    "place-details": () => placeDetails(params),
    "geocode": () => geocode(params),
    "directions": () => routePlaces({ ...params, points: JSON.parse(params.points || "[]") }),
    "usage": () => usageStatusAsync()
  };
  if (!actions[command]) {
    console.error("Usage: node app/toolkit/google.js search-place|place-details|geocode|directions key=value ...");
    process.exit(2);
  }
  const result = await actions[command]();
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  enabled,
  geocode,
  placeDetails,
  routePlaces,
  searchNearby,
  searchPlaces,
  usageStatus,
  usageStatusAsync
};
