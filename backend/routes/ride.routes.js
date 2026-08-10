const express = require("express");
const router = express.Router();
const rideController = require("../controllers/ride.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const { requireIdempotency } = require("../middleware/idempotency.middleware");
const { userRateLimiter, driverRateLimiter } = require("../middleware/rateLimiter.middleware");

router.post("/", requireAuth, requireRole("user", "admin"), userRateLimiter, requireIdempotency, rideController.createRide);
router.post("/book", requireAuth, requireRole("customer", "admin"), rideController.bookRide);
router.post("/calculate-fare", requireAuth, requireRole("customer", "admin"), rideController.calculateFarePreview);

router.get("/analytics", requireAuth, rideController.getRideAnalyticsOverview);
router.get("/analytics/overview", requireAuth, rideController.getRideAnalyticsOverview);
router.get("/user/:userId", requireAuth, rideController.getUserRides);
router.get("/driver/:driverId", requireAuth, requireRole("driver", "admin"), rideController.getDriverRides);
router.get("/:id", requireAuth, rideController.getRideById);
router.delete("/:id", requireAuth, requireRole("customer", "admin"), rideController.deleteRide);

router.patch("/:rideId/accept", requireAuth, requireRole("driver", "admin"), rideController.acceptRide);
router.patch("/:rideId/reject", requireAuth, requireRole("driver", "admin"), rideController.rejectRide);
router.patch("/:rideId/start", requireAuth, requireRole("driver", "admin"), rideController.startRide);
router.patch("/:rideId/complete", requireAuth, requireRole("driver", "admin"), rideController.completeRide);

router.patch("/:id/status", requireAuth, requireRole("driver", "admin"), driverRateLimiter, requireIdempotency, rideController.updateRideStatus);
router.patch("/:id/rate", requireAuth, requireRole("user", "admin"), rideController.rateRide);
router.patch("/:id", requireAuth, rideController.updateRide);

module.exports = router;
