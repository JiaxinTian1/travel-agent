"use strict";

const { executeTool, toolDefinitions } = require("./tools");

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const API_BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const API_MODE = process.env.OPENAI_API_MODE || "openai-responses";

function isEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function openaiRequest(body) {
  if (!isEnabled()) {
    const error = new Error("OPENAI_API_KEY is not configured");
    error.code = "OPENAI_DISABLED";
    throw error;
  }
  const response = await fetch(`${API_BASE}/responses`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || `OpenAI API HTTP ${response.status}`);
    error.statusCode = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function openaiChatRequest(body) {
  if (!isEnabled()) {
    const error = new Error("OPENAI_API_KEY is not configured");
    error.code = "OPENAI_DISABLED";
    throw error;
  }
  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || `OpenAI chat completions HTTP ${response.status}`);
    error.statusCode = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  return (response.output || [])
    .flatMap(item => item.content || [])
    .filter(content => content.type === "output_text" || content.type === "text")
    .map(content => content.text)
    .join("\n");
}

function functionCalls(response) {
  return (response.output || []).filter(item => item.type === "function_call" && item.name);
}

function parseJsonText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (_) {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return null;
  }
}

async function runWithTools({ instructions, input, maxToolRounds = 2 }) {
  if (API_MODE === "openai-chat-completions") {
    return runChatCompletionsWithTools({ instructions, input, maxToolRounds });
  }

  let response = await openaiRequest({
    model: DEFAULT_MODEL,
    instructions,
    input,
    tools: toolDefinitions
  });

  for (let round = 0; round < maxToolRounds; round += 1) {
    const calls = functionCalls(response);
    if (!calls.length) break;
    const toolOutputs = [];
    for (const call of calls) {
      let args = {};
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch (_) {}
      const result = await executeTool(call.name, args);
      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result).slice(0, 50000)
      });
    }
    response = await openaiRequest({
      model: DEFAULT_MODEL,
      previous_response_id: response.id,
      input: toolOutputs
    });
  }

  return {
    response,
    text: outputText(response),
    json: parseJsonText(outputText(response))
  };
}

function chatToolDefinitions() {
  return toolDefinitions.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

function chatText(response) {
  return response.choices?.[0]?.message?.content || "";
}

async function runChatCompletionsWithTools({ instructions, input, maxToolRounds = 2 }) {
  const messages = [
    { role: "system", content: instructions },
    { role: "user", content: typeof input === "string" ? input : JSON.stringify(input) }
  ];

  const request = {
    model: DEFAULT_MODEL,
    messages,
    temperature: 0.2
  };
  if (maxToolRounds > 0) {
    request.tools = chatToolDefinitions();
    request.tool_choice = "auto";
  }
  let response = await openaiChatRequest(request);

  for (let round = 0; round < maxToolRounds; round += 1) {
    const message = response.choices?.[0]?.message;
    const calls = message?.tool_calls || [];
    if (!calls.length) break;
    messages.push(message);
    for (const call of calls) {
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch (_) {}
      const result = await executeTool(call.function?.name, args);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 50000)
      });
    }
    response = await openaiChatRequest({
      model: DEFAULT_MODEL,
      messages,
      tools: chatToolDefinitions(),
      tool_choice: "auto",
      temperature: 0.2
    });
  }

  const text = chatText(response);
  return {
    response,
    text,
    json: parseJsonText(text)
  };
}

async function recommendPlaceWithModel({ planner, category, prompt = "", memory = "" }) {
  const categoryGuide = {
    restaurants: "Recommend one concrete restaurant or cafe.",
    hotels: "Recommend one concrete hotel. Use search_hotels unless the planner/user clearly prefers homestays, then use search_homestays.",
    attractions: "Recommend one concrete attraction or activity.",
    flights: "Recommend one concrete flight or airport transfer placeholder."
  };
  const instructions = [
    "You are the travel planning agent for a collaborative itinerary board.",
    "Read and apply the user memory before making decisions.",
    "Use available function tools when they can improve the recommendation.",
    "Return ONLY JSON with this shape:",
    '{"name":"...","type":"restaurant|hotel|attraction|flight","lat":0,"lng":0,"note":"short reason and source"}',
    "If exact coordinates are unavailable, use a reasonable city-center coordinate and mention that the coordinate needs verification in note."
  ].join("\n");
  const input = {
    task: categoryGuide[category] || "Recommend one concrete travel item.",
    category,
    userPrompt: prompt,
    destinationName: planner.destinationName,
    userMemory: memory,
    plannerSummary: {
      id: planner.id,
      candidates: planner.candidates,
      itinerary: planner.itinerary
    }
  };
  const result = await runWithTools({ instructions, input: JSON.stringify(input), maxToolRounds: 2 });
  return result.json;
}

async function routeWithModel({ planner, points, memory = "" }) {
  const instructions = [
    "You are the route planning agent for a travel itinerary board.",
    "Use route_places if useful. Return ONLY JSON with summary, pointCount, and line fields.",
    "line must preserve ordered points with name, type, lat, lng, and slot."
  ].join("\n");
  const result = await runWithTools({
    instructions,
    input: JSON.stringify({ destinationName: planner.destinationName, userMemory: memory, points }),
    maxToolRounds: 1
  });
  return result.json;
}

async function researchDestinationsWithModel({ query = "", memory = "", seed = "", previous = [] }) {
  const instructions = [
    "You are the destination researcher for a personalized travel planning app.",
    "Generate fresh, diverse destination candidates from the user's query and durable memory.",
    "Do not pick from a fixed list. Use the seed to vary the candidate set; avoid repeating previous destination names when possible.",
    "Prefer concrete countries, regions, cities, islands, or route areas that can later become itinerary planners.",
    "First collect/estimate structured evidence for each candidate. The app runner will calculate final scores from evidence, so do not smooth scores to look similar.",
    "Return ONLY JSON with this shape:",
    '{"summary":"...","candidates":[{"id":"slug","name":"...","rank":1,"detail":{"nature":"...","culture":"...","weather":"...","reviews":"...","flights":"...","cost":"...","premium":"...","duration":"..."},"evidence":{"natureRating":0,"cultureRating":0,"reviewRating":0,"weatherRisk":0,"flightOptions":0,"avgFlightHours":0,"totalCostCny":0,"premiumPercent":0,"sources":["estimate|tool|web"],"notes":"..."},"scores":{"nature":0,"culture":0,"weather":0,"reviews":0,"flights":0,"cost":0,"premium":0,"duration":0}}]}',
    "Evidence rules: nature/culture/review ratings are 0-10 higher is better; weatherRisk is 0-10 higher is worse; flightOptions is an estimated count across all user origins; avgFlightHours is average one-way flight hours across origins; totalCostCny is estimated total per-person roundtrip flight plus lodging budget in CNY; premiumPercent is estimated price premium versus three nearby alternative date windows.",
    "Scores are optional fallback only. Final scores will be recomputed by the runner from evidence.",
    "Return 4 to 6 candidates. IDs must be lowercase ascii slugs."
  ].join("\n");
  const input = {
    seed,
    query,
    memory,
    previousDestinations: previous.slice(0, 40)
  };
  const result = await runWithTools({ instructions, input: JSON.stringify(input), maxToolRounds: 0 });
  return result.json;
}

module.exports = {
  isEnabled,
  recommendPlaceWithModel,
  researchDestinationsWithModel,
  routeWithModel,
  runWithTools
};
