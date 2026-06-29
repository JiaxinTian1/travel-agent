"use strict";

const modelRunner = require("./modelRunner");
const memoryStore = require("./memoryStore");
const amap = require("../toolkit/amap");
const google = require("../toolkit/google");
const mapbox = require("../toolkit/mapbox");
const booking = require("../toolkit/booking");
const airbnb = require("../toolkit/airbnb");
const fz = require("../toolkit/fz");
const xhs = require("../toolkit/xhs");
const {
  mappablePlaces,
  normalizeAirbnbResult,
  normalizeBookingResult,
  normalizeMapResult,
  toCandidatePoint
} = require("./placeNormalizer");

const typeLabels = {
  restaurant: "餐厅",
  hotel: "住宿",
  attraction: "景点",
  flight: "机场"
};

const tripDates = ["9/25", "9/26", "9/27", "9/28", "9/29", "9/30", "10/1", "10/2"];
const timeBlocks = ["06:00-08:00", "08:00-10:00", "10:00-12:00", "12:00-14:00", "14:00-16:00", "16:00-18:00", "18:00-20:00", "20:00-22:00", "22:00-24:00"];

const recommendationCategories = new Set(["restaurants", "hotels", "attractions", "flights"]);

const fallbackJitter = {
  restaurants: [
    [0.0018, 0.0024, "当地餐厅备选｜需进一步核对营业时间"],
    [-0.0021, 0.0016, "区域餐厅备选｜适合按路线微调"],
    [0.0012, -0.0022, "特色餐饮区域｜建议结合地图复核"]
  ],
  hotels: [
    [0.0012, 0.0012, "住宿区域备选｜需进一步核对价格"],
    [-0.0014, 0.001, "住宿区域备选｜适合做路线基地"],
    [0.0008, -0.0015, "住宿区域备选｜建议结合 Booking/Airbnb 复核"]
  ],
  attractions: [
    [0.002, 0.0015, "景点区域备选｜需进一步核对开放信息"],
    [-0.0015, 0.002, "周边景点备选｜适合按路线串联"],
    [0.001, -0.002, "景点区域备选｜建议结合地图复核"]
  ],
  flights: []
};

function stablePlannerId(destination) {
  return `planner_${destination.seed || "seed"}_${destination.id}`;
}

function point(id, name, type, lat, lng, note, source = "agent-runner") {
  return { id, name, type, lat, lng, note, source, confidence: "medium" };
}

