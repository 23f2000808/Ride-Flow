const mongoose = require("mongoose");
const logger = require("../utils/logger");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const { buildLocationPoint } = require("../services/dashboardMocking");
const {
  countUsers,
  findAccountByIdForRole,
} = require("../repositories/account.repository");
const {
  countDrivers,
  findDriverById,
  findDrivers,
  findNearbyDrivers,
  updateDriverById,
} = require("../repositories/driver.repository");
const {
  aggregateRides,
  countRides,
  createRide,
  createRideEvent,
  deleteRideById,
  findOneRide,
  findRideById,
  findRides,
  insertRideDraft,
  saveRide,
  updateOneRide,
  updateRideById,
} = require("../repositories/ride.repository");
const {
  estimateFare,
  generateOTP,
  validateStatusTransition,
  getDistanceFromORS,
} = require("../services/ride.service");

const emitRideEvent = (eventName, payload, rooms = []) => {
  try {
    const { getIO } = require("../config/socket");
    const io = getIO();
    rooms.forEach((room) => {
      if (room) io.to(room).emit(eventName, payload);
    });
  } catch (error) {
    logger.warn({ err: error, eventName }, "Socket emit skipped");
  }
};

const getEffectiveFare = (ride) =>
  Number(
    ride?.effectiveFare
      ?? ride?.fare?.actualFare
      ?? ride?.fare?.estimatedFare
      ?? 0
  );

const rideListSelect =
  "user driver pickup destination status vehicleType distance payment.method createdAt updatedAt requestedAt acceptedAt startedAt completedAt fare effectiveFare";

const mapRideForDashboard = (ride) => ({
  id: ride._id,
  customerId: ride.user?._id || ride.user,
  driverId: ride.driver?._id || ride.driver || null,
  pickup: ride.pickup?.address,
  dropoff: ride.destination?.address,
  status: ride.status,
  fare: getEffectiveFare(ride),
  fareDisplay: `Rs ${Math.round(getEffectiveFare(ride))}`,
  vehicleType: ride.vehicleType,
  distance: ride.distance || 0,
  distanceDisplay: ride.distance ? `${Number(ride.distance).toFixed(1)} km` : "Distance pending",
  paymentMethod: ride.payment?.method || "cash",
  createdAt: ride.createdAt,
  updatedAt: ride.updatedAt,
  acceptedAt: ride.acceptedAt,
  startedAt: ride.startedAt,
  completedAt: ride.completedAt,
  customer: ride.user
    ? {
        id: ride.user._id,
        name: `${ride.user.fullname?.firstname || ""} ${ride.user.fullname?.lastname || ""}`.trim(),
        email: ride.user.email,
      }
    : null,
  driver: ride.driver
    ? {
        id: ride.driver._id,
        name: `${ride.driver.fullname?.firstname || ""} ${ride.driver.fullname?.lastname || ""}`.trim(),
        email: ride.driver.email,
        phone: ride.driver.phone,
        rating: ride.driver.rating?.average || null,
        vehicle: ride.driver.vehicle
          ? `${ride.driver.vehicle.color || ""} ${ride.driver.vehicle.model || ride.driver.vehicle.vehicleType || ""}`.trim()
          : null,
      }
    : null,
});

const getCurrentUserId = (req) => req.user?._id?.toString();
const activeRideStatuses = ["requested", "accepted"];
const tierToVehicleType = {
  mini: "car",
  sedan: "car",
  suv: "van",
};
const toObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : value;

const normalizeRideSortField = (sortBy = "createdAt") => {
  if (["createdAt", "fare", "distance"].includes(sortBy)) return sortBy;
  return "createdAt";
};

const normalizeRideSortOrder = (order = "desc") =>
  String(order).toLowerCase() === "asc" ? "asc" : "desc";

const buildDateQuery = (fromDate, toDate) => {
  if (!fromDate && !toDate) return null;

  const requestedAt = {};
  if (fromDate) requestedAt.$gte = new Date(fromDate);
  if (toDate) requestedAt.$lte = new Date(`${toDate}T23:59:59.999Z`);
  return requestedAt;
};

const buildNumericRangeQuery = (minimumValue, maximumValue) => {
  const range = {};
  if (minimumValue !== undefined && minimumValue !== "" && !Number.isNaN(Number(minimumValue))) {
    range.$gte = Number(minimumValue);
  }
  if (maximumValue !== undefined && maximumValue !== "" && !Number.isNaN(Number(maximumValue))) {
    range.$lte = Number(maximumValue);
  }

  return Object.keys(range).length ? range : null;
};

const buildFareFilter = (minPrice, maxPrice) => {
  return buildNumericRangeQuery(minPrice, maxPrice);
};

const buildRideQuery = ({
  baseQuery = {},
  status,
  fromDate,
  toDate,
  minPrice,
  maxPrice,
  minDistance,
  maxDistance,
}) => {
  const query = { ...baseQuery };

  if (status && status !== "all") {
    query.status = status;
  }

  const requestedAt = buildDateQuery(fromDate, toDate);
  if (requestedAt) {
    query.requestedAt = requestedAt;
  }

  const distance = buildNumericRangeQuery(minDistance, maxDistance);
  if (distance) {
    query.distance = distance;
  }

  const effectiveFare = buildFareFilter(minPrice, maxPrice);
  if (effectiveFare) {
    query.effectiveFare = effectiveFare;
  }

  return {
    ...query,
  };
};

const buildRideSummary = async (query) => {
  const [summary] = await aggregateRides([
    { $match: query },
    {
      $group: {
        _id: null,
        totalRides: { $sum: 1 },
        avgFare: { $avg: { $ifNull: ["$effectiveFare", 0] } },
        totalFare: { $sum: { $ifNull: ["$effectiveFare", 0] } },
        avgDistance: {
          $avg: {
            $ifNull: ["$distance", 0],
          },
        },
      },
    },
  ]);

  return {
    totalRides: summary?.totalRides || 0,
    avgFare: Math.round(summary?.avgFare || 0),
    totalFare: Math.round(summary?.totalFare || 0),
    avgDistance: Number((summary?.avgDistance || 0).toFixed(1)),
  };
};

