"use strict";

const ORS_BASE_URL = (process.env.ORS_BASE_URL || "https://api.openrouteservice.org").replace(/\/+$/, "");

function straightLine(points, reason) {
  return {
    ok: !reason,
    source: "openrouteservice-fallback",
    data: {
      pointCount: points.length,
      line: points,
      geometry: {
        type: "LineString",
        coordinates: points.map(point => [point.lng, point.lat])
      },
      summary: reason || `${points.length} 个点位的直线占位路线；设置 ORS_API_KEY 后可接真实路网。`
    },
    rawText: "",
    stderr: reason || "",
    error: reason || null
  };
}

async function routePlaces(params) {
  const rawPoints = Array.isArray(params.points) ? params.points : [];
  const points = rawPoints.filter((point, index) => {
    const prev = rawPoints[index - 1];
    return !prev || prev.lat !== point.lat || prev.lng !== point.lng;
  });
  if (points.length < 2) return straightLine(points, "少于 2 个点，无法计算路线。");
  if (!process.env.ORS_API_KEY) return straightLine(points, "未配置 ORS_API_KEY，使用直线占位路线。");

  const profile = params.profile || process.env.ORS_PROFILE || "driving-car";
  const response = await fetch(`${ORS_BASE_URL}/v2/directions/${profile}/geojson`, {
    method: "POST",
    headers: {
      "authorization": process.env.ORS_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      coordinates: points.map(point => [point.lng, point.lat]),
      instructions: false,
      radiuses: points.map(() => Number(process.env.ORS_RADIUS_METERS || 5000))
    })
  });
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {}
  if (!response.ok || !data?.features?.[0]) {
    return straightLine(points, `OpenRouteService failed: HTTP ${response.status}`);
  }
  const feature = data.features[0];
  const summary = feature.properties?.summary || {};
  const distanceKm = Number.isFinite(summary.distance) ? `${(summary.distance / 1000).toFixed(1)} km` : "距离未知";
  const durationMin = Number.isFinite(summary.duration) ? `${Math.round(summary.duration / 60)} min` : "时间未知";
  return {
    ok: true,
    source: "openrouteservice",
    data: {
      pointCount: points.length,
      profile,
      line: points,
      geometry: feature.geometry,
      summary: `OpenRouteService ${profile}: ${distanceKm}, ${durationMin}`,
      distanceMeters: summary.distance,
      durationSeconds: summary.duration,
      mode: profile,
      ors: {
        bbox: data.bbox,
        properties: feature.properties
      }
    },
    rawText: text.slice(0, 20000),
    stderr: "",
    error: null
  };
}

module.exports = {
  routePlaces
};
