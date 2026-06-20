"use strict";

const { execFile } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

function repoPath(...parts) {
  return path.join(ROOT, ...parts);
}

function runCommand(command, args = [], options = {}) {
  return new Promise(resolve => {
    execFile(command, args, {
      cwd: ROOT,
      timeout: options.timeout || 120000,
      maxBuffer: options.maxBuffer || 5 * 1024 * 1024,
      env: { ...process.env, ...(options.env || {}) }
    }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error?.code || 0,
        signal: error?.signal || null,
        stdout: stdout || "",
        stderr: stderr || "",
        error: error ? error.message : null
      });
    });
  });
}

function keyValueArgs(params, mapping = {}) {
  return Object.entries(params || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${mapping[key] || key}=${value}`);
}

function parseMaybeJson(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  const start = Math.min(
    ...["{", "["].map(char => {
      const idx = trimmed.indexOf(char);
      return idx === -1 ? Number.POSITIVE_INFINITY : idx;
    })
  );
  if (!Number.isFinite(start)) return null;
  for (let end = trimmed.length; end > start; end -= 1) {
    try {
      return JSON.parse(trimmed.slice(start, end));
    } catch (_) {}
  }
  return null;
}

function normalizeTextResult(source, result) {
  const parsed = parseMaybeJson(result.stdout);
  return {
    ok: result.ok,
    source,
    data: parsed,
    rawText: result.stdout.slice(0, 20000),
    stderr: result.stderr.slice(0, 4000),
    error: result.error
  };
}

module.exports = {
  keyValueArgs,
  normalizeTextResult,
  repoPath,
  runCommand
};
