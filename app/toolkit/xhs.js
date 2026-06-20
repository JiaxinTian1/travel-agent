"use strict";

const { normalizeTextResult, runCommand } = require("./process");

async function searchSocialReviews(params) {
  const keyword = params.keyword || [params.destination, params.topic].filter(Boolean).join(" ");
  const payload = JSON.stringify({ keyword });
  const result = await runCommand(process.env.MCPORTER || "mcporter", [
    "call",
    "xiaohongshu-xpz.search_feeds",
    "--timeout",
    String(process.env.XHS_TIMEOUT || 60000),
    "--args",
    payload,
    "--output",
    "text"
  ], { timeout: Number(process.env.XHS_TIMEOUT || 60000) + 5000 });
  return normalizeTextResult("xiaohongshu", result);
}

module.exports = {
  searchSocialReviews
};
