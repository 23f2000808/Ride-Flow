// ─── RIDE SERVICE ───────────────────────────────────────
// Business logic layer — keeps controllers thin.
// Handles fare estimation, OTP generation, and ride lifecycle transitions.

const { createBreaker } = require("../utils/circuitBreaker");
const { countDrivers } = require("../repositories/driver.repository");
const { countRides } = require("../repositories/ride.repository");

// ─── FARE CALCULATION ───────────────────────────────────
// Base rates per vehicle type (in INR)
const FARE_RATES = {
  mini: { baseFare: 50, perKmRate: 10, perMinuteRate: 0 },
  sedan: { baseFare: 80, perKmRate: 15, perMinuteRate: 0 },
  suv: { baseFare: 120, perKmRate: 20, perMinuteRate: 0 },
  motorcycle: { baseFare: 25, perKmRate: 8, perMinuteRate: 1.5 },
  auto: { baseFare: 30, perKmRate: 12, perMinuteRate: 2 },
  car: { baseFare: 50, perKmRate: 15, perMinuteRate: 3 },
  van: { baseFare: 80, perKmRate: 20, perMinuteRate: 4 },
};

// ─── OPENROUTESERVICE API INTEGRATION ───────────────────
/**
 * Helper to calculate actual distance/duration using ORS directly wrapping tightly.
 */
const rawORSRequest = async (pickupCoords, destCoords) => {
  const orsKey = process.env.ORS_API_KEY;
  if (!orsKey) throw new Error("ORS Configuration missing");

  // Call the ORS API directly natively parsing JSON 
  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsKey}&start=${pickupCoords[0]},${pickupCoords[1]}&end=${destCoords[0]},${destCoords[1]}`;
  const response = await require("axios").get(url);
  const data = response.data;
  
  if (data && data.features && data.features.length > 0) {
    const route = data.features[0].properties.segments[0];
    return {
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
    };
  }
  throw new Error("Invalid ORS response");
};

const orsBreaker = createBreaker(rawORSRequest, "OpenRouteService");

/**
 * Call OpenRouteService Directions API
 * Fallback to null if error or no API key, triggering Haversine calculation.
 */
async function getDistanceFromORS(pickupCoords, destCoords) {
  try {
     return await orsBreaker.fire(pickupCoords, destCoords);
  } catch(e) {
     return null; // Fallback guarantees an object is returned via Haversine array fallback natively in the Circuit Breaker
  }
}

/**
 * Calculate localized surge multiplier using raw geographic demand metrics.
 */
async function calculateDynamicSurge(pickupCoords, radiusKm = 5) {
  try {
    const MathGeo = {
      type: "Point",
      coordinates: pickupCoords
    };

    // Calculate Driver Supply (Available in area)
    const availableDrivers = await countDrivers({
      isOnline: true,
      currentRideId: null,
      verificationStatus: "approved",
      status: "active",
      location: {
        $near: {
          $geometry: MathGeo,
          $maxDistance: radiusKm * 1000
        }
      }
    });

    // Approximate Demand (We assume standard baseline if no recent metric, simplifying logic)
    // For true scale, you'd calculate Ride documents created in the last 10 minutes near this point.
    const recentDemandQuery = await countRides({
       createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
       "pickup.location": {
         $near: {
           $geometry: MathGeo,
           $maxDistance: radiusKm * 1000
         }
       }
    });

    const supply = Math.max(availableDrivers, 1); // Prevent Division by zero
    const demand = Math.max(recentDemandQuery, 1);
    
    // Simplistic Multiplier (Demand / Supply)
    let rawSurge = demand / supply;
    
    // Bounds check to avoid alienating users or shorting drivers
    return Math.max(1.0, Math.min(rawSurge, 3.5)); // Surge bounded 1.0x to 3.5x
  } catch(e) {
    return 1.0; // Failsafe
  }
}

/**
 * Estimate fare based on distance between pickup and destination.
 * Uses ORS API by default, falls back to Haversine formula.
 */
async function estimateFare(pickupCoords, destCoords, vehicleType) {
  const rates = FARE_RATES[vehicleType];
  if (!rates) throw new Error(`Unknown vehicle type: ${vehicleType}`);

  let distanceKm = 0;
  let durationMinutes = 0;

  // Calculate Geographical Demand Price Padding dynamically
  const surgeMultiplier = await calculateDynamicSurge(pickupCoords);

  // Attempt dynamic realistic calculation
  const orsResult = await getDistanceFromORS(pickupCoords, destCoords);

  if (orsResult) {
    distanceKm = orsResult.distanceKm;
    durationMinutes = orsResult.durationMinutes;
  } else {
    // API Failure Fallback (Haversine formula)
    const [lng1, lat1] = pickupCoords;
    const [lng2, lat2] = destCoords;
    const R = 6371; 
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    durationMinutes = (distanceKm / 25) * 60; // Assume 25km/h
  }

  // Dynamic fare calculation formula
  const estimatedFare =
    (rates.baseFare +
      rates.perKmRate * distanceKm +
      rates.perMinuteRate * durationMinutes) *
    surgeMultiplier;

  console.log(`[Rate Calculated] Fare: ${estimatedFare} | Distance: ${distanceKm} | Duration: ${durationMinutes} | Surge: x${surgeMultiplier.toFixed(2)}`);

  return {
    estimatedFare: Math.max(rates.baseFare, Math.round(estimatedFare * 100) / 100), // Ensures minimum base fare
    baseFare: rates.baseFare,
    perKmRate: rates.perKmRate,
    perMinuteRate: rates.perMinuteRate,
    distance: Math.round(distanceKm * 100) / 100,
    duration: Math.round(durationMinutes * 60), // Return duration in seconds
    surgePriceMultiplier: Math.round(surgeMultiplier * 100) / 100,
    currency: "INR",
  };
}

/**
 * Generate a 4-digit OTP for ride verification.
 */
function generateOTP() {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return { code, expiresAt, verified: false };
}

/**
 * Valid ride status transitions — enforces the lifecycle state machine.
 * Key: current status → Value: array of allowed next statuses
 */
const VALID_TRANSITIONS = {
  requested: ["accepted", "rejected", "cancelled"],
  accepted: ["arriving", "in_progress", "completed", "cancelled"],
  arriving: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  rejected: [],
  cancelled: [],
};

/**
 * Validate that a status transition is allowed.
 */
function validateStatusTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${currentStatus} → ${newStatus}. ` +
        `Allowed: [${(allowed || []).join(", ")}]`
    );
  }
}

module.exports = {
  estimateFare,
  generateOTP,
  validateStatusTransition,
  getDistanceFromORS,
  FARE_RATES,
};
