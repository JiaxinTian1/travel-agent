"use strict";

const { keyValueArgs, normalizeTextResult, repoPath, runCommand } = require("./process");

async function searchHotels(params) {
  const args = keyValueArgs(params, {
    destination: "destination",
    checkIn: "checkIn",
    checkOut: "checkOut",
    adults: "adults",
    children: "children",
    rooms: "rooms"
  });
  const result = await runCommand(repoPath("toolkit", "booking", "booking-search"), args, { timeout: Number(params.timeoutMs || process.env.BOOKING_TIMEOUT || 180000) });
  return normalizeTextResult("booking", result);
}

async function getHotelDetails(params) {
  const args = keyValueArgs(params, { propertyUrl: "propertyUrl" });
  const result = await runCommand(repoPath("toolkit", "booking", "booking-property"), args, { timeout: Number(params.timeoutMs || process.env.BOOKING_TIMEOUT || 180000) });
  return normalizeTextResult("booking", result);
}

module.exports = {
  getHotelDetails,
  searchHotels
};