function distanceMeters(a, b) {
  if (!Number.isFinite(a?.lat) || !Number.isFinite(a?.lng) || !Number.isFinite(b?.lat) || !Number.isFinite(b?.lng)) return Infinity;
  const radius = 6371000;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function routeLocationId(item) {
  return item?.itemId || item?.id || "";
}

function coordinatesNear(a, b, tolerance = 0.00005) {
  return Number.isFinite(a?.lat)
    && Number.isFinite(a?.lng)
    && Number.isFinite(b?.lat)
    && Number.isFinite(b?.lng)
    && Math.abs(a.lat - b.lat) <= tolerance
    && Math.abs(a.lng - b.lng) <= tolerance;
}

function sameRouteLocation(a, b) {
  const aId = routeLocationId(a);
  const bId = routeLocationId(b);
  if (aId && bId && aId === bId) return true;
  return coordinatesNear(a, b);
}

function compactScheduledPoints(points) {
  const compacted = [];
  for (const entry of points) {
    const last = compacted[compacted.length - 1];
    if (last && sameRouteLocation(last.item, entry.item)) {
      last.endSlot = entry.slot;
      last.slots.push(entry.slot);
      continue;
    }
    compacted.push({ ...entry, endSlot: entry.slot, slots: [entry.slot] });
  }
  return compacted;
}

function destination(id, name, score, rank, detail, scores, seed, evidence = {}) {
  return { id, plannerId: stablePlannerId({ id, seed }), name, score, rank, detail, scores, seed, evidence };
}

function slugify(value, fallback = "destination") {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `${fallback}-${Math.abs(hash(value || fallback)).toString(36)}`;
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 5;
  return Math.max(0, Math.min(10, number));
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampNumber(value, min, max) {
  const number = numberOrNull(value);
  if (number === null) return null;
  return Math.max(min, Math.min(max, number));
}

function normalizeDetail(detail = {}) {
  return {
    nature: String(detail.nature || "自然特色待补充实时证据。"),
    culture: String(detail.culture || "人文特色待补充实时证据。"),
    weather: String(detail.weather || "季节天气待查。"),
    reviews: String(detail.reviews || "网络评价待接小红书/网页证据。"),
    flights: String(detail.flights || "航班数量待查。"),
    cost: String(detail.cost || "成本预算待查实时航班和住宿。"),
    premium: String(detail.premium || "价格溢价待跑对比日期。"),
    duration: String(detail.duration || "飞行时间待按出发地查询。"),
    ...detail
  };
}

function normalizeScores(scores = {}) {
  return {
    nature: clampScore(scores.nature),
    culture: clampScore(scores.culture),
    weather: clampScore(scores.weather),
    reviews: clampScore(scores.reviews),
    flights: clampScore(scores.flights),
    cost: clampScore(scores.cost),
    premium: clampScore(scores.premium),
    duration: clampScore(scores.duration)
  };
}

function totalScore(scores) {
  return Number((Object.values(scores).reduce((sum, score) => sum + score, 0) / 8 * 10).toFixed(1));
}

function normalizeEvidence(evidence = {}, detail = {}, scores = {}) {
  const cost = evidence.cost || {};
  const premium = evidence.premium || {};
  const flights = evidence.flights || {};
  const duration = evidence.duration || {};
  const weather = evidence.weather || {};
  const reviews = evidence.reviews || {};
  const nature = evidence.nature || {};
  const culture = evidence.culture || {};
  return {
    natureRating: clampNumber(evidence.natureRating ?? nature.rating ?? scores.nature, 0, 10),
    cultureRating: clampNumber(evidence.cultureRating ?? culture.rating ?? scores.culture, 0, 10),
    reviewRating: clampNumber(evidence.reviewRating ?? reviews.rating ?? scores.reviews, 0, 10),
    weatherRisk: clampNumber(evidence.weatherRisk ?? weather.risk, 0, 10),
    weatherRating: clampNumber(evidence.weatherRating ?? weather.rating ?? scores.weather, 0, 10),
    flightOptions: numberOrNull(evidence.flightOptions ?? flights.options ?? flights.count),
    avgFlightHours: numberOrNull(evidence.avgFlightHours ?? duration.avgHours ?? duration.hours),
    totalCostCny: numberOrNull(evidence.totalCostCny ?? cost.totalCny ?? cost.cny),
    premiumPercent: numberOrNull(evidence.premiumPercent ?? premium.percent),
    sources: Array.isArray(evidence.sources) ? evidence.sources : [],
    notes: String(evidence.notes || detail.summary || "")
  };
}

function scoreFromRange(value, values, { inverse = false, fallback = 5, minScore = 2, maxScore = 10 } = {}) {
  const numeric = values.filter(item => Number.isFinite(item));
  if (!Number.isFinite(value) || numeric.length < 2) return clampScore(fallback);
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  if (max === min) return clampScore(fallback);
  const ratio = (value - min) / (max - min);
  const adjusted = inverse ? 1 - ratio : ratio;
  return Number((minScore + adjusted * (maxScore - minScore)).toFixed(1));
}

function scoredCandidatesFromEvidence(candidates) {
  const all = candidates.map(candidate => candidate.evidence || {});
  const flightOptions = all.map(item => item.flightOptions);
  const costs = all.map(item => item.totalCostCny);
  const premiums = all.map(item => item.premiumPercent);
  const durations = all.map(item => item.avgFlightHours);
  return candidates.map(candidate => {
    const evidence = candidate.evidence || {};
    const rawScores = candidate.scores || {};
    const scores = {
      nature: clampScore(evidence.natureRating ?? rawScores.nature),
      culture: clampScore(evidence.cultureRating ?? rawScores.culture),
      weather: clampScore(evidence.weatherRisk !== null && evidence.weatherRisk !== undefined
        ? 10 - evidence.weatherRisk
        : evidence.weatherRating ?? rawScores.weather),
      reviews: clampScore(evidence.reviewRating ?? rawScores.reviews),
      flights: scoreFromRange(evidence.flightOptions, flightOptions, { fallback: rawScores.flights }),
      cost: scoreFromRange(evidence.totalCostCny, costs, { inverse: true, fallback: rawScores.cost }),
      premium: scoreFromRange(evidence.premiumPercent, premiums, { inverse: true, fallback: rawScores.premium }),
      duration: scoreFromRange(evidence.avgFlightHours, durations, { inverse: true, fallback: rawScores.duration })
    };
    return {
      ...candidate,
      scores,
      score: totalScore(scores),
      scoringModel: "evidence-v1"
    };
  });
}

function genericDetail(nature, summary, flights) {
  return {
    nature,
    culture: summary,
    weather: "季节窗口需要结合用户日期和实时天气再确认。",
    reviews: "社区评价待接小红书/网页证据。",
    flights,
    cost: "成本预算待查实时航班和 Booking/Airbnb。",
    premium: "价格溢价待跑三组对比日期。",
    duration: "飞行时间待按多出发地分别查询。"
  };
}

function compactContext(text, max = 280) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function applyResearchContext(set, context = {}) {
  const query = compactContext(context.query);
  const memory = compactContext(context.memory);
  set.query = context.query || "";
  set.memoryUsed = Boolean(memory);
  set.candidates.forEach(candidate => {
    if (query) candidate.detail.queryFit = `本轮 query 参考：${query}`;
    if (memory) candidate.detail.memoryFit = `记忆库参考：${memory}`;
  });
  return set;
}

function researchSet(seed, context = {}) {
  const sets = [
    {
      seed: `runner-global-${seed}-north`,
      candidates: [
        destination("albania-accursed-mountains", "阿尔巴尼亚 / 诅咒山脉 + 海岸", 74.6, 1, genericDetail("Theth、Valbona 山谷、蓝眼睛泉、亚得里亚海岸。", "巴尔干山地、人文小城和海岸组合，性价比通常好于西欧。", "三地到 Tirana 多为中转，需查具体日期。"), { nature: 9, culture: 7, weather: 7, reviews: 7, flights: 5, cost: 8, premium: 7, duration: 5 }, seed),
        destination("kyushu-volcano", "日本九州 / 火山温泉线", 72.2, 2, genericDetail("阿苏火山、雾岛、由布院、海岸线。", "温泉、火山、铁路/自驾成熟，适合首次多人协调。", "中国多地到福冈/熊本较容易。"), { nature: 8, culture: 8, weather: 7, reviews: 8, flights: 8, cost: 6, premium: 5, duration: 8 }, seed),
        destination("chile-atacama", "智利 / 阿塔卡马沙漠", 61.8, 3, genericDetail("盐湖、月亮谷、星空、火山高原。", "自然独特性很强，但长途飞行和高海拔适应成本高。", "三地飞行极长，通常多段转机。"), { nature: 10, culture: 6, weather: 8, reviews: 7, flights: 3, cost: 3, premium: 4, duration: 2 }, seed)
      ]
    },
    {
      seed: `runner-global-${seed}-south`,
      candidates: [
        destination("azores", "亚速尔群岛", 73.4, 1, genericDetail("火山湖、温泉、观鲸、海岸徒步。", "欧洲海岛里自然密度很高，适合慢节奏自驾。", "三地到 Ponta Delgada 转机较多。"), { nature: 9, culture: 6, weather: 7, reviews: 8, flights: 4, cost: 5, premium: 6, duration: 4 }, seed),
        destination("laos-north", "老挝北部 / 琅勃拉邦 + 山地", 71.9, 2, genericDetail("湄公河、瀑布、山地村镇、慢节奏小城。", "人文轻松、成本友好，适合不想长途飞的人。", "中国多地到万象/琅勃拉邦相对可控。"), { nature: 7, culture: 8, weather: 6, reviews: 7, flights: 7, cost: 9, premium: 7, duration: 7 }, seed),
        destination("namibia-north", "纳米比亚 / 沙漠与野生动物", 63.6, 3, genericDetail("纳米布沙漠、红沙丘、Etosha、海岸荒漠。", "自然震撼但交通、预算和驾驶强度都高。", "三地飞行很长且机票风险高。"), { nature: 10, culture: 6, weather: 8, reviews: 7, flights: 3, cost: 3, premium: 4, duration: 2 }, seed)
      ]
    }
  ];
  return applyResearchContext(sets[Math.abs(hash(seed)) % sets.length], context);
}

function hash(value) {
  return String(value).split("").reduce((sum, char) => ((sum << 5) - sum + char.charCodeAt(0)) | 0, 0);
}

async function rerollResearch(state, context = {}) {
  const seed = Date.now().toString(36).slice(-6);
  let set = null;
  if (modelRunner.isEnabled()) {
    try {
      const previous = state.researcher.sets
        .flatMap(item => item.candidates || [])
        .map(candidate => candidate.name)
        .filter(Boolean);
      const generated = await modelRunner.researchDestinationsWithModel({
        query: context.query || "",
        memory: context.memory || "",
        seed,
        previous
      });
      set = await normalizeResearchSet(generated, seed, context);
    } catch (error) {
      state.researcher.lastAgentError = error.message;
    }
  }
  if (!set) set = researchSet(seed, context);
  state.researcher.sets.unshift(set);
  state.researcher.setIndex = 0;
  state.activeTab = "researcher";
  return { state, set };
}

async function normalizeResearchSet(generated, seed, context = {}) {
  const candidates = Array.isArray(generated?.candidates) ? generated.candidates : [];
  if (!candidates.length) return null;
  const normalized = candidates.slice(0, 6).map((candidate, index) => {
    const modelScores = normalizeScores(candidate.scores);
    const detail = normalizeDetail(candidate.detail);
    const evidence = normalizeEvidence(candidate.evidence, detail, modelScores);
    const id = slugify(candidate.id || candidate.name, `destination-${index + 1}`);
    return destination(
      id,
      String(candidate.name || `候选目的地 ${index + 1}`),
      0,
      index + 1,
      detail,
      modelScores,
      `llm-${seed}`,
      evidence
    );
  });
  const enriched = await enrichResearchCandidates(normalized, context);
  const scored = scoredCandidatesFromEvidence(enriched);
  scored.sort((a, b) => Number(b.score) - Number(a.score));
  scored.forEach((candidate, index) => {
    candidate.rank = index + 1;
    candidate.plannerId = stablePlannerId(candidate);
  });
  return applyResearchContext({
    seed: `llm-${seed}`,
    summary: String(generated?.summary || "LLM 先生成候选和结构化证据，runner 使用 evidence-v1 公式重算评分。"),
    source: "llm-agent",
    scoringModel: "evidence-v1",
    candidates: scored
  }, context);
}

async function enrichResearchCandidates(candidates, context = {}) {
  const travel = parseTravelContext(context.query || "");
  return Promise.all(candidates.map(candidate => enrichResearchCandidate(candidate, travel)));
}

async function enrichResearchCandidate(candidate, travel) {
  const baseEvidence = { ...(candidate.evidence || {}) };
  const sources = new Set(baseEvidence.sources || []);
  const errors = [];
  const destination = candidate.name;
  const adults = travel.adults || 1;
  const flightOrigin = travel.origins.length ? travel.origins.join("/") : "";
  const flightTimeout = Number(process.env.RESEARCH_FLIGHT_TIMEOUT || 45000);
  const bookingTimeout = Number(process.env.RESEARCH_BOOKING_TIMEOUT || 45000);
  const airbnbTimeout = Number(process.env.RESEARCH_AIRBNB_TIMEOUT || 45000);
  const xhsTimeout = Number(process.env.RESEARCH_XHS_TIMEOUT || 45000);
  const calls = [
    withTimeout(fz.searchFlights({
      origin: flightOrigin,
      destination,
      departDate: travel.departDate,
      returnDate: travel.returnDate,
      adults,
      timeoutMs: flightTimeout
    }), flightTimeout + 1000).then(result => ({ kind: "flights", result })).catch(error => ({ kind: "flights", error })),
    withTimeout(booking.searchHotels({
      destination,
      checkIn: travel.departDate,
      checkOut: travel.returnDate,
      adults,
      rooms: 1,
      timeoutMs: bookingTimeout
    }), bookingTimeout + 1000).then(result => ({ kind: "booking", result })).catch(error => ({ kind: "booking", error })),
    withTimeout(airbnb.searchHomestays({
      location: destination,
      checkIn: travel.departDate,
      checkOut: travel.returnDate,
      adults,
      timeoutMs: airbnbTimeout
    }), airbnbTimeout + 1000).then(result => ({ kind: "airbnb", result })).catch(error => ({ kind: "airbnb", error })),
    withTimeout(xhs.searchSocialReviews({
      keyword: `${destination} 旅行 评价`,
      destination,
      topic: "旅行评价",
      timeoutMs: xhsTimeout
    }), xhsTimeout + 1000).then(result => ({ kind: "xhs", result })).catch(error => ({ kind: "xhs", error }))
  ];
  const results = await Promise.all(calls);
  const toolEvidence = {};
  const detailPatch = {};
  for (const item of results) {
    if (item.error) {
      errors.push(`${item.kind}: ${item.error.message || item.error}`);
      continue;
    }
    const text = resultText(item.result);
    if (item.result?.ok) sources.add(item.kind);
    if (item.kind === "flights") {
      const parsed = parseFlightEvidence(text, item.result?.data);
      Object.assign(toolEvidence, parsed.evidence);
      if (parsed.detail) {
        detailPatch.flights = parsed.detail.flights;
        detailPatch.duration = parsed.detail.duration;
      }
    } else if (item.kind === "booking" || item.kind === "airbnb") {
      const parsed = parseLodgingEvidence(text, item.result?.data);
      if (parsed.totalCostCny !== null) {
        const previous = toolEvidence.totalCostCny ?? baseEvidence.totalCostCny;
        toolEvidence.totalCostCny = previous ? Math.round(previous + parsed.totalCostCny) : parsed.totalCostCny;
      }
      if (parsed.detail) detailPatch.cost = [detailPatch.cost, parsed.detail].filter(Boolean).join("；");
    } else if (item.kind === "xhs") {
      const parsed = parseReviewEvidence(text, item.result?.data);
      if (parsed.reviewRating !== null) toolEvidence.reviewRating = parsed.reviewRating;
      if (parsed.detail) detailPatch.reviews = parsed.detail;
    }
  }
  const evidence = normalizeEvidence({
    ...baseEvidence,
    ...toolEvidence,
    sources: [...sources],
    notes: [baseEvidence.notes, errors.length ? `tool errors: ${errors.slice(0, 3).join(" | ")}` : ""].filter(Boolean).join("；")
  }, candidate.detail, candidate.scores);
  return {
    ...candidate,
    detail: {
      ...candidate.detail,
      ...detailPatch
    },
    evidence
  };
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
    Promise.resolve(promise)
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function resultText(result) {
  return [
    typeof result?.rawText === "string" ? result.rawText : "",
    typeof result?.stderr === "string" ? result.stderr : "",
    result?.data ? JSON.stringify(result.data).slice(0, 12000) : ""
  ].filter(Boolean).join("\n");
}

function parseTravelContext(query) {
  const text = String(query || "");
  const knownOrigins = ["上海", "北京", "重庆", "广州", "深圳", "成都", "杭州", "南京", "武汉", "西安", "香港", "台北", "天津", "青岛", "厦门"];
  const origins = knownOrigins.filter(city => text.includes(city)).slice(0, 4);
  const dates = [...text.matchAll(/(\d{1,2})[/-](\d{1,2})/g)].map(match => `${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`);
  const year = new Date().getFullYear();
  return {
    origins,
    departDate: dates[0] ? `${year}-${dates[0]}` : "",
    returnDate: dates[1] ? `${year}-${dates[1]}` : "",
    adults: Math.max(1, origins.length || Number((text.match(/(\d+)\s*人/) || [])[1]) || 1)
  };
}

function parseFlightEvidence(text, data) {
  const source = `${text || ""}\n${data ? JSON.stringify(data) : ""}`;
  const prices = extractCnyValues(source);
  const durations = extractHourValues(source);
  const flightOptions = countMatches(source, /(航班|flight|Flight|班次|中转|直飞)/g);
  const avgPrice = average(prices);
  const avgHours = average(durations);
  return {
    evidence: {
      flightOptions: flightOptions || null,
      avgFlightHours: avgHours,
      totalCostCny: avgPrice ? Math.round(avgPrice) : null
    },
    detail: prices.length || durations.length || flightOptions
      ? {
          flights: `工具查询：约 ${flightOptions || "若干"} 个航班/航段线索。`,
          duration: avgHours ? `工具查询平均飞行/行程时间约 ${avgHours.toFixed(1)} 小时。` : "工具已查航班，飞行时间需人工核对。"
        }
      : null
  };
}

function parseLodgingEvidence(text, data) {
  const source = `${text || ""}\n${data ? JSON.stringify(data) : ""}`;
  const prices = extractCnyValues(source);
  const avg = average(prices);
  return {
    totalCostCny: avg ? Math.round(avg) : null,
    detail: avg ? `住宿工具查询均价线索约 ¥${Math.round(avg)}。` : ""
  };
}

function parseReviewEvidence(text, data) {
  const source = `${text || ""}\n${data ? JSON.stringify(data) : ""}`;
  const positive = countMatches(source, /(推荐|好玩|值得|漂亮|震撼|方便|美|喜欢|不错|惊喜)/g);
  const negative = countMatches(source, /(避雷|踩雷|不好|失望|贵|坑|排队|危险|累|脏|不推荐)/g);
  const total = positive + negative;
  const rating = total ? Number((5 + ((positive - negative) / total) * 4).toFixed(1)) : null;
  return {
    reviewRating: rating === null ? null : clampScore(rating),
    detail: total ? `小红书/社区线索：正向 ${positive}，负向 ${negative}，情绪评分约 ${clampScore(rating)}。` : ""
  };
}

function extractCnyValues(text) {
  return [...String(text || "").matchAll(/(?:¥|￥|CNY|RMB|人民币|元)\s*([0-9][0-9,]*(?:\.\d+)?)/gi)]
    .map(match => Number(match[1].replace(/,/g, "")))
    .filter(value => Number.isFinite(value) && value > 50 && value < 200000);
}

function extractHourValues(text) {
  return [...String(text || "").matchAll(/([0-9]+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours|小时)/gi)]
    .map(match => Number(match[1]))
    .filter(value => Number.isFinite(value) && value > 0 && value < 80);
}

function countMatches(text, pattern) {
  return [...String(text || "").matchAll(pattern)].length;
}

function average(values) {
  const filtered = values.filter(value => Number.isFinite(value));
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function findDestination(state, key) {
  return state.researcher.sets
    .flatMap(set => set.candidates)
    .find(candidate => stablePlannerId(candidate) === key || candidate.id === key || candidate.plannerId === key);
}

function plannerForDestination(state, destination) {
  const id = stablePlannerId(destination);
  return state.planners.find(planner => planner.id === id || (planner.destinationId === destination.id && planner.researchSeed === destination.seed));
}

function createPlanner(state, destinationKey) {
  const destination = findDestination(state, destinationKey);
  if (!destination) {
    const error = new Error("destination not found");
    error.statusCode = 404;
    throw error;
  }
  const existing = plannerForDestination(state, destination);
  if (existing) {
    ensurePlannerPlaceCoordinates(existing);
    openPlanner(state, existing.id);
    state.activeTab = existing.id;
    return { state, planner: existing, created: false };
  }
  const planner = makePlanner(destination);
  state.planners.push(planner);
  openPlanner(state, planner.id);
  state.activeTab = planner.id;
  return { state, planner, created: true };
}

function openPlanner(state, id) {
  if (!state.openPlannerIds.includes(id)) state.openPlannerIds.push(id);
}

function makePlanner(destination) {
  const id = stablePlannerId(destination);
  const planner = {
    id,
    destinationId: destination.id,
    researchSeed: destination.seed,
    title: `${destination.name} planner`,
    destinationName: destination.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    candidates: baseCandidates(destination),
    staging: [],
    itinerary: {},
    route: null
  };
  prefillPlanner(planner);
  ensurePlannerPlaceCoordinates(planner);
  return planner;
}

function baseCandidates(destination) {
  if (destination.id === "georgia-caucasus") return georgiaCandidates();
  const defaults = destinationDefaults(destination);
  return {
    restaurants: [point("r1", defaults.restaurant.name, "restaurant", defaults.restaurant.lat, defaults.restaurant.lng, "由 agent 后续补充")],
    hotels: [point("h1", defaults.hotel.name, "hotel", defaults.hotel.lat, defaults.hotel.lng, "由 Booking/Airbnb 后续补充")],
    attractions: [point("a1", defaults.attraction.name || destination.name, "attraction", defaults.attraction.lat, defaults.attraction.lng, "核心目的地占位")],
    flights: (defaults.airports || [defaults.flight]).map((airport, index) => point(`f${index + 1}`, airport.name, "flight", airport.lat, airport.lng, airport.note || "主要机场"))
  };
}

function destinationDefaults(destination) {
  const defaults = {
    "albania-accursed-mountains": {
      flight: { name: "Tirana International Airport", lat: 41.4147, lng: 19.7206 },
      restaurant: { name: "Shkoder old town restaurant area", lat: 42.0686, lng: 19.5126 },
      hotel: { name: "Theth village guesthouse area", lat: 42.3959, lng: 19.7745 },
      attraction: { name: "Theth / Valbona mountain route", lat: 42.4309, lng: 19.8496 },
      airports: [
        { name: "Tirana International Airport", lat: 41.4147, lng: 19.7206, note: "阿尔巴尼亚主机场｜TIA" },
        { name: "Kukes International Airport", lat: 42.0337, lng: 20.4159, note: "北部备选机场｜KFZ" }
      ]
    },
    "azores": {
      flight: { name: "Ponta Delgada Airport", lat: 37.7412, lng: -25.6979 },
      restaurant: { name: "Ponta Delgada restaurant area", lat: 37.7410, lng: -25.6756 },
      hotel: { name: "Ponta Delgada hotel area", lat: 37.7394, lng: -25.6687 },
      attraction: { name: "Sete Cidades", lat: 37.8620, lng: -25.7948 },
      airports: [
        { name: "Ponta Delgada Airport", lat: 37.7412, lng: -25.6979, note: "圣米格尔岛主机场｜PDL" },
        { name: "Lajes Airport", lat: 38.7618, lng: -27.0908, note: "特塞拉岛机场｜TER" },
        { name: "Horta Airport", lat: 38.5199, lng: -28.7159, note: "法亚尔岛机场｜HOR" }
      ]
    },
    "laos-north": {
      flight: { name: "Luang Prabang Airport", lat: 19.8973, lng: 102.1608 },
      restaurant: { name: "Luang Prabang old town restaurant area", lat: 19.8856, lng: 102.1348 },
      hotel: { name: "Luang Prabang old town hotel area", lat: 19.8871, lng: 102.1359 },
      attraction: { name: "Kuang Si Waterfall", lat: 19.7493, lng: 101.9920 },
      airports: [
        { name: "Luang Prabang Airport", lat: 19.8973, lng: 102.1608, note: "琅勃拉邦机场｜LPQ" },
        { name: "Wattay International Airport", lat: 17.9883, lng: 102.5633, note: "万象国际机场｜VTE" },
        { name: "Oudomxay Airport", lat: 20.6827, lng: 101.9940, note: "北部山区机场｜ODY" }
      ]
    }
  };
  return defaults[destination.id] || {
    flight: { name: "主要机场待确认", lat: 41.6692, lng: 44.9547, note: "由 agent 后续补充机场清单" },
    restaurant: { name: "当地特色餐厅待查", lat: 41.7151, lng: 44.8271 },
    hotel: { name: "核心住宿区域待选", lat: 41.7151, lng: 44.8271 },
    attraction: { name: destination.name, lat: 41.7151, lng: 44.8271 }
  };
}

function knownCoordinateCorrections(planner) {
  if (planner.destinationId !== "albania-accursed-mountains") return [];
  return [
    {
      id: "a1",
      namePattern: /theth\s*\/\s*valbona|valbona mountain|valbona pass|mountain route/i,
      old: { lat: 42.3959, lng: 19.7745 },
      lat: 42.4309,
      lng: 19.8496,
      note: "Theth / Valbona 山线区域｜Valbona Pass 一带"
    }
  ];
}

function matchesCoordinateCorrection(item, correction) {
  if (!item) return false;
  const id = routeLocationId(item);
  if (id && id === correction.id) return true;
  return correction.namePattern.test(String(item.name || ""));
}

function shouldApplyCoordinateCorrection(item, correction) {
  if (coordinatesNear(item, correction)) return false;
  if (correction.old && coordinatesNear(item, correction.old)) return true;
  const source = String(item.source || "");
  const note = String(item.note || "");
  return ["agent-runner", "sample"].includes(source) || /占位|待查|核心景点/.test(note);
}

function ensurePlannerPlaceCoordinates(planner) {
  const corrections = knownCoordinateCorrections(planner);
  if (!corrections.length) return false;
  let changed = false;
  const applyCorrection = item => {
    const correction = corrections.find(candidate => matchesCoordinateCorrection(item, candidate));
    if (!correction || !shouldApplyCoordinateCorrection(item, correction)) return;
    item.lat = correction.lat;
    item.lng = correction.lng;
    if (!item.note || /占位|待查|核心景点/.test(item.note)) item.note = correction.note;
    else if (!String(item.note).includes("山线区域")) item.note = `${item.note}｜坐标修正为山线区域`;
    changed = true;
  };
  Object.values(planner.candidates || {}).flat().forEach(applyCorrection);
  Object.values(planner.itinerary || {}).forEach(applyCorrection);
  (planner.staging || []).forEach(applyCorrection);
  if (changed) planner.updatedAt = new Date().toISOString();
  return changed;
}

function georgiaCandidates() {
  return {
    restaurants: [
      point("r1", "Shavi Lomi", "restaurant", 41.6987, 44.8064, "格鲁吉亚菜｜晚餐｜需预约"),
      point("r2", "Cafe Littera", "restaurant", 41.6947, 44.8001, "庭院餐厅｜当地菜"),
      point("r3", "Mapshalia", "restaurant", 41.7101, 44.7992, "家常菜｜预算友好"),
      point("r4", "Rooms Hotel Kazbegi Restaurant", "restaurant", 42.6575, 44.6414, "Kazbegi｜山景晚餐"),
      point("r5", "Salobie Bia", "restaurant", 41.6957, 44.8017, "当地菜｜午餐")
    ],
    hotels: [
      point("h1", "Rooms Hotel Tbilisi", "hotel", 41.7041, 44.7878, "Vera 区｜城市基地"),
      point("h2", "Stamba Hotel", "hotel", 41.7045, 44.7871, "Vera 区｜设计酒店"),
      point("h3", "Rooms Hotel Kazbegi", "hotel", 42.6575, 44.6414, "Kazbegi｜山景基地")
    ],
    attractions: [
      point("a1", "Narikala Fortress", "attraction", 41.6880, 44.8086, "老城高点"),
      point("a2", "Sulfur Baths", "attraction", 41.6877, 44.8115, "硫磺浴区"),
      point("a3", "Gergeti Trinity Church", "attraction", 42.6620, 44.6208, "Kazbegi 标志景观"),
      point("a4", "Zhinvali Reservoir", "attraction", 42.1646, 44.7715, "去 Kazbegi 路上湖景"),
      point("a5", "Jvari Monastery", "attraction", 41.8387, 44.7339, "Mtskheta 高点"),
      point("a6", "Chronicle of Georgia", "attraction", 41.7712, 44.8106, "城市北部纪念碑")
    ],
    flights: [
      point("f0", "Tbilisi International Airport", "flight", 41.6692, 44.9547, "第比利斯主机场｜TBS"),
      point("f1", "Kutaisi International Airport", "flight", 42.1767, 42.4826, "库塔伊西机场｜KUT"),
      point("f2", "Batumi International Airport", "flight", 41.6103, 41.5997, "巴统机场｜BUS")
    ]
  };
}

function put(planner, date, time, id, note) {
  const item = Object.values(planner.candidates).flat().find(candidate => candidate.id === id);
  if (!item) return;
  planner.itinerary[`${date}|${time}`] = { ...item, instanceId: `${id}_${date}_${time}`, itemId: id, note: note || item.note };
}

function prefillPlanner(planner) {
  if (planner.destinationId !== "georgia-caucasus") {
    put(planner, "9/25", "06:00-08:00", "f1", "多出发地抵达机场待查");
    put(planner, "9/25", "12:00-14:00", "r1", "午餐待查");
    put(planner, "9/25", "14:00-16:00", "a1", "核心景点占位");
    put(planner, "9/25", "22:00-24:00", "h1", "住宿待选");
    return;
  }
  put(planner, "9/25", "06:00-08:00", "f0", "上海/北京/重庆分别飞往 TBS");
  put(planner, "9/25", "08:00-10:00", "f0", "入境/取行李/等待所有人集合");
  put(planner, "9/25", "10:00-12:00", "h1", "TBS -> 酒店｜机场交通估算");
  put(planner, "9/25", "12:00-14:00", "r3", "午餐｜家常格鲁吉亚菜");
  put(planner, "9/25", "14:00-16:00", "a1", "老城高点");
  put(planner, "9/25", "16:00-18:00", "a2", "硫磺浴区");
  put(planner, "9/25", "18:00-20:00", "r1", "晚餐｜建议预约");
  put(planner, "9/25", "22:00-24:00", "h1", "住宿");
  put(planner, "9/26", "08:00-10:00", "a4", "Tbilisi -> Zhinvali");
  put(planner, "9/26", "12:00-14:00", "r4", "午餐｜Kazbegi 山景基地");
  put(planner, "9/26", "14:00-16:00", "a3", "Gergeti Trinity Church");
  put(planner, "9/26", "22:00-24:00", "h3", "住宿");
}

async function recommendPlace(state, plannerId, category, options = {}) {
  const prompt = String(options.prompt || "").trim();
  const planner = state.planners.find(item => item.id === plannerId);
  if (!planner) {
    const error = new Error("planner not found");
    error.statusCode = 404;
    throw error;
  }
  if (!recommendationCategories.has(category) || !planner.candidates[category]) {
    const error = new Error("unknown category");
    error.statusCode = 400;
    throw error;
  }
  ensurePlannerPlaceCoordinates(planner);
  let item = null;
  try {
    item = category === "hotels"
      ? await recommendFromLodgingProviders(planner, prompt)
      : await recommendFromMap(planner, category, prompt);
    if (!item) item = await recommendFromMap(planner, category, prompt);
  } catch (error) {
    planner.lastMapSearchError = error.message;
  }
  if (!item && modelRunner.isEnabled()) {
    try {
      const suggested = await modelRunner.recommendPlaceWithModel({
        planner,
        category,
        prompt,
        memory: await memoryStore.readMemory()
      });
      if (suggested?.name && suggested?.type && Number.isFinite(Number(suggested.lat)) && Number.isFinite(Number(suggested.lng))) {
        const candidate = point(
          `${suggested.type}_${Date.now()}`,
          suggested.name,
          suggested.type,
          Number(suggested.lat),
          Number(suggested.lng),
          suggested.note || prompt || "按当前行程推荐",
          "llm-agent"
        );
        if (isReasonableRecommendation(planner, candidate, category)) item = candidate;
        else planner.lastAgentError = `LLM 推荐坐标偏离当前 planner：${candidate.name}`;
      }
    } catch (error) {
      planner.lastAgentError = error.message;
    }
  }
  if (!item) {
    item = destinationFallbackRecommendation(planner, category, prompt);
  }
  planner.candidates[category].push(item);
  planner.updatedAt = new Date().toISOString();
  return { state, planner, item };
}

function isReasonableRecommendation(planner, item, category) {
  if (!Number.isFinite(item?.lat) || !Number.isFinite(item?.lng)) return false;
  const anchors = [
    ...Object.values(planner.itinerary || {}),
    ...Object.values(planner.candidates || {}).flat()
  ].filter(anchor => anchor?.type !== "flight" && Number.isFinite(anchor?.lat) && Number.isFinite(anchor?.lng));
  if (!anchors.length) return true;
  const nearest = Math.min(...anchors.map(anchor => distanceMeters(anchor, item)));
  const threshold = category === "attractions" ? 250000 : 90000;
  return nearest <= threshold;
}

function destinationFallbackRecommendation(planner, category, prompt = "") {
  const defaults = destinationDefaults({ id: planner.destinationId, name: planner.destinationName });
  const base = defaults[category === "restaurants" ? "restaurant" : category === "hotels" ? "hotel" : category === "attractions" ? "attraction" : "flight"];
  const type = categoryType(category);
  const existingCount = planner.candidates?.[category]?.length || 0;
  const variants = fallbackJitter[category] || [];
  const variant = variants[existingCount % Math.max(1, variants.length)] || [0, 0, "目的地备选｜需进一步核对"];
  const baseName = base?.name || `${planner.destinationName} ${typeLabels[type]}备选`;
  const suffix = existingCount > 0 ? ` #${existingCount + 1}` : "";
  const note = [variant[2], prompt].filter(Boolean).join("｜");
  return point(
    `${type}_${Date.now()}`,
    `${baseName}${suffix}`,
    type,
    Number(base?.lat) + variant[0],
    Number(base?.lng) + variant[1],
    note,
    "agent-runner-fallback"
  );
}

async function recommendFromLodgingProviders(planner, prompt = "") {
  const context = lodgingSearchContext(planner, prompt);
  const prefersHomestay = /民宿|airbnb|homestay|bnb|apartment|公寓|木屋|villa|别墅/i.test(prompt);
  const providers = prefersHomestay ? ["airbnb", "booking"] : ["booking", "airbnb"];
  const existing = new Set(Object.values(planner.candidates || {}).flat().map(candidate => candidate.name));
  const errors = [];
  for (const provider of providers) {
    try {
      const timeoutMs = provider === "booking"
        ? Number(process.env.PLANNER_BOOKING_TIMEOUT || 25000)
        : Number(process.env.PLANNER_AIRBNB_TIMEOUT || 25000);
      const result = provider === "booking"
        ? await withTimeout(booking.searchHotels({
          destination: context.destination,
          checkIn: context.checkIn,
          checkOut: context.checkOut,
          adults: context.adults,
          rooms: 1,
          timeoutMs
        }), timeoutMs + 1000)
        : await withTimeout(airbnb.searchHomestays({
          location: context.destination,
          checkIn: context.checkIn,
          checkOut: context.checkOut,
          adults: context.adults,
          timeoutMs
        }), timeoutMs + 1000);
      let places = provider === "booking"
        ? normalizeBookingResult(result, context)
        : normalizeAirbnbResult(result, context);
      if (provider === "booking") places = await geocodeUnmappedPlaces(places, context);
      rememberUnmappedPlaces(planner, "hotels", places.filter(place => !place.isMappable));
      const found = mappablePlaces(places).find(place => !existing.has(place.name));
      if (found) return toCandidatePoint(found, "hotel");
    } catch (error) {
      errors.push(`${provider}: ${error.message || error}`);
    }
  }
  if (errors.length) planner.lastLodgingProviderError = errors.join(" | ");
  return null;
}

async function geocodeUnmappedPlaces(places, context = {}) {
  if (!google.enabled()) return places;
  const resolved = [];
  for (const place of places.slice(0, 5)) {
    if (place.isMappable) {
      resolved.push(place);
      continue;
    }
    const query = place.geocodingQuery || [place.name, context.destination].filter(Boolean).join(", ");
    const result = await google.geocode({ address: query, category: place.category || "hotels" });
    const item = result?.items?.find(row => row.featureType === "poi");
    if (item && Number.isFinite(item.lat) && Number.isFinite(item.lng)) {
      resolved.push({
        ...place,
        lat: item.lat,
        lng: item.lng,
        note: [place.note, `Google geocode: ${item.note || item.name}`].filter(Boolean).join("｜"),
        confidence: item.featureType === "poi" ? "high" : "medium",
        geocodingStatus: item.featureType === "poi" ? "google-poi" : "google-geocode",
        isMappable: true,
        source: place.source || "booking",
        provider: place.provider || "booking"
      });
    } else {
      resolved.push(place);
    }
  }
  return [...resolved, ...places.slice(5)];
}

function lodgingSearchContext(planner, prompt = "") {
  const range = plannerDateRange(planner);
  return {
    destination: lodgingDestination(planner, prompt),
    checkIn: range.checkIn,
    checkOut: range.checkOut,
    adults: Number(process.env.PLANNER_ADULTS || 2)
  };
}

function lodgingDestination(planner, prompt = "") {
  const cleanPrompt = String(prompt || "").trim();
  if (cleanPrompt) return cleanPrompt;
  const center = recommendationCenter(planner);
  const centerName = center?.name
    ? String(center.name).replace(/\b(old town|restaurant|hotel|guesthouse|area|route)\b/gi, "").replace(/\s+/g, " ").trim()
    : "";
  return [centerName, planner.destinationName].filter(Boolean).join(" ");
}

function plannerDateRange(planner) {
  const dates = Object.keys(planner.itinerary || {})
    .map(slot => String(slot).split("|")[0])
    .map(dateLabelToDate)
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  const checkInDate = dates[0] || new Date(Date.UTC(new Date().getFullYear(), 8, 25));
  const checkOutDate = new Date((dates[dates.length - 1] || checkInDate).getTime());
  checkOutDate.setUTCDate(checkOutDate.getUTCDate() + 1);
  return {
    checkIn: isoDate(checkInDate),
    checkOut: isoDate(checkOutDate)
  };
}

function dateLabelToDate(label) {
  const match = String(label || "").match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const year = Number(process.env.TRAVEL_YEAR || new Date().getFullYear());
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function rememberUnmappedPlaces(planner, category, places) {
  const compact = places
    .filter(place => place?.name)
    .map(place => ({
      id: place.id,
      name: place.name,
      type: place.type,
      category,
      provider: place.provider,
      source: place.source,
      note: place.note,
      url: place.url,
      geocodingStatus: place.geocodingStatus,
      geocodingQuery: place.geocodingQuery,
      isMappable: false
    }));
  if (!compact.length) return;
  planner.unmappedCandidates = planner.unmappedCandidates || {};
  const existing = new Map((planner.unmappedCandidates[category] || []).map(place => [`${place.provider}:${place.id || place.name}`, place]));
  compact.forEach(place => existing.set(`${place.provider}:${place.id || place.name}`, place));
  planner.unmappedCandidates[category] = [...existing.values()].slice(-20);
}

async function importPlaceToStaging(state, plannerId, input) {
  const planner = state.planners.find(item => item.id === plannerId);
  if (!planner) {
    const error = new Error("planner not found");
    error.statusCode = 404;
    throw error;
  }
  const query = String(input?.query || input?.text || input?.place || "").trim();
  if (!query) {
    const error = new Error("place query is required");
    error.statusCode = 400;
    throw error;
  }
  ensurePlannerPlaceCoordinates(planner);
  const preferredCategory = normalizeCategory(input?.category || inferPlaceCategory(query));
  const expandedUrl = await expandMapUrl(query);
  const coordinateSource = [query, expandedUrl].filter(Boolean).join("\n");
  const coordinates = coordinatesFromText(coordinateSource);
  if (coordinates) {
    const type = categoryType(preferredCategory);
    const importedName = cleanupImportedPlaceName(expandedUrl || query) || "用户导入地点";
    const item = point(
      `${type}_${Date.now()}`,
      importedName,
      type,
      coordinates.lat,
      coordinates.lng,
      expandedUrl ? "用户导入｜Google Maps 短链解析坐标" : "用户导入｜Google Maps 坐标",
      "manual-import"
    );
    const staged = {
      ...item,
      instanceId: `${item.id}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      itemId: item.id
    };
    planner.staging = planner.staging || [];
    planner.staging.push(staged);
    planner.updatedAt = new Date().toISOString();
    return { state, planner, item: staged, source: "manual-import" };
  }
  let result = null;
  const searchQuery = cleanupImportedPlaceName(expandedUrl || query);
  if (google.enabled()) {
    result = await google.searchPlaces({
      query: searchQuery === "用户导入地点" ? query : searchQuery,
      category: preferredCategory,
      destination: planner.destinationName,
      language: "zh-CN",
      limit: 8
    });
  }
  if ((!result?.items?.length) && mapbox.enabled()) {
    result = await mapbox.searchText({
      query: searchQuery === "用户导入地点" ? query : searchQuery,
      category: preferredCategory,
      destination: planner.destinationName,
      language: "zh",
      limit: 8
    });
  }
  const found = (result?.items || [])[0];
  if (found && found.featureType !== "poi" && ["restaurants", "hotels", "attractions"].includes(preferredCategory)) {
    const error = new Error("地图服务只找到了城市/地址，没有命中具体地点；请粘贴带坐标的 Google Maps 链接，或补充更完整的店名和城市。");
    error.statusCode = 404;
    throw error;
  }
  const type = found?.type || categoryType(preferredCategory);
  const item = point(
    `${type}_${Date.now()}`,
    found?.name || query,
    type,
    Number(found?.lat),
    Number(found?.lng),
    found?.note ? `${found.note}｜${result.source}` : `用户导入｜${result?.source || "待验证坐标"}`,
    result?.source || "manual-import"
  );
  if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) {
    const error = new Error(result?.error || "Mapbox 未找到可用坐标");
    error.statusCode = 404;
    throw error;
  }
  const staged = {
    ...item,
    instanceId: `${item.id}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    itemId: item.id
  };
  planner.staging = planner.staging || [];
  planner.staging.push(staged);
  planner.updatedAt = new Date().toISOString();
  return { state, planner, item: staged, source: result?.source || "manual-import" };
}

async function expandMapUrl(value) {
  const raw = String(value || "").trim();
  if (!/^https?:\/\//i.test(raw) || !/(maps\.app\.goo\.gl|goo\.gl\/maps|google\.[^/]+\/maps|maps\.google\.[^/]+)/i.test(raw)) return "";
  let current = raw;
  for (let index = 0; index < 4; index += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let response;
    try {
      response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": "Mozilla/5.0 travel-agent" },
        signal: controller.signal
      });
    } catch (_) {
      return current === raw ? "" : current;
    } finally {
      clearTimeout(timeout);
    }
    const location = response.headers.get("location");
    if (!location) return response.url && response.url !== raw ? response.url : current;
    current = new URL(location, current).toString();
    if (coordinatesFromText(current)) return current;
  }
  return current === raw ? "" : current;
}

function coordinatesFromText(value) {
  const text = String(value || "");
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /(?:lat|latitude)[=:]\s*(-?\d+(?:\.\d+)?)[,&\s]+(?:lng|lon|longitude)[=:]\s*(-?\d+(?:\.\d+)?)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

function cleanupImportedPlaceName(value) {
  const text = String(value || "").trim();
  if (!/^https?:\/\//i.test(text)) return text.slice(0, 80);
  try {
    const url = new URL(text);
    const path = decodeURIComponent(url.pathname || "");
    const match = path.match(/\/place\/([^/]+)/);
    if (match?.[1]) return match[1].replace(/\+/g, " ").slice(0, 80);
  } catch (_) {}
  return "用户导入地点";
}

function inferPlaceCategory(query) {
  const text = String(query || "").toLowerCase();
  if (/餐厅|饭店|咖啡|酒吧|restaurant|cafe|bar|bistro|food|dining/.test(text)) return "restaurants";
  if (/酒店|住宿|hotel|hostel|guesthouse|resort|bnb|airbnb/.test(text)) return "hotels";
  if (/机场|airport|terminal/.test(text)) return "flights";
  return "attractions";
}

function normalizeCategory(category) {
  const text = String(category || "").toLowerCase();
  if (["restaurants", "restaurant", "food"].includes(text)) return "restaurants";
  if (["hotels", "hotel", "lodging", "homestays"].includes(text)) return "hotels";
  if (["flights", "flight", "airport"].includes(text)) return "flights";
  return "attractions";
}

function categoryType(category) {
  if (category === "restaurants") return "restaurant";
  if (category === "hotels") return "hotel";
  if (category === "flights") return "flight";
  return "attraction";
}

async function recommendFromMap(planner, category, prompt = "") {
  const center = recommendationCenter(planner);
  if (!center) return null;
  const domestic = isChinaPlanner(planner, [center]);
  const searchArgs = {
    category,
    destination: planner.destinationName,
    center: { lat: center.lat, lng: center.lng },
    keyword: prompt,
    limit: 8,
    radiusMeters: 5000,
    language: "zh",
    strictLocation: true
  };
  const providers = domestic
    ? [["amap", amap], ["mapbox", mapbox]]
    : [["google", google], ["mapbox", mapbox], ["amap", amap]];
  const existing = new Set(Object.values(planner.candidates).flat().map(candidate => candidate.name));
  for (const [, provider] of providers) {
    if (typeof provider.enabled === "function" && !provider.enabled()) continue;
    const result = await provider.searchNearby(searchArgs);
    const found = mappablePlaces(normalizeMapResult(result, category))
      .filter(candidate => distanceMeters(center, candidate) <= searchArgs.radiusMeters)
      .find(candidate => !existing.has(candidate.name));
    if (found) return toCandidatePoint(found, found.type);
  }
  return null;
}

function recommendationCenter(planner) {
  const scheduled = Object.entries(planner.itinerary || {})
    .map(([slot, item]) => ({ slot, item }))
    .filter(({ item }) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    .sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));
  const nonFlight = scheduled.find(({ item }) => item.type !== "flight");
  if (nonFlight) return nonFlight.item;
  return Object.values(planner.candidates || {})
    .flat()
    .find(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

async function calculateRoute(state, plannerId, options = {}) {
  const planner = state.planners.find(item => item.id === plannerId);
  if (!planner) {
    const error = new Error("planner not found");
    error.statusCode = 404;
    throw error;
  }
  ensurePlannerPlaceCoordinates(planner);
  const points = Object.entries(planner.itinerary)
    .map(([slot, item]) => ({ slot, item }))
    .filter(({ item }) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    .sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));
  const routeEntries = compactScheduledPoints(points);
  const routePoints = routeEntries.map(({ slot, endSlot, slots, item }) => ({
    slot,
    endSlot,
    slots,
    name: item.name,
    type: item.type,
    lat: item.lat,
    lng: item.lng
  }));
  const domestic = isChinaPlanner(planner, routePoints);
  const defaultMode = normalizeRouteMode(options.mode || planner.routeMode || "driving", domestic);
  const segmentModes = { ...(planner.routeSegmentModes || {}), ...(options.segmentModes || {}) };
  const mixedRoute = await calculateMixedRoute({ points: routeEntries, routePoints, defaultMode, domestic, segmentModes });
  if (mixedRoute?.segments?.length) {
    planner.route = {
      updatedAt: new Date().toISOString(),
      pointCount: routePoints.length,
      line: routePoints,
      geometry: mixedRoute.geometry,
      summary: mixedRoute.summary,
      source: mixedRoute.source,
      mode: mixedRoute.mode,
      distanceMeters: mixedRoute.distanceMeters,
      durationSeconds: mixedRoute.durationSeconds,
      segments: mixedRoute.segments,
      providerPreference: domestic ? "china-domestic" : "global",
      error: mixedRoute.error || null,
      fallbackErrors: mixedRoute.fallbackErrors || null
    };
    planner.routeMode = defaultMode;
    planner.routeSegmentModes = segmentModes;
    planner.updatedAt = planner.route.updatedAt;
    return { state, planner, route: planner.route };
  }

  if (modelRunner.isEnabled()) {
    try {
      const route = await modelRunner.routeWithModel({
        planner,
        memory: await memoryStore.readMemory(),
        points: routePoints
      });
      if (route?.summary && Array.isArray(route.line)) {
        planner.route = {
          updatedAt: new Date().toISOString(),
          pointCount: Number(route.pointCount || route.line.length),
          line: route.line,
          summary: `${route.summary}（Google/Mapbox/高德不可用，LLM 摘要）`,
          source: "llm-agent",
          mode: defaultMode,
          providerPreference: domestic ? "china-domestic" : "global",
          error: mixedRoute?.error || null
        };
        planner.updatedAt = planner.route.updatedAt;
        return { state, planner, route: planner.route };
      }
    } catch (error) {
      planner.lastAgentError = error.message;
    }
  }
  planner.route = {
    updatedAt: new Date().toISOString(),
    pointCount: routePoints.length,
    line: routePoints,
    summary: `${routePoints.length} 个路线点；连续相同地点已合并。`,
    source: "agent-runner-fallback",
    mode: defaultMode
  };
  planner.updatedAt = planner.route.updatedAt;
  return { state, planner, route: planner.route };
}

async function calculateMixedRoute({ points, routePoints, defaultMode, domestic, segmentModes }) {
  if (routePoints.length < 2) {
    return {
      source: "route-fallback",
      mode: defaultMode,
      distanceMeters: 0,
      durationSeconds: 0,
      geometry: { type: "LineString", coordinates: routePoints.map(point => [point.lng, point.lat]) },
      segments: [],
      summary: "少于 2 个点，无法计算路线。"
    };
  }
  const segments = [];
  const coordinates = [];
  const sources = new Set();
  const fallbackErrors = {};
  let totalDistance = 0;
  let totalDuration = 0;
  for (let index = 0; index < routePoints.length - 1; index += 1) {
    const key = segmentKey(points[index].slot, points[index + 1].slot);
    const rawMode = segmentModes[key] || defaultMode;
    const mode = normalizeRouteMode(rawMode, domestic);
    const from = routePoints[index];
    const to = routePoints[index + 1];
    const segment = mode === "flight"
      ? flightSegment(from, to, index, key)
      : await mapSegment({ from, to, index, key, mode, domestic });
    if (segment.error) fallbackErrors[key] = segment.error;
    sources.add(segment.source);
    totalDistance += Number.isFinite(segment.distanceMeters) ? segment.distanceMeters : 0;
    totalDuration += Number.isFinite(segment.durationSeconds) ? segment.durationSeconds : 0;
    const segmentCoordinates = segment.geometry?.coordinates?.length
      ? segment.geometry.coordinates
      : [[from.lng, from.lat], [to.lng, to.lat]];
    segment.geometry = { type: "LineString", coordinates: segmentCoordinates };
    if (!coordinates.length) coordinates.push(...segmentCoordinates);
    else coordinates.push(...segmentCoordinates.slice(1));
    segments.push(segment);
  }
  const modeSet = new Set(segments.map(segment => segment.mode));
  return {
    source: sources.size === 1 ? [...sources][0] : "mixed-route",
    mode: modeSet.size === 1 ? [...modeSet][0] : "mixed",
    distanceMeters: totalDistance || undefined,
    durationSeconds: totalDuration || undefined,
    geometry: { type: "LineString", coordinates },
    segments,
    fallbackErrors: Object.keys(fallbackErrors).length ? fallbackErrors : null,
    summary: `混合路线：${formatDistance(totalDistance)}, ${formatDuration(totalDuration)}`
  };
}

async function mapSegment({ from, to, index, key, mode, domestic }) {
  if (from.lat === to.lat && from.lng === to.lng) {
    return {
      key,
      from: from.name,
      to: to.name,
      fromIndex: index,
      toIndex: index + 1,
      mode: "same-place",
      source: "same-place",
      distanceMeters: 0,
      durationSeconds: 0,
      summary: "同一地点",
      geometry: { type: "LineString", coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }
    };
  }
  const providers = domestic
    ? [["amap", amap], ["mapbox", mapbox]]
    : [["google", google], ["mapbox", mapbox], ["amap", amap]];
  const errors = [];
  for (const [name, provider] of providers) {
    let result;
    try {
      result = await provider.routePlaces({ points: [from, to], mode, profile: mode });
    } catch (error) {
      result = { source: `${name}-fallback`, data: null, error: error.message };
    }
    if (!result.data?.geometry || result.source.endsWith("-fallback")) {
      if (result.error) errors.push(`${name}: ${result.error}`);
      continue;
    }
    const providerSegment = result.data.segments?.[0] || {};
    return {
      key,
      from: from.name,
      to: to.name,
      fromIndex: index,
      toIndex: index + 1,
      mode: result.data.mode || mode,
      source: result.source,
      distanceMeters: providerSegment.distanceMeters ?? result.data.distanceMeters,
      durationSeconds: providerSegment.durationSeconds ?? result.data.durationSeconds,
      summary: providerSegment.summary || `${formatDistance(result.data.distanceMeters)}, ${formatDuration(result.data.durationSeconds)}`,
      geometry: providerSegment.geometry || result.data.geometry
    };
  }
  return directSegment(from, to, index, key, mode, errors.join("; "));
}

function flightSegment(from, to, index, key) {
  const distanceMeters = haversineMeters(from, to);
  const durationSeconds = Math.max(1800, distanceMeters / 230);
  return {
    key,
    from: from.name,
    to: to.name,
    fromIndex: index,
    toIndex: index + 1,
    mode: "flight",
    source: "flight-direct",
    distanceMeters,
    durationSeconds,
    summary: `飞行段 ${formatDistance(distanceMeters)}, ${formatDuration(durationSeconds)}`,
    geometry: { type: "LineString", coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }
  };
}

function directSegment(from, to, index, key, mode, error) {
  const distanceMeters = haversineMeters(from, to);
  return {
    key,
    from: from.name,
    to: to.name,
    fromIndex: index,
    toIndex: index + 1,
    mode,
    source: "direct-fallback",
    distanceMeters,
    durationSeconds: undefined,
    summary: `${formatDistance(distanceMeters)}, 时间待查`,
    error,
    geometry: { type: "LineString", coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }
  };
}

function segmentKey(fromSlot, toSlot) {
  return `${fromSlot}->${toSlot}`;
}

function haversineMeters(a, b) {
  const rad = value => value * Math.PI / 180;
  const earth = 6371000;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}

function formatDistance(value) {
  const meters = Number(value);
  if (!Number.isFinite(meters) || meters < 0) return "距离未知";
  if (meters === 0) return "0 m";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return "时间未知";
  if (seconds === 0) return "0 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function normalizeRouteMode(mode, domestic) {
  const value = String(mode || "driving").toLowerCase();
  if (["walk", "walking"].includes(value)) return "walking";
  if (["flight", "fly", "plane", "air"].includes(value)) return "flight";
  if (["bike", "cycling", "bicycling"].includes(value)) return domestic ? "bicycling" : "cycling";
  if (["transit", "public", "bus", "public-transit"].includes(value)) return domestic ? "transit" : "driving";
  if (["driving-traffic", "traffic"].includes(value)) return domestic ? "driving" : "driving-traffic";
  return "driving";
}

function isChinaPlanner(planner, points = []) {
  const usablePoints = points.filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  if (usablePoints.length) return usablePoints.every(isChinaPoint);
  return isChinaName(planner.destinationName) || isChinaName(planner.title);
}

function isChinaPoint(point) {
  return point.lat >= 18 && point.lat <= 54 && point.lng >= 73 && point.lng <= 135;
}

function isChinaName(value) {
  const text = String(value || "").toLowerCase();
  return /中国|北京|上海|重庆|天津|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾|内蒙古|广西|西藏|宁夏|新疆|香港|澳门|九寨沟|张家界|黄山|桂林|大理|丽江|成都|杭州|苏州|西安|厦门|青岛|哈尔滨|三亚/.test(text)
    || /\b(china|beijing|shanghai|chongqing|chengdu|hangzhou|xian|xi'an|yunnan|sichuan|guangxi|tibet|xinjiang|guilin|zhangjiajie|huangshan|sanya|xiamen|qingdao|harbin|hong kong|macau)\b/.test(text);
}

function slotOrder(slot) {
  const [date, time] = String(slot).split("|");
  const dateIndex = tripDates.indexOf(date);
  const timeIndex = timeBlocks.indexOf(time);
  return (dateIndex < 0 ? 999 : dateIndex) * 100 + (timeIndex < 0 ? 99 : timeIndex);
}

module.exports = {
  createPlanner,
  calculateRoute,
  isModelEnabled: modelRunner.isEnabled,
  recommendPlace,
  importPlaceToStaging,
  rerollResearch,
  stablePlannerId,
  typeLabels
};
