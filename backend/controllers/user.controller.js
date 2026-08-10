const logger = require("../utils/logger");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const {
  createUser,
  deleteAccountByIdForRole,
  findAccountByFilterForRole,
  findAccountByIdForRole,
  findUserByEmail,
  saveAccount,
  updateOneAccountForRole,
} = require("../repositories/account.repository");
const { aggregateRides } = require("../repositories/ride.repository");

const serializeProfile = (account, stats = {}) => ({
  _id: account._id,
  fullname: account.fullname || {
    firstname: account.name?.split(" ").filter(Boolean)[0] || "",
    lastname: account.name?.split(" ").filter(Boolean).slice(1).join(" "),
  },
  name: account.name || `${account.fullname?.firstname || ""} ${account.fullname?.lastname || ""}`.trim(),
  email: account.email,
  phone: account.phone || "",
  role: account.role === "user" ? "customer" : account.role,
  avatar: account.avatar,
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
  status: account.status,
  earnings: account.earnings || null,
  stats,
});

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
exports.registerUser = async (req, res) => {
  try {
    const { fullname, email, password } = req.body;

    if (!fullname || !fullname.firstname || !email || !password) {
      return sendError(res, { statusCode: 400, message: "Please provide all required fields." });
    }

    const userExists = await findUserByEmail(email);
    if (userExists) {
      return sendError(res, { statusCode: 409, message: "User already exists with this email." });
    }

    const user = await createUser({
      fullname,
      email,
      password,
    });

    const token = user.generateAuthToken();

    return sendSuccess(res, {
      statusCode: 201,
      message: "User registered successfully.",
      data: {
        token,
        user: {
          _id: user._id,
          fullname: user.fullname,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "User registration failed");
    return sendError(res, { statusCode: 500, message: "Unable to register user." });
  }
};

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, { statusCode: 400, message: "Please provide email and password." });
    }

    const user = await findUserByEmail(email, { includePassword: true });

    if (!user) {
      return sendError(res, { statusCode: 401, message: "Invalid email or password." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, { statusCode: 401, message: "Invalid email or password." });
    }

    const token = user.generateAuthToken();

    return sendSuccess(res, {
      statusCode: 200,
      message: "User login successful.",
      data: {
        token,
        user: {
          _id: user._id,
          fullname: user.fullname,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "User login failed");
    return sendError(res, { statusCode: 500, message: "Unable to login user." });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const account = await findAccountByIdForRole(req.user.role, req.user._id);

    if (!account) {
      return sendError(res, { statusCode: 404, message: "User not found." });
    }

    const rideMatch = req.user.role === "driver"
      ? { driver: account._id }
      : { user: account._id };

    const [rideStats] = await aggregateRides([
      { $match: rideMatch },
      {
        $group: {
          _id: null,
          totalRides: { $sum: 1 },
          completedRides: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          cancelledRides: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
          activeRides: {
            $sum: { $cond: [{ $in: ["$status", ["requested", "accepted", "arriving", "in_progress"]] }, 1, 0] },
          },
          totalDistance: { $sum: { $ifNull: ["$distance", 0] } },
          totalRevenue: {
            $sum: {
              $ifNull: ["$fare.actualFare", "$fare.estimatedFare"],
            },
          },
        },
      },
    ]);

    const stats = {
      totalRides: rideStats?.totalRides || 0,
      completedRides: rideStats?.completedRides || 0,
      cancelledRides: rideStats?.cancelledRides || 0,
      activeRides: rideStats?.activeRides || 0,
      averageDistance: rideStats?.totalRides
        ? Number(((rideStats.totalDistance || 0) / rideStats.totalRides).toFixed(1))
        : 0,
      revenue: Math.round(rideStats?.totalRevenue || 0),
    };

    return sendSuccess(res, {
      message: "User profile loaded successfully.",
      data: serializeProfile(account, stats),
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Loading user profile failed");
    return sendError(res, { statusCode: 500, message: "Unable to load user profile." });
  }
};

exports.updateUserProfile = async (req, res) => {
  try {
    const { fullname, phone, avatar } = req.body;
    const updates = {};

    if (req.user.role === "admin" && fullname) {
      updates.name = [fullname.firstname, fullname.lastname].filter(Boolean).join(" ").trim();
    } else if (fullname) {
      if (fullname.firstname !== undefined) updates["fullname.firstname"] = fullname.firstname;
      if (fullname.lastname !== undefined) updates["fullname.lastname"] = fullname.lastname;
    }
    if (phone !== undefined && req.user.role !== "admin") updates.phone = phone || null;
    if (avatar !== undefined) updates.avatar = avatar || null;

    const updateResult = await updateOneAccountForRole(
      req.user.role,
      { _id: req.user._id },
      { $set: updates },
      { runValidators: true }
    );

    if (!updateResult.matchedCount) {
      return sendError(res, { statusCode: 404, message: "User not found." });
    }

    const account = await findAccountByIdForRole(req.user.role, req.user._id);

    return sendSuccess(res, {
      message: "User profile updated successfully.",
      data: serializeProfile(account),
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Updating user profile failed");
    return sendError(res, { statusCode: 500, message: "Unable to update user profile." });
  }
};

exports.deleteUserAccount = async (req, res) => {
  try {
    const deletion = await deleteAccountByIdForRole(req.user.role, req.user._id);

    if (!deletion.deletedCount) {
      return sendError(res, { statusCode: 404, message: "User not found." });
    }

    return sendSuccess(res, {
      message: "Account deleted successfully.",
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Deleting account failed");
    return sendError(res, { statusCode: 500, message: "Unable to delete account." });
  }
};

exports.updateUserPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendError(res, {
        statusCode: 400,
        message: "Current password and new password are required.",
      });
    }

    if (newPassword.length < 8) {
      return sendError(res, {
        statusCode: 400,
        message: "New password must be at least 8 characters long.",
      });
    }

    if (newPassword === currentPassword) {
      return sendError(res, {
        statusCode: 400,
        message: "New password must be different from the current password.",
      });
    }

    const user = await findAccountByIdForRole(req.user.role, req.user._id, { select: "+password" });
    if (!user) {
      return sendError(res, { statusCode: 404, message: "User not found." });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return sendError(res, {
        statusCode: 400,
        message: "Current password is incorrect.",
      });
    }

    user.password = newPassword;
    await saveAccount(user);

    return sendSuccess(res, {
      message: "Password updated successfully.",
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Updating user password failed");
    return sendError(res, { statusCode: 500, message: "Unable to update password." });
  }
};
