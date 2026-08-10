const logger = require("../utils/logger");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const {
  createDriver,
  findDriverByEmail,
  findDriverById,
  findNearbyDrivers,
  saveDriver,
  updateDriverById,
} = require("../repositories/driver.repository");

// ─── CREATE DRIVER ──────────────────────────────────────
// POST /api/drivers
// Registers a new driver with vehicle info and hashes the password.
exports.createDriver = async (req, res) => {
  try {
    const { fullname, email, password, phone, vehicle } = req.body;

    // ── Validation ──────────────────────────────────────
    if (!fullname?.firstname || !email || !password || !phone || !vehicle) {
      return sendError(res, {
        statusCode: 400,
        message: "Missing required fields: fullname.firstname, email, password, phone, vehicle.",
      });
    }

    if (!vehicle.plate || !vehicle.color || !vehicle.vehicleType || !vehicle.capacity) {
      return sendError(res, {
        statusCode: 400,
        message: "Missing vehicle fields: plate, color, vehicleType, capacity.",
      });
    }

    // ── Check duplicate email ───────────────────────────
    const existingDriver = await findDriverByEmail(email);
    if (existingDriver) {
      return sendError(res, {
        statusCode: 409,
        message: "A driver with this email already exists.",
      });
    }

    // ── Create driver ───────────────────────────────────
    const driver = await createDriver({
      fullname,
      email,
      password,
      phone,
      vehicle,
    });

    // Generate JWT token immediately so driver can start onboarding
    const token = driver.generateAuthToken();

    // Don't return the password in the response
    const driverObj = driver.toObject();
    delete driverObj.password;

    return sendSuccess(res, {
      statusCode: 201,
      message: "Driver registered successfully.",
      data: { driver: driverObj, token },
    });
  } catch (error) {
    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return sendError(res, { statusCode: 400, message: "Validation failed.", errors: messages });
    }

    // Handle duplicate key errors (email, phone)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return sendError(res, {
        statusCode: 409,
        message: `A driver with this ${field} already exists.`,
      });
    }

    logger.error({ err: error, path: req.originalUrl }, "Driver creation failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to create driver.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ─── GET DRIVER BY ID ───────────────────────────────────
// GET /api/drivers/:id
exports.getDriverById = async (req, res) => {
  try {
    const driver = await findDriverById(req.params.id, { select: "-password" });
    if (!driver) {
      return sendError(res, { statusCode: 404, message: "Driver not found." });
    }

    return sendSuccess(res, { message: "Driver loaded successfully.", data: driver });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Loading driver failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to load driver.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ─── FIND NEARBY DRIVERS (GEO QUERY) ───────────────────
// GET /api/drivers/nearby?lng=77.5946&lat=12.9716&radius=5&vehicleType=car
// Uses the 2dsphere index on driver.location for O(log n) spatial lookup.
exports.findNearbyDrivers = async (req, res) => {
  try {
    const { lng, lat, radius, vehicleType } = req.query;

    // ── Validation ──────────────────────────────────────
    if (!lng || !lat) {
      return sendError(res, { statusCode: 400, message: "Query params 'lng' and 'lat' are required." });
    }

    const longitude = parseFloat(lng);
    const latitude = parseFloat(lat);
    const radiusInKm = parseFloat(radius) || 5; // default 5km

    if (isNaN(longitude) || isNaN(latitude)) {
      return sendError(res, { statusCode: 400, message: "'lng' and 'lat' must be valid numbers." });
    }

    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      return sendError(res, {
        statusCode: 400,
        message: "Coordinates out of range. lng: [-180,180], lat: [-90,90].",
      });
    }

    // ── Execute geo query using the model's static method ─
    const drivers = await findNearbyDrivers(
      longitude,
      latitude,
      radiusInKm,
      vehicleType || null
    );

    return sendSuccess(res, {
      message: `Found ${drivers.length} drivers within ${radiusInKm}km.`,
      data: {
        count: drivers.length,
        radiusKm: radiusInKm,
        center: { lng: longitude, lat: latitude },
        drivers,
      },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Nearby driver lookup failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to fetch nearby drivers.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ─── UPDATE DRIVER LOCATION ─────────────────────────────
// PATCH /api/drivers/:id/location
// Called by the driver app every few seconds to update GPS position.
exports.updateLocation = async (req, res) => {
  try {
    const { lng, lat } = req.body;

    if (lng === undefined || lat === undefined) {
      return sendError(res, { statusCode: 400, message: "'lng' and 'lat' are required in request body." });
    }

    const driver = await updateDriverById(
      req.params.id,
      {
        $set: {
          location: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
        },
      },
      { new: true, runValidators: true },
      { select: "-password" },
    );

    if (!driver) {
      return sendError(res, { statusCode: 404, message: "Driver not found." });
    }

    return sendSuccess(res, {
      message: "Location updated successfully.",
      data: { location: driver.location },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Driver location update failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to update driver location.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ─── TOGGLE AVAILABILITY ────────────────────────────────
// PATCH /api/drivers/:id/availability
exports.toggleAvailability = async (req, res) => {
  try {
    const driver = await findDriverById(req.params.id, { select: "-password" });
    if (!driver) {
      return sendError(res, { statusCode: 404, message: "Driver not found." });
    }

    driver.isOnline = !driver.isOnline;
    await saveDriver(driver);

    return sendSuccess(res, {
      message: `Driver is now ${driver.isOnline ? "online" : "offline"}.`,
      data: { isOnline: driver.isOnline },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Driver availability toggle failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to update driver availability.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.updateDriverStatus = async (req, res) => {
  try {
    const driverId = req.body.driverId || req.user?._id;
    const requestedOnline = req.body.isOnline;

    const driver = await findDriverById(driverId, { select: "-password" });
    if (!driver) {
      return sendError(res, { statusCode: 404, message: "Driver not found." });
    }

    driver.isOnline = typeof requestedOnline === "boolean" ? requestedOnline : !driver.isOnline;
    driver.lastHeartbeat = new Date();
    await saveDriver(driver);

    try {
      const { getIO } = require("../config/socket");
      const io = getIO();
      if (driver.isOnline) {
        io.to(`driver_${driver._id}`).emit("driver:status", { driverId: driver._id, isOnline: true });
      }
    } catch (error) {
      logger.warn({ err: error }, "Driver status socket update skipped");
    }

    return sendSuccess(res, {
      message: `Driver is now ${driver.isOnline ? "online" : "offline"}.`,
      data: { isOnline: driver.isOnline },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Driver status update failed");
    return sendError(res, { statusCode: 500, message: "Unable to update driver status." });
  }
};
