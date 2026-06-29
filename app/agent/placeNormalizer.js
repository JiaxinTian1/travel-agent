"use strict";

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hasCoordinates(place) {
  return Number.isFinite(place?.lat) && Number.isFinite(place?.lng);
}

function compactText(parts) {
  return parts
    .map(part => String(part || "").trim())
    .filter(Boolean)
    .join("｜");
}

function priceText(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /[¥￥$€£]/.test(text) ? text : `约 ${text}`;
}

function normalizeAirbnbResult(result, context = {}) {
  const rawItems = Array.isArray(result?.data?.searchResults) ? result.data.searchResults : [];
  return rawItems.map((raw, index) => {
    const listing = raw.demandStayListing || {};
    const coordinate = listing.location?.coordinate || {};
    const name = listing.description?.name?.localizedStringWithTranslationPreference || raw.name || `Airbnb ${index + 1}`;
    const price = raw.structuredDisplayPrice?.primaryLine?.accessibilityLabel;
    const place = {
      id: raw.id || listing.id || `airbnb_${index + 1}`,
      name,
      type: "hotel",
      category: "hotels",
      provider: "airbnb",
      source: "airbnb",
      lat: numberOrNull(coordinate.latitude),
      lng: numberOrNull(coordinate.longitude),
      url: raw.url || "",
      note: compactText(["Airbnb", raw.badges, raw.avgRatingA11yLabel, raw.structuredContent?.primaryLine, price]),
      confidence: "high",
      geocodingStatus: "provider-coordinates",
      raw
    };
    place.isMappable = hasCoordinates(place);
    if (!place.isMappable) {
      place.geocodingStatus = "missing-coordinates";
      place.geocodingQuery = compactText([name, context.destination]);
    }
    return place;
  });
}

function normalizeBookingResult(result, context = {}) {
  const rawItems = Array.isArray(result?.data?.properties) ? result.data.properties : [];
  const seen = new Set();
  return rawItems
    .filter(raw => {
      const key = raw.propertyId || raw.url || raw.name;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((raw, index) => {
      const place = {
        id: raw.propertyId || `booking_${index + 1}`,
        name: raw.name || `Booking hotel ${index + 1}`,
        type: "hotel",
        category: "hotels",
        provider: "booking",
        source: "booking",
        lat: numberOrNull(raw.lat ?? raw.latitude),
        lng: numberOrNull(raw.lng ?? raw.longitude),
        url: raw.url || "",
        note: compactText([
          "Booking",
          raw.reviewScore ? `评分 ${raw.reviewScore}` : "",
          raw.stars ? `${raw.stars} 星` : "",
          priceText(raw.pricePerNight),
          raw.distanceFromCenter
        ]),
        confidence: "medium",
        geocodingStatus: "missing-coordinates",
        geocodingQuery: compactText([raw.name, raw.location, context.destination]),
        raw
      };
      place.isMappable = hasCoordinates(place);
      if (place.isMappable) place.geocodingStatus = "provider-coordinates";
      return place;
    });
}

function normalizeMapResult(result, category = "hotels") {
  const rawItems = Array.isArray(result?.items) ? result.items : [];
  return rawItems.map((raw, index) => {
    const place = {
      id: raw.id || `map_${index + 1}`,
      name: raw.name || `Map place ${index + 1}`,
      type: raw.type || categoryType(category),
      category,
      provider: result?.source || raw.source || "map-search",
      source: result?.source || raw.source || "map-search",
      lat: numberOrNull(raw.lat),
      lng: numberOrNull(raw.lng),
      url: raw.url || "",
      note: compactText([raw.note, result?.source]),
      confidence: raw.confidence || "medium",
      featureType: raw.featureType || "",
      geocodingStatus: raw.featureType && raw.featureType !== "poi" ? "non-poi" : "map-poi",
      raw
    };
    place.isMappable = hasCoordinates(place) && (!place.featureType || place.featureType === "poi");
    return place;
  });
}

function categoryType(category) {
  if (category === "restaurants") return "restaurant";
  if (category === "hotels") return "hotel";
  if (category === "flights") return "flight";
  return "attraction";
}

function mappablePlaces(places) {
  return (places || []).filter(place => place.isMappable && hasCoordinates(place));
}

function toCandidatePoint(place, idPrefix = place?.type || "place") {
  if (!place || !place.isMappable || !hasCoordinates(place)) return null;
  return {
    id: `${idPrefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    name: place.name,
    type: place.type,
    lat: place.lat,
    lng: place.lng,
    note: place.note || `${place.provider || "provider"} 推荐`,
    source: place.source || place.provider || "provider",
    confidence: place.confidence || "medium",
    provider: place.provider,
    url: place.url || "",
    geocodingStatus: place.geocodingStatus || "provider-coordinates"
  };
}

module.exports = {
  hasCoordinates,
  mappablePlaces,
  normalizeAirbnbResult,
  normalizeBookingResult,
  normalizeMapResult,
  toCandidatePoint
};
