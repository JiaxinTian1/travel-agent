"use strict";

const modelRunner = require("./modelRunner");
const memoryStore = require("./memoryStore");
const ors = require("../toolkit/ors");

const typeLabels = {
  restaurant: "餐厅",
  hotel: "住宿",
  attraction: "景点",
  flight: "航班"
};

const tripDates = ["9/25", "9/26", "9/27", "9/28", "9/29", "9/30", "10/1", "10/2"];
const timeBlocks = ["06:00-08:00", "08:00-10:00", "10:00-12:00", "12:00-14:00", "14:00-16:00", "16:00-18:00", "18:00-20:00", "20:00-22:00", "22:00-24:00"];

const recommendationPools = {
  restaurants: [
    ["Barbarestan", "restaurant", 41.7081, 44.8017, "传统格鲁吉亚菜｜适合正式晚餐"],
    ["Keto and Kote", "restaurant", 41.7029, 44.7934, "山坡餐厅｜本地菜"],
    ["Culinarium Khasheria", "restaurant", 41.6896, 44.8088, "老城附近｜创意格鲁吉亚菜"]
  ],
  hotels: [
    ["Communal Hotel Sololaki", "hotel", 41.6928, 44.7996, "Sololaki 区｜步行友好"],
    ["The House Hotel Old Tbilisi", "hotel", 41.6907, 44.8104, "老城｜适合短住"],
    ["Tbilisi View Hotel", "hotel", 41.7012, 44.7938, "Vera/Mtatsminda 一带｜视野好"]
  ],
  attractions: [
    ["Mtatsminda Park", "attraction", 41.6959, 44.7856, "城市高点｜日落备选"],
    ["Dry Bridge Market", "attraction", 41.7035, 44.8012, "跳蚤市场｜适合轻松逛"],
    ["Mtskheta Old Town", "attraction", 41.8452, 44.7209, "古都小镇｜可和 Jvari 串联"]
  ],
  flights: [
    ["TBS 机场缓冲", "flight", 41.6692, 44.9547, "用于多出发地抵达/返程缓冲"],
    ["TBS -> 市区交通", "flight", 41.6692, 44.9547, "机场接送/打车/包车段"],
    ["返程转机缓冲", "flight", 41.6692, 44.9547, "各自返程时段占位"]
  ]
};

function stablePlannerId(destination) {
  return `planner_${destination.seed || "seed"}_${destination.id}`;
}

function point(id, name, type, lat, lng, note, source = "agent-runner") {
  return { id, name, type, lat, lng, note, source, confidence: "medium" };
}

function destination(id, name, score, rank, detail, scores, seed) {
  return { id, plannerId: stablePlannerId({ id, seed }), name, score, rank, detail, scores, seed };
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
  const set = researchSet(seed, context);
  state.researcher.sets.unshift(set);
  state.researcher.setIndex = 0;
  state.activeTab = "researcher";
  return { state, set };
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
  return planner;
}

function baseCandidates(destination) {
  if (destination.id === "georgia-caucasus") return georgiaCandidates();
  const defaults = destinationDefaults(destination);
  return {
    restaurants: [point("r1", defaults.restaurant.name, "restaurant", defaults.restaurant.lat, defaults.restaurant.lng, "由 agent 后续补充")],
    hotels: [point("h1", defaults.hotel.name, "hotel", defaults.hotel.lat, defaults.hotel.lng, "由 Booking/Airbnb 后续补充")],
    attractions: [point("a1", defaults.attraction.name || destination.name, "attraction", defaults.attraction.lat, defaults.attraction.lng, "核心目的地占位")],
    flights: [point("f1", defaults.flight.name, "flight", defaults.flight.lat, defaults.flight.lng, "由 FlyAI 后续补充")]
  };
}

