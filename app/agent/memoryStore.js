"use strict";

const fs = require("fs/promises");
const path = require("path");

const MEMORY_PATH = process.env.AGENT_MEMORY_PATH || path.join(__dirname, "memory.md");

async function readMemory() {
  try {
    return await fs.readFile(MEMORY_PATH, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return "";
  }
}

async function writeMemory(content) {
  await fs.mkdir(path.dirname(MEMORY_PATH), { recursive: true });
  const text = String(content || "").trimEnd();
  await fs.writeFile(MEMORY_PATH, `${text}\n`, "utf8");
  return readMemory();
}

async function appendMemoryNote(note) {
  const current = await readMemory();
  const stamp = new Date().toISOString().slice(0, 10);
  const next = `${current.trimEnd()}\n\n## 更新 ${stamp}\n\n- ${String(note || "").trim()}\n`;
  return writeMemory(next);
}

function memoryPath() {
  return MEMORY_PATH;
}

module.exports = {
  appendMemoryNote,
  memoryPath,
  readMemory,
  writeMemory
};
