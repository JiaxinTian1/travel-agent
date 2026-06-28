"use strict";

const { normalizeTextResult, repoPath, runCommand } = require("./process");

async function searchFlights(params) {
  const prompt = [
    "flight search",
    params.origin ? `origin=${params.origin}` : "",
    params.destination ? `destination=${params.destination}` : "",
    params.departDate ? `departDate=${params.departDate}` : "",
    params.returnDate ? `returnDate=${params.returnDate}` : "",
    params.adults ? `adults=${params.adults}` : ""
  ].filter(Boolean).join(" ");
  const result = await runCommand(repoPath("toolkit", "fz", "flyai-env"), ["ask", prompt], { timeout: Number(params.timeoutMs || process.env.FZ_TIMEOUT || 120000) });
  return normalizeTextResult("flyai", result);
}

module.exports = {
  searchFlights
};