function destinationDefaults(destination) {
  const defaults = {
    "albania-accursed-mountains": {
      flight: { name: "Tirana International Airport", lat: 41.4147, lng: 19.7206 },
      restaurant: { name: "Shkoder old town restaurant area", lat: 42.0686, lng: 19.5126 },
      hotel: { name: "Theth village guesthouse area", lat: 42.3959, lng: 19.7745 },
      attraction: { name: "Theth / Valbona mountain route", lat: 42.3959, lng: 19.7745 }
    },
    "azores": {
      flight: { name: "Ponta Delgada Airport", lat: 37.7412, lng: -25.6979 },
      restaurant: { name: "Ponta Delgada restaurant area", lat: 37.7410, lng: -25.6756 },
      hotel: { name: "Ponta Delgada hotel area", lat: 37.7394, lng: -25.6687 },
      attraction: { name: "Sete Cidades", lat: 37.8620, lng: -25.7948 }
    },
    "laos-north": {
      flight: { name: "Luang Prabang Airport", lat: 19.8973, lng: 102.1608 },
      restaurant: { name: "Luang Prabang old town restaurant area", lat: 19.8856, lng: 102.1348 },
      hotel: { name: "Luang Prabang old town hotel area", lat: 19.8871, lng: 102.1359 },
      attraction: { name: "Kuang Si Waterfall", lat: 19.7493, lng: 101.9920 }
    }
  };
  return defaults[destination.id] || {
    flight: { name: "多出发地航班待查", lat: 41.6692, lng: 44.9547 },
    restaurant: { name: "当地特色餐厅待查", lat: 41.7151, lng: 44.8271 },
    hotel: { name: "核心住宿区域待选", lat: 41.7151, lng: 44.8271 },
    attraction: { name: destination.name, lat: 41.7151, lng: 44.8271 }
  };
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
      point("f0", "三地出发 -> TBS 机场集合", "flight", 41.6692, 44.9547, "上海/北京/重庆分别抵达"),
      point("f4", "TBS -> 三地返程待选航班", "flight", 41.6692, 44.9547, "各自返程")
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
    put(planner, "9/25", "06:00-08:00", "f1", "多出发地航班待查");
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

async function recommendPlace(state, plannerId, category) {
  const planner = state.planners.find(item => item.id === plannerId);
  if (!planner) {
    const error = new Error("planner not found");
    error.statusCode = 404;
    throw error;
  }
  if (!recommendationPools[category] || !planner.candidates[category]) {
    const error = new Error("unknown category");
    error.statusCode = 400;
    throw error;
  }
  let item = null;
  if (modelRunner.isEnabled()) {
    try {
      const suggested = await modelRunner.recommendPlaceWithModel({
        planner,
        category,
        memory: await memoryStore.readMemory()
      });
      if (suggested?.name && suggested?.type && Number.isFinite(Number(suggested.lat)) && Number.isFinite(Number(suggested.lng))) {
        item = point(
          `${suggested.type}_${Date.now()}`,
          suggested.name,
          suggested.type,
          Number(suggested.lat),
          Number(suggested.lng),
          suggested.note || "LLM agent 推荐",
          "llm-agent"
        );
      }
    } catch (error) {
      planner.lastAgentError = error.message;
    }
  }
  if (!item) {
    const pool = recommendationPools[category];
    const offset = planner.candidates[category].length % pool.length;
    const [name, type, lat, lng, note] = pool[offset];
    item = point(`${type}_${Date.now()}`, name, type, lat, lng, `${note}｜runner fallback 推荐`);
  }
  planner.candidates[category].push(item);
  planner.updatedAt = new Date().toISOString();
  return { state, planner, item };
}

async function calculateRoute(state, plannerId) {
  const planner = state.planners.find(item => item.id === plannerId);
  if (!planner) {
    const error = new Error("planner not found");
    error.statusCode = 404;
    throw error;
  }
  const points = Object.entries(planner.itinerary)
    .map(([slot, item]) => ({ slot, item }))
    .filter(({ item }) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    .sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));
  const routePoints = points.map(({ slot, item }) => ({ slot, name: item.name, type: item.type, lat: item.lat, lng: item.lng }));
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
          summary: route.summary,
          source: "llm-agent"
        };
        planner.updatedAt = planner.route.updatedAt;
        return { state, planner, route: planner.route };
      }
    } catch (error) {
      planner.lastAgentError = error.message;
    }
  }
  const orsResult = await ors.routePlaces({ points: routePoints });
  if (orsResult.data?.geometry) {
    planner.route = {
      updatedAt: new Date().toISOString(),
      pointCount: orsResult.data.pointCount,
      line: orsResult.data.line,
      geometry: orsResult.data.geometry,
      summary: orsResult.data.summary,
      source: orsResult.source,
      error: orsResult.error || null
    };
    planner.updatedAt = planner.route.updatedAt;
    return { state, planner, route: planner.route };
  }
  planner.route = {
    updatedAt: new Date().toISOString(),
    pointCount: points.length,
    line: routePoints,
    summary: `${points.length} 个已排程点位；下一步可接 OpenRouteService 替换为真实路网路线。`,
    source: "agent-runner-fallback"
  };
  planner.updatedAt = planner.route.updatedAt;
  return { state, planner, route: planner.route };
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
  rerollResearch,
  stablePlannerId,
  typeLabels
};
