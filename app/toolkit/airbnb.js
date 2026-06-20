"use strict";

const { keyValueArgs, normalizeTextResult, repoPath, runCommand } = require("./process");

async function searchHomestays(params) {
  const args = keyValueArgs(params, {
    destination: "location",
    location: "location",
    checkIn: "checkin",
    checkOut: "checkout",
    adults: "adults",
    children: "children",
    infants: "infants",
    pets: "pets",
    minPrice: "minPrice",
    maxPrice: "maxPrice",
    propertyType: "propertyType"
  });
  const result = await runCommand(repoPath("toolkit", "airbnb", "airbnb-search"), args, { timeout: Number(process.env.AIRBNB_TIMEOUT || 120000) });
  return normalizeTextResult("airbnb", result);
}

module.exports = {
  searchHomestays
};
