"use strict";

const booking = require("../toolkit/booking");
const airbnb = require("../toolkit/airbnb");
const fz = require("../toolkit/fz");
const memoryStore = require("./memoryStore");
const amap = require("../toolkit/amap");
const mapbox = require("../toolkit/mapbox");
const ors = require("../toolkit/ors");
const xhs = require("../toolkit/xhs");

const toolDefinitions = [
  {
    type: "function",
    name: "read_memory",
    description: "Read the user's persistent travel memory and preferences.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "append_memory_note",
    description: "Append one durable travel memory note when the user provides a stable preference, constraint, or past trip.",
    parameters: {
      type: "object",
      properties: {
        note: { type: "string" }
      },
      required: ["note"]
    }
  },
  {
    type: "function",
    name: "search_hotels",
    description: "Search Booking.com hotel candidates. Prefer this for normal hotel stays.",
    parameters: {
      type: "object",
      properties: {
        destination: { type: "string" },
        checkIn: { type: "string" },
        checkOut: { type: "string" },
        adults: { type: "integer" },
        rooms: { type: "integer" }
      },
      required: ["destination"]
    }
  },
  {
    type: "function",
    name: "search_homestays",
    description: "Search Airbnb-like stays. Prefer this when the user wants homestays, apartments, villas, kitchens, laundry, family or long stays.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string" },
        checkIn: { type: "string" },
        checkOut: { type: "string" },
        adults: { type: "integer" },
        propertyType: { type: "string" }
      },
      required: ["location"]
    }
  },
  {
    type: "function",
    name: "search_flights",
    description: "Search flight options, costs, and durations.",
    parameters: {
      type: "object",
      properties: {
        origin: { type: "string" },
        destination: { type: "string" },
        departDate: { type: "string" },
        returnDate: { type: "string" },
        adults: { type: "integer" }
      },
      required: ["origin", "destination"]
    }
  },
  {
    type: "function",
    name: "search_social_reviews",
    description: "Search Xiaohongshu social travel notes and comments.",
    parameters: {
      type: "object",
      properties: {
        keyword: { type: "string" },
        destination: { type: "string" },
        topic: { type: "string" }
      }
    }
  },
  {
    type: "function",
    name: "route_places",
    description: "Calculate or summarize a route for ordered places.",
    parameters: {
      type: "object",
      properties: {
        points: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              lat: { type: "number" },
              lng: { type: "number" }
            },
            required: ["name", "lat", "lng"]
          }
        }
      },
      required: ["points"]
    }
  },
  {
    type: "function",
    name: "search_nearby_places",
    description: "Search nearby map POIs such as restaurants, lodging, or attractions around a coordinate.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string" },
        center: {
          type: "object",
          properties: {
            lat: { type: "number" },
            lng: { type: "number" }
          },
          required: ["lat", "lng"]
        },
        limit: { type: "integer" },
        radiusMeters: { type: "integer" }
      },
      required: ["category", "center"]
    }
  }
];

async function executeTool(name, args) {
  switch (name) {
    case "read_memory":
      return { ok: true, source: "agent-memory", content: await memoryStore.readMemory() };
    case "append_memory_note":
      return { ok: true, source: "agent-memory", content: await memoryStore.appendMemoryNote(args.note) };
    case "search_hotels":
      return booking.searchHotels(args);
    case "search_homestays":
      return airbnb.searchHomestays(args);
    case "search_flights":
      return fz.searchFlights(args);
    case "search_social_reviews":
      return xhs.searchSocialReviews(args);
    case "route_places":
      if (isChinaRoute(args.points) && amap.enabled()) return amap.routePlaces(args);
      if (mapbox.enabled()) return mapbox.routePlaces(args);
      if (amap.enabled()) return amap.routePlaces(args);
      return ors.routePlaces(args);
    case "search_nearby_places":
      if (isChinaPoint(args.center) && amap.enabled()) return amap.searchNearby(args);
      if (mapbox.enabled()) return mapbox.searchNearby(args);
      if (amap.enabled()) return amap.searchNearby(args);
      return { ok: false, source: "map-search-fallback", items: [], error: "No map POI provider configured." };
    default:
      throw new Error(`unknown agent tool: ${name}`);
  }
}

module.exports = {
  executeTool,
  toolDefinitions
};

function isChinaRoute(points = []) {
  const usable = (Array.isArray(points) ? points : []).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  return usable.length > 0 && usable.every(point => point.lat >= 18 && point.lat <= 54 && point.lng >= 73 && point.lng <= 135);
}

function isChinaPoint(point = {}) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && point.lat >= 18 && point.lat <= 54 && point.lng >= 73 && point.lng <= 135;
}
