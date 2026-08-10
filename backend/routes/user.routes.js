const express = require("express");
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  deleteUserAccount,
  updateUserPassword,
} = require("../controllers/user.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);

// Protected routes (require JWT)
router.get("/profile", requireAuth, requireRole("user", "driver", "admin"), getUserProfile);
router.patch("/profile", requireAuth, requireRole("user", "driver", "admin"), updateUserProfile);
router.patch("/password", requireAuth, requireRole("user", "driver", "admin"), updateUserPassword);
router.delete("/profile", requireAuth, requireRole("user", "driver", "admin"), deleteUserAccount);


module.exports = router;
