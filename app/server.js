#!/usr/bin/env node
"use strict";

const http = require("http");
const fsSync = require("fs");
const fs = require("fs/promises");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");
loadEnvFile(path.join(APP_DIR, ".env"));
const runner = require("./agent/runner");
const memoryStore = require("./agent/memoryStore");
const STATE_DIR = path.join(ROOT, "workspace", "app-state");
const BOARD_PATH = process.env.BOARD_STATE_PATH || path.join(STATE_DIR, "board.json");
const QUERY_PATH = process.env.TRAVEL_QUERY_PATH || path.join(ROOT, "workspace", "query.md");
const SAMPLE_PATH = path.join(APP_DIR, "data", "board-state.sample.json");
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";

function loadEnvFile(filePath) {
  if (!fsSync.existsSync(filePath)) return;
  const lines = fsSync.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(payload);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 8 * 1024 * 1024) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function ensureStateDir() {
  await fs.mkdir(path.dirname(BOARD_PATH), { recursive: true });
}

async function readTextFile(filePath, fallback = "") {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return fallback;
  }
}

async function writeTextFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const text = String(content || "").trimEnd();
  await fs.writeFile(filePath, `${text}\n`, "utf8");
  return readTextFile(filePath);
}

async function defaultBoardState() {
  return JSON.parse(await fs.readFile(SAMPLE_PATH, "utf8"));
}

function normalizeBoardState(input) {
  if (!input || typeof input !== "object") return null;
  if (!input.researcher || !Array.isArray(input.researcher.sets) || !input.researcher.sets.length) return null;
  if (!Array.isArray(input.planners)) return null;
  const first = input.researcher.sets[0]?.candidates?.[0];
  if (!first?.detail || !first?.scores) return null;
  return {
    schemaVersion: input.schemaVersion || 1,
    activeTab: input.activeTab || "researcher",
    researcher: {
      setIndex: Number.isInteger(input.researcher.setIndex) ? input.researcher.setIndex : 0,
      sets: input.researcher.sets
    },
    planners: input.planners,
    openPlannerIds: Array.isArray(input.openPlannerIds) ? input.openPlannerIds : input.planners.map(planner => planner.id)
  };
}

async function readBoardState() {
  try {
    const parsed = JSON.parse(await fs.readFile(BOARD_PATH, "utf8"));
    return normalizeBoardState(parsed) || defaultBoardState();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const state = await defaultBoardState();
    await writeBoardState(state);
    return state;
  }
}

async function writeBoardState(state) {
  const normalized = normalizeBoardState(state);
  if (!normalized) {
    const error = new Error("invalid board state");
    error.statusCode = 400;
    throw error;
  }
  await ensureStateDir();
  const tmp = `${BOARD_PATH}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await fs.rename(tmp, BOARD_PATH);
  return normalized;
}

async function resetBoardState() {
  const state = await defaultBoardState();
  await writeBoardState(state);
  return state;
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      boardPath: BOARD_PATH,
      queryPath: QUERY_PATH,
      memoryPath: memoryStore.memoryPath(),
      llmEnabled: runner.isModelEnabled(),
      orsEnabled: Boolean(process.env.ORS_API_KEY),
      orsProfile: process.env.ORS_PROFILE || "driving-car",
      model: process.env.OPENAI_MODEL || "gpt-5.5"
    });
    return true;
  }
  if (pathname === "/api/board" && req.method === "GET") {
    sendJson(res, 200, await readBoardState());
    return true;
  }
  if (pathname === "/api/board" && req.method === "PUT") {
    const body = await readRequestBody(req);
    const state = await writeBoardState(JSON.parse(body || "{}"));
    sendJson(res, 200, state);
    return true;
  }
  if (pathname === "/api/board" && req.method === "DELETE") {
    sendJson(res, 200, await resetBoardState());
    return true;
  }
  if (pathname === "/api/query" && req.method === "GET") {
    sendJson(res, 200, { content: await readTextFile(QUERY_PATH) });
    return true;
  }
  if (pathname === "/api/query" && req.method === "PUT") {
    const body = JSON.parse((await readRequestBody(req)) || "{}");
    sendJson(res, 200, { content: await writeTextFile(QUERY_PATH, body.content || "") });
    return true;
  }
  if (pathname === "/api/memory" && req.method === "GET") {
    sendJson(res, 200, { content: await memoryStore.readMemory() });
    return true;
  }
  if (pathname === "/api/memory" && req.method === "PUT") {
    const body = JSON.parse((await readRequestBody(req)) || "{}");
    sendJson(res, 200, { content: await memoryStore.writeMemory(body.content || "") });
    return true;
  }
  if (pathname === "/api/memory/update" && req.method === "POST") {
    const body = JSON.parse((await readRequestBody(req)) || "{}");
    sendJson(res, 200, { content: await memoryStore.appendMemoryNote(body.note || body.content || "") });
    return true;
  }
  if (pathname === "/api/research/reroll" && req.method === "POST") {
    const body = JSON.parse((await readRequestBody(req)) || "{}");
    if (typeof body.query === "string") await writeTextFile(QUERY_PATH, body.query);
    const state = await readBoardState();
    const result = await runner.rerollResearch(state, {
      query: await readTextFile(QUERY_PATH),
      memory: await memoryStore.readMemory()
    });
    result.state = await writeBoardState(result.state);
    sendJson(res, 200, result);
    return true;
  }
  if (pathname === "/api/planners" && req.method === "POST") {
    const body = JSON.parse((await readRequestBody(req)) || "{}");
    const state = await readBoardState();
    const result = runner.createPlanner(state, body.destinationKey || body.destinationId || body.plannerId);
    result.state = await writeBoardState(result.state);
    sendJson(res, result.created ? 201 : 200, result);
    return true;
  }
  {
    const match = pathname.match(/^\/api\/planners\/([^/]+)\/recommend$/);
    if (match && req.method === "POST") {
      const body = JSON.parse((await readRequestBody(req)) || "{}");
      const state = await readBoardState();
      const result = await runner.recommendPlace(state, decodeURIComponent(match[1]), body.category);
      result.state = await writeBoardState(result.state);
      sendJson(res, 200, result);
      return true;
    }
  }
  {
    const match = pathname.match(/^\/api\/planners\/([^/]+)\/route$/);
    if (match && req.method === "POST") {
      const state = await readBoardState();
      const result = await runner.calculateRoute(state, decodeURIComponent(match[1]));
      result.state = await writeBoardState(result.state);
      sendJson(res, 200, result);
      return true;
    }
  }
  if (pathname.startsWith("/api/")) {
    sendJson(res, 404, { error: "not found" });
    return true;
  }
  return false;
}

async function serveStatic(req, res, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(APP_DIR, relative);
  if (!filePath.startsWith(`${APP_DIR}${path.sep}`) && filePath !== APP_DIR) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const stat = await fs.stat(filePath);
    const target = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      "content-type": mimeTypes[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-store" : "public, max-age=60"
    });
    res.end(await fs.readFile(target));
  } catch (error) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    if (await handleApi(req, res, url.pathname)) return;
    await serveStatic(req, res, url.pathname);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message || "server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Travel Planner app: http://${HOST}:${PORT}/`);
  console.log(`Board state: ${BOARD_PATH}`);
});
