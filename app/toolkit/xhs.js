"use strict";

const { normalizeTextResult, runCommand } = require("./process");

async function searchSocialReviews(params) {
  const keyword = params.keyword || [params.destination, params.topic].filter(Boolean).join(" ");
  const payload = JSON.stringify({ keyword });
  const timeout = Number(params.timeoutMs || process.env.XHS_TIMEOUT || 60000);
  const result = await runCommand(process.env.MCPORTER || "mcporter", [
    "call",
    "xiaohongshu-xpz.search_feeds",
    "--timeout",
    String(timeout),
    "--args",
    payload,
    "--output",
    "text"
  ], { timeout: timeout + 5000 });
  return normalizeTextResult("xiaohongshu", result);
}

module.exports = {
  searchSocialReviews
};
