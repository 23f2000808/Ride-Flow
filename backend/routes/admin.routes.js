const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

router.use(requireAuth);
router.use(requireRole("admin"));

router.get("/users", adminController.getAllUsers);
router.get("/drivers", adminController.getAllDrivers);
router.get("/analytics", adminController.getAdminAnalytics);
router.patch("/drivers/:id/status", adminController.updateDriverStatus);
router.patch("/driver/:id/approve", adminController.approveDriver);
router.patch("/accounts/:type/:id/status", adminController.updateAccountStatus);
router.patch("/rides/bulk-status", adminController.bulkUpdateRideStatuses);
router.get("/rides", adminController.getAllRides);
router.delete("/rides/cleanup", adminController.cleanupRides);
router.delete("/accounts/:type/:id", adminController.deleteAccount);

module.exports = router;
