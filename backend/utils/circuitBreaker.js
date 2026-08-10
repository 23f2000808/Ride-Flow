const CircuitBreaker = require("opossum");
const logger = require("./logger");

const breakerOptions = {
  timeout: 4000, 
  errorThresholdPercentage: 50, 
  resetTimeout: 10000 
};

// Fallback logic when OpenRouteService dies natively avoiding 500s directly.
const fallbackHaversine = async (...args) => {
  logger.warn(`[Circuit Breaker OPEN] Routing fallback active manually evaluating geometry array bounds.`);
  const [pickupCoords, destCoords] = args;
  
  // Minimal straight line extraction
  const [lng1, lat1] = pickupCoords;
  const [lng2, lat2] = destCoords;
  const R = 6371; 
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const durationMinutes = (distanceKm / 25) * 60; // Assume 25km/h

  return { distanceKm, durationMinutes };
};

const createBreaker = (asyncFunction, name = "ExternalService") => {
  const breaker = new CircuitBreaker(asyncFunction, breakerOptions);
  
  breaker.fallback(fallbackHaversine);

  breaker.on("open", () => logger.warn(`🛑 Circuit Breaker [${name}] Trip: State OPEN (Failing Fast)`));
  breaker.on("halfOpen", () => logger.warn(`⚠️ Circuit Breaker [${name}]: State HALF-OPEN (Testing Network)`));
  breaker.on("close", () => logger.info(`✅ Circuit Breaker [${name}]: State CLOSED (Healthy)`));

  return breaker;
};

module.exports = { createBreaker };
