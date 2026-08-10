const express = require("express");
const router = express.Router();
const driverController = require("../controllers/driver.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

router.post("/", driverController.createDriver);
router.get("/nearby", requireAuth, requireRole("user", "admin"), driverController.findNearbyDrivers);
router.get("/:id", requireAuth, driverController.getDriverById);
router.patch("/status", requireAuth, requireRole("driver", "admin"), driverController.updateDriverStatus);
router.patch("/:id/location", requireAuth, requireRole("driver", "admin"), driverController.updateLocation);
router.patch("/:id/availability", requireAuth, requireRole("driver", "admin"), driverController.toggleAvailability);

module.exports = router;