const getValidatedRideId = (req, res) => {
  if (!req.user?._id) {
    sendError(res, {
      statusCode: 401,
      message: "Unauthorized.",
    });
    return null;
  }

  const { rideId } = req.params;

  console.log("rideId:", rideId);
  console.log("user:", req.user);

  if (!mongoose.Types.ObjectId.isValid(rideId)) {
    sendError(res, {
      statusCode: 400,
      message: "Invalid ride ID",
    });
    return null;
  }

  return rideId;
};

// ─── CREATE RIDE ────────────────────────────────────────
// POST /api/rides
// Creates a new ride request with fare estimation and OTP generation.
exports.createRide = async (req, res) => {
  try {
    console.log("Incoming ride request:", req.body);
    const {
      userId,
      pickup,
      destination,
      vehicleType,
      fare,
      paymentMethod,
      surgePriceMultiplier,
    } = req.body;
    const vehicleTypeMap = {
      mini: "car",
      sedan: "car",
      suv: "van",
    };
    const requestedVehicleType = String(vehicleType || "").toLowerCase();
    const persistedVehicleType = vehicleTypeMap[requestedVehicleType] || requestedVehicleType;
    const clientEstimatedFare = Number(fare?.estimatedFare);

    // ── Validation ──────────────────────────────────────
    if (!userId || !pickup || !destination || !vehicleType) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: userId, pickup, destination, vehicleType",
      });
    }

    if (!fare || !Number.isFinite(clientEstimatedFare)) {
      return res.status(400).json({
        success: false,
        message: "fare.estimatedFare is required.",
      });
    }

    if (
      !pickup.address ||
      !Array.isArray(pickup.location?.coordinates) ||
      pickup.location.coordinates.length !== 2 ||
      !destination.address ||
      !Array.isArray(destination.location?.coordinates) ||
      destination.location.coordinates.length !== 2
    ) {
      return res.status(400).json({
        success: false,
        message:
          "pickup and destination must include 'address' and 'location.coordinates'",
      });
    }

    if (
      !pickup.location.coordinates.every((value) => Number.isFinite(Number(value))) ||
      !destination.location.coordinates.every((value) => Number.isFinite(Number(value)))
    ) {
      return res.status(400).json({
        success: false,
        message: "pickup and destination coordinates must be valid numbers.",
      });
    }

    if (!["car", "auto", "motorcycle", "van"].includes(persistedVehicleType)) {
      return res.status(400).json({
        success: false,
        message: "vehicleType is invalid.",
      });
    }

    // ── Calculate fare ──────────────────────────────────
    const fareEstimate = await estimateFare(
      pickup.location.coordinates,
      destination.location.coordinates,
      requestedVehicleType,
      surgePriceMultiplier || 1.0
    );

    // ── Generate OTP ────────────────────────────────────
    const otp = generateOTP();

    // ── Create ride document ────────────────────────────
    const ride = await createRide({
      user: userId,
      status: "requested",
      pickup: {
        address: pickup.address,
        location: {
          type: "Point",
          coordinates: pickup.location.coordinates,
        },
      },
      destination: {
        address: destination.address,
        location: {
          type: "Point",
          coordinates: destination.location.coordinates,
        },
      },
      vehicleType: persistedVehicleType,
      fare: {
        estimatedFare: clientEstimatedFare,
        baseFare: fareEstimate.baseFare,
        perKmRate: fareEstimate.perKmRate,
        perMinuteRate: fareEstimate.perMinuteRate,
        surgePriceMultiplier: fareEstimate.surgePriceMultiplier,
        currency: fareEstimate.currency,
      },
      effectiveFare: clientEstimatedFare,
      distance: fareEstimate.distance,
      duration: fareEstimate.duration,
      otp,
      payment: {
        method: paymentMethod || "cash",
      },
    });

    // ── DRIVER MATCHING LOGIC (Geospatial $near) ────────
    // Preliminary O(1) filter using MongoDB 2dsphere index to grab nearest 5 candidates
    let nearbyDrivers = [];
    let usedFallbackDriverPool = false;
    try {
      nearbyDrivers = await findNearbyDrivers(
        pickup.location.coordinates[0],
        pickup.location.coordinates[1],
        7, // Search radius in km
        persistedVehicleType,
        { limit: 5 },
      ); // Cap to avoid ORS API rate limits
    } catch (driverLookupError) {
      logger.warn(
        {
          err: driverLookupError,
          rideId: ride._id,
          pickup: pickup.location.coordinates,
          vehicleType: persistedVehicleType,
        },
        "Nearby driver lookup failed"
      );
    }

    if (nearbyDrivers.length === 0) {
      usedFallbackDriverPool = true;
      nearbyDrivers = await findDrivers({
        verificationStatus: "approved",
        status: "active",
        "vehicle.vehicleType": persistedVehicleType,
      }, {
        select: "-password",
        limit: 5,
      });
    }

    // Edge Case: No drivers available at all
    if (nearbyDrivers.length === 0) {
      await updateRideById(ride._id, { 
        status: "cancelled", 
        "cancellation.reason": "No drivers available nearby",
        "cancellation.cancelledBy": "system"
      });
      return res.status(200).json({
        success: false,
        message: "No drivers available in your area right now.",
      });
    }

    // ── TRUE DRIVING DISTANCE OPTIMIZATION (ORS Matrix) ──
    const driverDistances = await Promise.all(
      nearbyDrivers.map(async (driver) => {
        const route = await getDistanceFromORS(
          driver.location.coordinates, 
          pickup.location.coordinates
        );
        return {
          driver,
          distance: route ? route.distanceKm : Infinity,
          etaMinutes: route ? route.durationMinutes : Infinity
        };
      })
    );

    driverDistances.sort((a, b) => a.distance - b.distance);
    const sortedDrivers = driverDistances
      .filter((entry) => entry.driver && Number.isFinite(entry.distance))
      .map((entry) => ({
        _id: entry.driver._id,
        etaMinutes: entry.etaMinutes,
      }));

    if (sortedDrivers.length === 0) {
      await updateRideById(ride._id, {
        status: "cancelled",
        "cancellation.reason": "No routable drivers found",
        "cancellation.cancelledBy": "system",
      });

      return res.status(200).json({
        success: false,
        message: "No drivers available in your area right now.",
      });
    }

    const { dispatchQueue } = require("../workers/dispatch.worker");

    // Persist immutable audit log
    await createRideEvent({
      ride: ride._id,
      eventType: "requested",
      actor: "user",
      actorId: userId,
      details: { pickup: pickup.address, destination: destination.address, vehicleType: persistedVehicleType }
    });

    try {
      // Enqueue 1st strictly bounded persistent worker job to Redis memory
      await dispatchQueue.add('dispatch-next-batch', {
         rideId: ride._id.toString(),
         userId: userId.toString(), 
         driversList: sortedDrivers.map(d => ({
           driverId: d._id.toString(),
           etaMinutes: d.etaMinutes
         })),
         batchIndex: 0
      }, { 
         removeOnComplete: true,
         attempts: 3 // Resiliency if worker process crashes actively
      });
    } catch (dispatchError) {
      logger.error({ err: dispatchError, rideId: ride._id, path: req.originalUrl }, "Ride dispatch enqueue failed");
    }

    // ── Return ride (include OTP only on creation) ──────
    res.status(201).json({
      success: true,
      message: usedFallbackDriverPool
        ? `Searching for drivers... ${sortedDrivers.length} drivers found in the wider network.`
        : `Searching for drivers... ${sortedDrivers.length} drivers nearby.`,
      data: {
        ride,
        otp: otp.code,
        fareEstimate,
      },
    });
  } catch (error) {
    console.error(error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.bookRide = async (req, res) => {
  try {
    console.log("Incoming ride request:", req.body);
    const userId = req.body.userId || getCurrentUserId(req);
    const pickupText = req.body.pickup;
    const dropText = req.body.drop || req.body.dropoff;
    const selectedVehicle = req.body.vehicleType || "mini";
    const scheduledAt = req.body.scheduledAt || null;
    const vehicleTypeMap = {
      mini: "car",
      sedan: "car",
      suv: "van",
    };

    if (!userId || !pickupText || !dropText) {
      return sendError(res, {
        statusCode: 400,
        message: "pickup, drop, and userId are required.",
      });
    }

    const user = await findAccountByIdForRole("customer", userId);
    if (!user) {
      return sendError(res, {
        statusCode: 404,
        message: "Customer not found.",
      });
    }

    const pickup = buildLocationPoint(pickupText);
    const destination = buildLocationPoint(dropText, 77.6446, 12.9916);

    const fareEstimate = await estimateFare(
      pickup.location.coordinates,
      destination.location.coordinates,
      selectedVehicle,
      1
    );

    const rideDraft = await insertRideDraft({
      user: userId,
      pickup,
      destination,
      vehicleType: vehicleTypeMap[selectedVehicle] || "car",
      fare: {
        estimatedFare: fareEstimate.estimatedFare,
        baseFare: fareEstimate.baseFare,
        perKmRate: fareEstimate.perKmRate,
        perMinuteRate: fareEstimate.perMinuteRate,
        surgePriceMultiplier: fareEstimate.surgePriceMultiplier,
        currency: fareEstimate.currency,
      },
      effectiveFare: fareEstimate.estimatedFare,
      distance: fareEstimate.distance,
      duration: fareEstimate.duration,
      payment: { method: "cash" },
      otp: generateOTP(),
      scheduledAt: scheduledAt || undefined,
    });

    const hydratedRide = await findRideById(rideDraft._id, {
      populate: [
        { path: "user", select: "fullname email" },
        { path: "driver", select: "fullname email phone vehicle rating" },
      ],
    });

    emitRideEvent(
      "ride:requested",
      { ride: mapRideForDashboard(hydratedRide) },
      ["drivers_lobby", `user_${userId}`]
    );

    return sendSuccess(res, {
      statusCode: 201,
      message: "Ride booked successfully.",
      data: mapRideForDashboard(hydratedRide),
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Book ride failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to book ride.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.calculateFarePreview = async (req, res) => {
  try {
    const { pickupCoords, dropoffCoords } = req.body || {};

    if (
      !Array.isArray(pickupCoords) ||
      pickupCoords.length !== 2 ||
      !Array.isArray(dropoffCoords) ||
      dropoffCoords.length !== 2
    ) {
      return sendError(res, {
        statusCode: 400,
        message: "pickupCoords and dropoffCoords are required.",
      });
    }

    const [miniFare, sedanFare, suvFare] = await Promise.all([
      estimateFare(pickupCoords, dropoffCoords, "mini"),
      estimateFare(pickupCoords, dropoffCoords, "sedan"),
      estimateFare(pickupCoords, dropoffCoords, "suv"),
    ]);

    return sendSuccess(res, {
      message: "Fare preview calculated successfully.",
      data: {
        distance: miniFare.distance,
        duration: miniFare.duration,
        fares: {
          mini: Math.round(miniFare.estimatedFare),
          sedan: Math.round(sedanFare.estimatedFare),
          suv: Math.round(suvFare.estimatedFare),
        },
      },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Fare preview failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to calculate fare preview.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ─── GET RIDE BY ID ─────────────────────────────────────
// GET /api/rides/:id
exports.getRideById = async (req, res) => {
  try {
    const ride = await findRideById(req.params.id, {
      populate: [
        { path: "user", select: "fullname email phone" },
        { path: "driver", select: "fullname phone vehicle rating" },
      ],
    });

    if (!ride) {
      return sendError(res, { statusCode: 404, message: "Ride not found." });
    }

    return sendSuccess(res, {
      message: "Ride loaded successfully.",
      data: mapRideForDashboard(ride),
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Ride lookup failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to load ride.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getDriverRides = async (req, res) => {
  try {
    const driverId = req.params.driverId;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const latestRequestLimit = Math.min(Math.max(parseInt(req.query.requestLimit, 10) || 8, 1), 20);
    const skip = (page - 1) * limit;
    const {
      status,
      fromDate,
      toDate,
      minPrice,
      maxPrice,
      minDistance,
      maxDistance,
    } = req.query;
    const sortBy = ["createdAt", "fare", "distance"].includes(req.query.sortBy)
      ? req.query.sortBy
      : "createdAt";

    const order = req.query.order === "asc" ? 1 : -1;

      let sortOptions = {};
      if (sortBy === "createdAt") {
        sortOptions = { requestedAt: order };
      } else if (sortBy === "fare") {
        sortOptions = { effectiveFare: order, requestedAt: -1 };
      } else if (sortBy === "distance") {
        sortOptions = { distance: order, requestedAt: -1 };
      }
      const assignedQuery = buildRideQuery({
        baseQuery: { driver: toObjectId(driverId) },
        status,
      fromDate,
      toDate,
      minPrice,
        maxPrice,
        minDistance,
        maxDistance,
      });

      const [assignedRides, total, incomingRequests, summary] = await Promise.all([
      findRides(assignedQuery, {
        select: rideListSelect,
        sort: sortOptions,
        skip,
        limit,
        populate: [
          { path: "user", select: "fullname email" },
          { path: "driver", select: "fullname email" },
        ],
        lean: true,
      }),
      countRides(assignedQuery),
      findRides({ status: "requested", driver: null }, {
        select: rideListSelect,
        sort: { requestedAt: -1 },
        limit: latestRequestLimit,
        populate: [
          { path: "user", select: "fullname email" },
        ],
        lean: true,
      }),
      buildRideSummary(assignedQuery),
    ]);

    const activeRideDocument = await findOneRide({
      driver: driverId,
      status: { $in: ["accepted", "arriving", "in_progress"] },
    }, {
      select: rideListSelect,
      sort: { updatedAt: -1 },
      populate: [
        { path: "user", select: "fullname email" },
        { path: "driver", select: "fullname email" },
      ],
      lean: true,
    });

      const incomingWithPriority = incomingRequests
      .map((ride) => ({
        ...mapRideForDashboard(ride),
        requestPriority: ride.requestedAt ? new Date(ride.requestedAt).getTime() : 0,
      }))
      .sort((left, right) => right.requestPriority - left.requestPriority);

    return sendSuccess(res, {
      message: "Driver rides loaded successfully.",
      data: {
        activeRide: activeRideDocument ? mapRideForDashboard(activeRideDocument) : null,
        assignedRides: assignedRides.map(mapRideForDashboard),
        incomingRequests: incomingWithPriority,
        totalRides: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        summary,
        filters: {
          status: status || "all",
          sortBy,
          order: order === 1 ? "asc"  : "desc",
          fromDate: fromDate || null,
          toDate: toDate || null,
          minPrice: minPrice || null,
          maxPrice: maxPrice || null,
          minDistance: minDistance || null,
          maxDistance: maxDistance || null,
        },
      },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Driver rides lookup failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to load driver rides.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ─── UPDATE RIDE STATUS (using $set) ────────────────────
// PATCH /api/rides/:id/status
// Transitions the ride through its lifecycle. Enforces valid transitions.
// Demonstrates MongoDB $set operator for atomic field updates.
exports.updateRideStatus = async (req, res) => {
  try {
    const { status, driverId, cancellation } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: "'status' is required" });
    }

    // ─── 1. PREVENT RACE CONDITIONS: ATOMIC ACCEPT ──────────
    if (status === "accepted") {
      if (!driverId) {
        return res.status(400).json({ success: false, message: "'driverId' is required" });
      }

      // Atomic Update: Only updates if status exactly matches "requested"
      const acceptedRide = await updateOneRide(
        { _id: req.params.id, status: "requested" },
        { 
          $set: { 
            status: "accepted", 
            driver: driverId, 
            acceptedAt: new Date() 
          }
        },
        { new: true, runValidators: true },
        {
          populate: [
            { path: "user", select: "fullname email phone" },
            { path: "driver", select: "fullname phone vehicle" },
          ],
        },
      );

      // Race condition hit — someone else grabbed it first, or it was cancelled
      if (!acceptedRide) {
        return res.status(409).json({
          success: false,
          message: "Ride is no longer available or already accepted by another driver.",
        });
      }

      // Lock Driver
      await updateDriverById(driverId, {
        $set: { currentRideId: acceptedRide._id },
      });

      // Immutable Event Mapping
      await createRideEvent({
         ride: acceptedRide._id,
         eventType: "accepted",
         actor: "driver",
         actorId: driverId
      });

      // Broadcast ride_taken to globally inform other drivers to drop it locally
      emitRideEvent("ride_taken", { rideId: acceptedRide._id, acceptedBy: driverId }, ["drivers_lobby"]);
      emitRideEvent(
        "ride:accepted",
        { ride: mapRideForDashboard(acceptedRide) },
        [`user_${acceptedRide.user?._id || acceptedRide.user}`, `driver_${driverId}`, `ride_${acceptedRide._id}`]
      );

      return sendSuccess(res, {
        message: "Ride accepted successfully.",
        data: mapRideForDashboard(acceptedRide),
      });
    }

    // ── Fetch current ride to validate transition ───────
    const currentRide = await findRideById(req.params.id);
    if (!currentRide) {
      return sendError(res, { statusCode: 404, message: "Ride not found." });
    }

    try {
      validateStatusTransition(currentRide.status, status);
    } catch (err) {
      return sendError(res, { statusCode: 400, message: err.message });
    }

    const updateSet = { status };
    switch (status) {
      case "arriving":
        updateSet.driverArrivedAt = new Date();
        break;

      case "in_progress":
        updateSet.startedAt = new Date();
        break;

      case "completed":
        if (!currentRide.startedAt) {
          updateSet.startedAt = currentRide.acceptedAt || new Date();
        }
        updateSet.completedAt = new Date();
        updateSet["payment.status"] = "completed";
        updateSet["fare.actualFare"] = currentRide.fare.estimatedFare;
        updateSet.effectiveFare = currentRide.fare.estimatedFare;
        break;

      case "cancelled":
        updateSet.cancellation = {
          cancelledBy: cancellation?.cancelledBy || "system",
          reason: cancellation?.reason || "No reason provided",
          cancelledAt: new Date(),
        };
        
        // Failsafe Logic: If driver cancelled on way to pickup, notify user instantly (reassignment could be built here recursively using dispatchQueue)
        if (updateSet.cancellation.cancelledBy === 'driver') {
          emitRideEvent(
            "ride_status_update",
            { rideId: req.params.id, status: "cancelled", message: "Your driver had to cancel. Please request a new ride." },
            [`ride_${req.params.id}`, `user_${currentRide.user}`]
          );
        }
        break;
    }

    const updatedRide = await updateRideById(
      req.params.id,
      { $set: updateSet },
      { new: true, runValidators: true },
      {
        populate: [
          { path: "user", select: "fullname email phone" },
          { path: "driver", select: "fullname phone vehicle" },
        ],
      },
    );

    // Generic Event Source log push
    await createRideEvent({
       ride: updatedRide._id,
       eventType: status,
       actor: cancellation?.cancelledBy ? cancellation.cancelledBy : (driverId || req.user?._id ? "driver" : "system"),
       actorId: driverId || req.user?._id || null
    });

    // Unlock Driver on completion/cancellation
    if (status === "completed" || status === "cancelled") {
      if (updatedRide.driver) {
        await updateDriverById(updatedRide.driver, {
          $set: { currentRideId: null },
        });
      }
    }

    emitRideEvent(
      "ride:status",
      { ride: mapRideForDashboard(updatedRide), status },
      [
        `ride_${updatedRide._id}`,
        `user_${updatedRide.user?._id || updatedRide.user}`,
        updatedRide.driver ? `driver_${updatedRide.driver?._id || updatedRide.driver}` : null,
      ]
    );

    return sendSuccess(res, {
      message: `Ride status updated to '${status}'.`,
      data: mapRideForDashboard(updatedRide),
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Ride status update failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to update ride status.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.acceptRide = async (req, res) => {
  try {
    const rideId = getValidatedRideId(req, res);
    if (!rideId) return;

    const ride = await findRideById(rideId);
    console.log("ride:", ride);

    if (!ride) {
      return sendError(res, {
        statusCode: 404,
        message: "Ride not found.",
      });
    }

    if (ride.status !== "requested") {
      return sendError(res, {
        statusCode: 409,
        message: "Ride already accepted or not available",
      });
    }

    ride.status = "accepted";
    ride.driver = req.user?._id;
    await saveRide(ride);

    const populatedRide = await findRideById(ride._id, {
      populate: [
        { path: "user", select: "fullname email" },
        { path: "driver", select: "fullname email phone vehicle rating" },
      ],
    });

    return sendSuccess(res, {
      statusCode: 200,
      message: "Ride accepted successfully.",
      data: populatedRide ? mapRideForDashboard(populatedRide) : null,
    });
  } catch (error) {
    console.error("acceptRide error:", error);

    if (error.name === "CastError") {
      return sendError(res, {
        statusCode: 400,
        message: "Invalid ride ID",
      });
    }

    return sendError(res, {
      statusCode: 500,
      message: "Failed to accept ride.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.rejectRide = async (req, res) => {
  try {
    const rideId = getValidatedRideId(req, res);
    if (!rideId) return;

    const ride = await findRideById(rideId);
    console.log("ride:", ride);

    if (!ride) {
      return sendError(res, { statusCode: 404, message: "Ride not found." });
    }

    if (ride.status !== "requested") {
      return sendError(res, {
        statusCode: 409,
        message: "Ride is no longer available for rejection.",
      });
    }

    req.params.id = rideId;
    req.body.status = "cancelled";
    req.body.driverId = req.body.driverId || getCurrentUserId(req);
    req.body.cancellation = {
      cancelledBy: "driver",
      reason: "Driver rejected request",
    };

    return exports.updateRideStatus(req, res);
  } catch (error) {
    console.error("rejectRide error:", error);

    if (error.name === "CastError") {
      return sendError(res, {
        statusCode: 400,
        message: "Invalid ride ID",
      });
    }

    return sendError(res, {
      statusCode: 500,
      message: "Failed to reject ride.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.startRide = async (req, res) => {
  req.params.id = req.params.id || req.params.rideId;
  req.body.status = "in_progress";
  req.body.driverId = req.body.driverId || getCurrentUserId(req);
  return exports.updateRideStatus(req, res);
};

exports.completeRide = async (req, res) => {
  req.params.id = req.params.id || req.params.rideId;
  req.body.status = "completed";
  req.body.driverId = req.body.driverId || getCurrentUserId(req);
  return exports.updateRideStatus(req, res);
};

// ─── ADD RATING TO RIDE (using $set + $push concept) ────
// PATCH /api/rides/:id/rate
// Demonstrates $set for updating nested objects on the ride,
// and $push on the driver's rating (incrementally updating average).
exports.rateRide = async (req, res) => {
  try {
    const { ratedBy, score, review } = req.body;

    if (!ratedBy || !score) {
      return res.status(400).json({
        success: false,
        message: "'ratedBy' (user|driver) and 'score' (1-5) are required",
      });
    }

    if (score < 1 || score > 5) {
      return res.status(400).json({
        success: false,
        message: "Score must be between 1 and 5",
      });
    }

    const ride = await findRideById(req.params.id);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    if (ride.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Can only rate completed rides",
      });
    }

    // ── $set the rating on the ride document ────────────
    const ratingField =
      ratedBy === "user" ? "ratings.userRating" : "ratings.driverRating";

    const updatedRide = await updateRideById(
      req.params.id,
      {
        $set: {
          [ratingField]: { score, review: review || "" },
        },
      },
      { new: true }
    );

    // ── Update driver's rolling average ($set with calculation) ──
    // When a USER rates the driver, we update the driver's average rating.
    // This uses a weighted rolling average formula:
    //   newAvg = (oldAvg * totalRatings + newScore) / (totalRatings + 1)
    if (ratedBy === "user" && ride.driver) {
      const driver = await findDriverById(ride.driver);
      if (driver) {
        const newTotal = driver.rating.totalRatings + 1;
        const newAverage =
          (driver.rating.average * driver.rating.totalRatings + score) / newTotal;

        await updateDriverById(ride.driver, {
          $set: {
            "rating.average": Math.round(newAverage * 100) / 100,
            "rating.totalRatings": newTotal,
          },
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Rating submitted by ${ratedBy}`,
      data: updatedRide,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ─── UPDATE RIDE FIELDS (generic $set + $push) ──────────
// PATCH /api/rides/:id
// General-purpose update endpoint demonstrating both $set and $push.
// $set: update specific fields atomically
// $push: append to array fields (e.g., route waypoints in future)
exports.updateRide = async (req, res) => {
  try {
    const { setFields, pushFields } = req.body;

    if (!setFields && !pushFields) {
      return res.status(400).json({
        success: false,
        message: "Provide 'setFields' and/or 'pushFields' in request body",
      });
    }

    const ride = await findRideById(req.params.id);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    // ── Build update operation ──────────────────────────
    // $set: overwrites specific fields without touching others
    // $push: appends values to array fields
    const updateOps = {};

    if (setFields && Object.keys(setFields).length > 0) {
      updateOps.$set = setFields;
    }

    if (pushFields && Object.keys(pushFields).length > 0) {
      updateOps.$push = pushFields;
    }

    const updatedRide = await updateRideById(
      req.params.id,
      updateOps,
      { new: true, runValidators: true },
      {
        populate: [
          { path: "user", select: "fullname email phone" },
          { path: "driver", select: "fullname phone vehicle" },
        ],
      },
    );

    res.status(200).json({
      success: true,
      message: "Ride updated successfully",
      data: updatedRide,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ─── GET USER'S RIDE HISTORY ────────────────────────────
// GET /api/rides/user/:userId
exports.getUserRides = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;
    const {
      status,
      fromDate,
      toDate,
      minPrice,
      maxPrice,
      minDistance,
      maxDistance,
    } = req.query;
    const sortBy = ["createdAt", "fare", "distance"].includes(req.query.sortBy)
      ? req.query.sortBy
      : "createdAt";

    const order = req.query.order === "asc" ? 1 : -1;

      let sortOptions = {};
      if (sortBy === "createdAt") {
        sortOptions = { requestedAt: order };
      } else if (sortBy === "fare") {
        sortOptions = { effectiveFare: order, requestedAt: -1 };
      } else if (sortBy === "distance") {
        sortOptions = { distance: order, requestedAt: -1 };
      }

      const query = buildRideQuery({
        baseQuery: { user: toObjectId(req.params.userId) },
      status,
      fromDate,
      toDate,
      minPrice,
      maxPrice,
      minDistance,
      maxDistance,
    });

      const [rides, total, summary] = await Promise.all([
        findRides(query, {
          select: rideListSelect,
          sort: sortOptions,
          skip,
          limit,
          populate: [
            { path: "driver", select: "fullname vehicle rating" },
          ],
          lean: true,
        }),
      countRides(query),
      buildRideSummary(query),
    ]);

    const formattedRides = rides.map(mapRideForDashboard);
    const activeRide = formattedRides.find((ride) =>
      activeRideStatuses.includes(ride.status)
    ) || null;

    return sendSuccess(res, {
      message: "User rides loaded successfully.",
      data: {
        rides: formattedRides,
        activeRide,
        totalRides: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        summary,
        filters: {
          status: status || "all",
          sortBy: sortBy,
          order: order === 1 ? "asc" : "desc",
          fromDate: fromDate || null,
          toDate: toDate || null,
          minPrice: minPrice || null,
          maxPrice: maxPrice || null,
          minDistance: minDistance || null,
          maxDistance: maxDistance || null,
        },
      },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "User rides lookup failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to load user rides.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.deleteRide = async (req, res) => {
  try {
    const ride = await findOneRide({ _id: req.params.id, user: getCurrentUserId(req) });

    if (!ride) {
      return sendError(res, { statusCode: 404, message: "Ride not found." });
    }

    if (!["requested", "cancelled"].includes(ride.status)) {
      return sendError(res, {
        statusCode: 400,
        message: "Only pending rides can be cancelled from this view.",
      });
    }

    const deletion = await deleteRideById(ride._id);

    if (!deletion.deletedCount) {
      return sendError(res, { statusCode: 404, message: "Ride not found." });
    }

    return sendSuccess(res, {
      message: "Ride cancelled successfully.",
      data: { id: req.params.id },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Delete ride failed");
    return sendError(res, { statusCode: 500, message: "Unable to cancel ride." });
  }
};

const analyticsRangeConfig = {
  today: { days: 1, unit: "hour", bucketFormat: "%H:00", label: "Today" },
  "7d": { days: 7, unit: "day", bucketFormat: "%d %b", label: "Last 7 Days" },
  "30d": { days: 30, unit: "day", bucketFormat: "%d %b", label: "Last 30 Days" },
  "6m": { days: 180, unit: "month", bucketFormat: "%b %Y", label: "Last 6 Months" },
};

const normalizeAnalyticsRange = (range = "7d") =>
  analyticsRangeConfig[range] ? range : "7d";

const getAnalyticsWindow = (range) => {
  const config = analyticsRangeConfig[normalizeAnalyticsRange(range)];
  const end = new Date();
  const start = new Date(end);

  if (config.days === 1) {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - (config.days - 1));
    start.setHours(0, 0, 0, 0);
  }

  const previousStart = new Date(start);
  previousStart.setDate(previousStart.getDate() - config.days);
  const previousEnd = new Date(start);
  previousEnd.setMilliseconds(previousEnd.getMilliseconds() - 1);

  return {
    config,
    start,
    end,
    previousStart,
    previousEnd,
  };
};

const formatGrowth = (currentValue, previousValue) => {
  if (!previousValue && !currentValue) return 0;
  if (!previousValue) return 100;
  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));
};

const getBusiestLabel = (items = []) => {
  if (!items.length) return "No data yet";
  return items.reduce((best, current) => (current.value > best.value ? current : best)).label;
};

const getPeakHourLabel = (peakHours = []) => {
  if (!peakHours.length) return "No peak pattern yet";

  const busiest = peakHours.reduce((best, current) =>
    current.value > best.value ? current : best
  );
  const hour = Number(busiest.hour ?? 0);
  const nextHour = (hour + 1) % 24;
  const formatHour = (value) => {
    const suffix = value >= 12 ? "PM" : "AM";
    const normalized = value % 12 || 12;
    return `${normalized}${suffix}`;
  };

  return `${formatHour(hour)}-${formatHour(nextHour)}`;
};

const buildAnalyticsInsights = ({
  scope,
  summary,
  trendGrowth,
  peakHours,
  rideTypes,
  favoriteRoute,
  topEarningDay,
}) => {
  const insights = [];
  const busiestDay = getBusiestLabel(summary?.busiestDays || []);
  const peakWindow = getPeakHourLabel(peakHours);

  if (busiestDay !== "No data yet") {
    insights.push({
      title: "Busiest day",
      body: `${busiestDay} is the strongest ride day in the selected window.`,
      tone: "accent",
    });
  }

  if (peakWindow !== "No peak pattern yet") {
    insights.push({
      title: "Peak hours",
      body: `Ride demand is strongest around ${peakWindow}.`,
      tone: "info",
    });
  }

  if (Number.isFinite(trendGrowth?.revenueGrowth)) {
    insights.push({
      title: scope === "driver" ? "Earnings momentum" : "Spend movement",
      body: `${trendGrowth.revenueGrowth >= 0 ? "Up" : "Down"} ${Math.abs(
        trendGrowth.revenueGrowth
      )}% compared with the previous period.`,
      tone: trendGrowth.revenueGrowth >= 0 ? "success" : "warning",
    });
  }

  if (scope === "driver" && topEarningDay) {
    insights.push({
      title: "Top earning day",
      body: `${topEarningDay.label} delivered the highest earnings in this range.`,
      tone: "success",
    });
  }

  if (scope === "user" && favoriteRoute) {
    insights.push({
      title: "Favorite route",
      body: `${favoriteRoute.label} is your most repeated trip pattern.`,
      tone: "accent",
    });
  }

  if (rideTypes?.length) {
    insights.push({
      title: scope === "driver" ? "Most requested vehicle" : "Preferred ride type",
      body: `${rideTypes[0].label} leads your ride mix right now.`,
      tone: "info",
    });
  }

  return insights.slice(0, 4);
};

exports.getRideAnalyticsOverview = async (req, res) => {
  try {
    const scope = req.query.scope === "driver" ? "driver" : "user";
    const range = normalizeAnalyticsRange(req.query.range);
    const scopedUserId = req.query.userId || getCurrentUserId(req);
    const scopedDriverId = req.query.driverId || getCurrentUserId(req);
    const rideMatch = {};

    if (scope === "driver") {
      if (!mongoose.Types.ObjectId.isValid(scopedDriverId)) {
        return sendError(res, { statusCode: 400, message: "Invalid driver ID." });
      }
      rideMatch.driver = new mongoose.Types.ObjectId(scopedDriverId);
    } else {
      if (!mongoose.Types.ObjectId.isValid(scopedUserId)) {
        return sendError(res, { statusCode: 400, message: "Invalid user ID." });
      }
      rideMatch.user = new mongoose.Types.ObjectId(scopedUserId);
    }

    const { config, start, end, previousStart, previousEnd } = getAnalyticsWindow(range);
    const currentMatch = {
      ...rideMatch,
      requestedAt: { $gte: start, $lte: end },
    };
    const previousMatch = {
      ...rideMatch,
      requestedAt: { $gte: previousStart, $lte: previousEnd },
    };
    const fareExpression = { $ifNull: ["$fare.actualFare", "$fare.estimatedFare"] };
    const completionStatuses = ["completed"];
    const ongoingStatuses = ["accepted", "in_progress"];

    const summaryPipeline = [
      { $match: currentMatch },
      {
        $group: {
          _id: null,
          totalRides: { $sum: 1 },
          totalRevenue: { $sum: fareExpression },
          avgDistance: { $avg: { $ifNull: ["$distance", 0] } },
          completedRides: {
            $sum: { $cond: [{ $in: ["$status", completionStatuses] }, 1, 0] },
          },
          cancelledRides: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
          ongoingRides: {
            $sum: { $cond: [{ $in: ["$status", ongoingStatuses] }, 1, 0] },
          },
          avgRating: {
            $avg: {
              $ifNull: [
                "$ratings.userRating.score",
                "$ratings.driverRating.score",
              ],
            },
          },
        },
      },
    ];

    const previousSummaryPipeline = [
      { $match: previousMatch },
      {
        $group: {
          _id: null,
          totalRides: { $sum: 1 },
          totalRevenue: { $sum: fareExpression },
          completedRides: {
            $sum: { $cond: [{ $in: ["$status", completionStatuses] }, 1, 0] },
          },
          cancelledRides: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
        },
      },
    ];

    const trendGroupId =
      config.unit === "hour"
        ? {
            year: { $year: "$requestedAt" },
            month: { $month: "$requestedAt" },
            day: { $dayOfMonth: "$requestedAt" },
            hour: {
              $hour: {
                date: "$requestedAt",
                timezone: "Asia/Kolkata",
              },
            },
          }
        : config.unit === "month"
          ? {
              year: { $year: "$requestedAt" },
              month: { $month: "$requestedAt" },
            }
          : {
              year: { $year: "$requestedAt" },
              month: { $month: "$requestedAt" },
              day: { $dayOfMonth: "$requestedAt" },
            };
    const trendSort =
      config.unit === "hour"
        ? { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1 }
        : config.unit === "month"
          ? { "_id.year": 1, "_id.month": 1 }
          : { "_id.year": 1, "_id.month": 1, "_id.day": 1 };

    const trendPipeline = [
      { $match: currentMatch },
      {
        $group: {
          _id: trendGroupId,
          rides: { $sum: 1 },
          revenue: { $sum: fareExpression },
        },
      },
      { $sort: trendSort },
    ];

    const peakHoursPipeline = [
      { $match: currentMatch },
      {
        $group: {
          _id: {
            $hour: {
              date: "$requestedAt",
              timezone: "Asia/Kolkata",
            },
          },
          value: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const statusDistributionPipeline = [
      { $match: currentMatch },
      { $group: { _id: "$status", value: { $sum: 1 } } },
      { $sort: { value: -1 } },
    ];

    const rideTypesPipeline = [
      { $match: currentMatch },
      { $group: { _id: "$vehicleType", value: { $sum: 1 } } },
      { $sort: { value: -1 } },
    ];

    const dayOfWeekPipeline = [
      { $match: currentMatch },
      {
        $group: {
          _id: {
            $dayOfWeek: {
              date: "$requestedAt",
              timezone: "Asia/Kolkata",
            },
          },
          value: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const heatmapPipeline = [
      { $match: currentMatch },
      {
        $group: {
          _id: {
            day: {
              $dayOfWeek: {
                date: "$requestedAt",
                timezone: "Asia/Kolkata",
              },
            },
            hour: {
              $hour: {
                date: "$requestedAt",
                timezone: "Asia/Kolkata",
              },
            },
          },
          value: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": 1, "_id.hour": 1 } },
    ];

    const favoriteRoutePipeline = [
      { $match: currentMatch },
      {
        $group: {
          _id: {
            pickup: "$pickup.address",
            dropoff: "$destination.address",
          },
          value: { $sum: 1 },
        },
      },
      { $sort: { value: -1 } },
      { $limit: 1 },
    ];

    const [
      [currentSummary],
      [previousSummary],
      trendRows,
      peakHourRows,
      statusRows,
      rideTypeRows,
      dayRows,
      heatmapRows,
      favoriteRouteRows,
      activeDrivers,
      totalUsers,
      driverProfile,
      activeRides,
    ] = await Promise.all([
      aggregateRides(summaryPipeline),
      aggregateRides(previousSummaryPipeline),
      aggregateRides(trendPipeline),
      aggregateRides(peakHoursPipeline),
      aggregateRides(statusDistributionPipeline),
      aggregateRides(rideTypesPipeline),
      aggregateRides(dayOfWeekPipeline),
      aggregateRides(heatmapPipeline),
      scope === "user" ? aggregateRides(favoriteRoutePipeline) : Promise.resolve([]),
      countDrivers({ isOnline: true, status: "active", verificationStatus: "approved" }),
      countUsers({ status: "active" }),
      scope === "driver"
        ? findDriverById(scopedDriverId, { select: "rating" })
        : Promise.resolve(null),
      scope === "driver"
        ? countRides({
            driver: new mongoose.Types.ObjectId(scopedDriverId),
            status: { $in: ongoingStatuses },
          })
        : Promise.resolve(0),
    ]);

    const trends = trendRows.map((row) => ({
      label:
        config.unit === "hour"
          ? `${String(row._id.hour).padStart(2, "0")}:00`
          : config.unit === "month"
            ? `${String(row._id.month).padStart(2, "0")}/${row._id.year}`
            : `${String(row._id.day).padStart(2, "0")}/${String(row._id.month).padStart(2, "0")}`,
      rides: row.rides,
      revenue: Math.round(row.revenue || 0),
    }));
    const ridesTrend = trends.map((row) => ({ label: row.label, value: row.rides }));
    const revenueTrend = trends.map((row) => ({ label: row.label, value: row.revenue }));
    const peakHours = peakHourRows.map((row) => ({
      hour: row._id,
      label: `${String(row._id).padStart(2, "0")}:00`,
      value: row.value,
    }));
    const statusDistribution = statusRows.map((row) => ({
      label: row._id || "unknown",
      value: row.value,
    }));
    const rideTypes = rideTypeRows.map((row) => ({
      label: row._id || "unknown",
      value: row.value,
    }));

    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const busiestDays = dayRows.map((row) => ({
      label: weekdayLabels[(row._id || 1) - 1],
      value: row.value,
    }));

    const heatmap = weekdayLabels.flatMap((dayLabel, dayIndex) =>
      Array.from({ length: 24 }, (_, hour) => {
        const existing = heatmapRows.find(
          (row) => row._id.day === dayIndex + 1 && row._id.hour === hour
        );

        return {
          day: dayLabel,
          hour,
          value: existing?.value || 0,
        };
      })
    );

    const favoriteRoute = favoriteRouteRows[0]
      ? {
          label: `${favoriteRouteRows[0]._id.pickup} → ${favoriteRouteRows[0]._id.dropoff}`,
          value: favoriteRouteRows[0].value,
        }
      : null;

    const totalRides = currentSummary?.totalRides || 0;
    const totalRevenue = Math.round(currentSummary?.totalRevenue || 0);
    const completedRides = currentSummary?.completedRides || 0;
    const cancelledRides = currentSummary?.cancelledRides || 0;
    const completionRate = totalRides ? Number(((completedRides / totalRides) * 100).toFixed(1)) : 0;
    const cancellationRate = totalRides ? Number(((cancelledRides / totalRides) * 100).toFixed(1)) : 0;

    const previousTotalRides = previousSummary?.totalRides || 0;
    const previousRevenue = Math.round(previousSummary?.totalRevenue || 0);
    const previousCompletionRate = previousTotalRides
      ? Number((((previousSummary?.completedRides || 0) / previousTotalRides) * 100).toFixed(1))
      : 0;
    const previousCancellationRate = previousTotalRides
      ? Number((((previousSummary?.cancelledRides || 0) / previousTotalRides) * 100).toFixed(1))
      : 0;

    const topEarningDay = revenueTrend.length
      ? revenueTrend.reduce((best, current) => (current.value > best.value ? current : best))
      : null;

    const trendGrowth = {
      ridesGrowth: formatGrowth(totalRides, previousTotalRides),
      revenueGrowth: formatGrowth(totalRevenue, previousRevenue),
      completionGrowth: formatGrowth(completionRate, previousCompletionRate),
      cancellationGrowth: formatGrowth(cancellationRate, previousCancellationRate),
    };

    const favoriteRideType = rideTypes[0]?.label || "N/A";

    const summary = {
      totalRides,
      avgDistance: Number((currentSummary?.avgDistance || 0).toFixed(1)),
      completionRate,
      cancellationRate,
      ongoingRides: currentSummary?.ongoingRides || 0,
      favoriteRideType,
      rideFrequency: Number((totalRides / Math.max(trends.length || 1, 1)).toFixed(1)),
      ridesThisWeek: totalRides,
      revenueThisWeek: totalRevenue,
      avgDistanceThisWeek: Number((currentSummary?.avgDistance || 0).toFixed(1)),
      totalUsers,
      activeDrivers,
      totalSpend: scope === "user" ? totalRevenue : undefined,
      totalEarnings: scope === "driver" ? totalRevenue : undefined,
      activeRides: scope === "driver" ? activeRides : undefined,
      ratingPerformance:
        scope === "driver"
          ? Number((driverProfile?.rating?.average || currentSummary?.avgRating || 0).toFixed(1))
          : undefined,
      topEarningDay: scope === "driver" ? topEarningDay?.label || "N/A" : undefined,
      favoriteRoute: scope === "user" ? favoriteRoute?.label || "N/A" : undefined,
      busiestDays,
    };

    const insights = buildAnalyticsInsights({
      scope,
      summary,
      trendGrowth,
      peakHours,
      rideTypes,
      favoriteRoute,
      topEarningDay,
    });

    return sendSuccess(res, {
      message: "Ride analytics loaded successfully.",
      data: {
        meta: {
          scope,
          range,
          label: config.label,
          refreshedAt: new Date().toISOString(),
        },
        summary,
        growth: trendGrowth,
        trends: ridesTrend,
        revenue: revenueTrend,
        peakHours,
        statusDistribution,
        rideTypes,
        insights,
        heatmap,
        charts: {
          ridesOverTime: ridesTrend,
          revenue: revenueTrend,
          peakHours,
          statusDistribution,
          rideTypes,
          heatmap,
        },
      },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Ride analytics lookup failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to load ride analytics.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
