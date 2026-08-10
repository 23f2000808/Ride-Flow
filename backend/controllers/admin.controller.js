const logger = require("../utils/logger");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const {
  countUsers,
  deleteAccountByType,
  findUsersForAdmin,
  updateAccountByIdForRole,
} = require("../repositories/account.repository");
const {
  countDrivers,
  findDriversForAdmin,
  updateDriverById,
} = require("../repositories/driver.repository");
const {
  aggregateRides,
  deleteManyRides,
  findRides,
  updateManyRides,
} = require("../repositories/ride.repository");

const accountModelMap = {
  user: "user",
  customer: "user",
  driver: "driver",
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await findUsersForAdmin();
    return sendSuccess(res, {
      message: "Users loaded successfully.",
      data: users,
      meta: { count: users.length },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Admin failed to load users");
    return sendError(res, { statusCode: 500, message: "Unable to load users." });
  }
};

// @desc    Get all drivers
// @route   GET /api/admin/drivers
// @access  Private (Admin)
exports.getAllDrivers = async (req, res) => {
  try {
    const drivers = await findDriversForAdmin();
    return sendSuccess(res, {
      message: "Drivers loaded successfully.",
      data: drivers,
      meta: { count: drivers.length },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Admin failed to load drivers");
    return sendError(res, { statusCode: 500, message: "Unable to load drivers." });
  }
};

// @desc    Approve or Reject a driver
// @route   PATCH /api/admin/drivers/:id/status
// @access  Private (Admin)
exports.updateDriverStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!["approved", "rejected", "pending", "under_review"].includes(status)) {
      return sendError(res, { statusCode: 400, message: "Invalid verification status configuration." });
    }

    const driver = await updateDriverById(
      req.params.id,
      { $set: { verificationStatus: status } },
      { new: true, runValidators: true },
      { select: "-password" },
    );

    if (!driver) {
      return sendError(res, { statusCode: 404, message: "Driver not found." });
    }

    return sendSuccess(res, {
      message: `Driver verification set to ${status}.`,
      data: driver,
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Admin failed to update driver status");
    return sendError(res, { statusCode: 500, message: "Unable to update driver status." });
  }
};

exports.approveDriver = async (req, res) => {
  req.body.status = req.body.status || "approved";
  return exports.updateDriverStatus(req, res);
};

// @desc    Block/unblock a user or driver account
// @route   PATCH /api/admin/accounts/:type/:id/status
// @access  Private (Admin)
exports.updateAccountStatus = async (req, res) => {
  try {
    const { type, id } = req.params;
    const { status } = req.body;

    if (!["active", "inactive", "suspended"].includes(status)) {
      return sendError(res, {
        statusCode: 400,
        message: "Invalid account status. Use active, inactive, or suspended.",
      });
    }

    const normalizedType = type === "customer" ? "user" : type;
    const targetRole = accountModelMap[normalizedType];

    if (!targetRole) {
      return sendError(res, {
        statusCode: 400,
        message: "Invalid account type parameter. Use 'user', 'customer', or 'driver'.",
      });
    }

    const updates = {
      status,
      ...(normalizedType === "driver" && status !== "active" ? { isOnline: false } : {}),
    };

    const account = await updateAccountByIdForRole(
      targetRole,
      id,
      { $set: updates },
      { new: true, runValidators: true },
      { select: "-password" },
    );

    if (!account) {
      return sendError(res, { statusCode: 404, message: "Account not found." });
    }

    const label = normalizedType === "driver" ? "Driver" : "Customer";
    const verb = status === "suspended" ? "blocked" : status === "active" ? "reactivated" : "updated";

    return sendSuccess(res, {
      message: `${label} account ${verb} successfully.`,
      data: account,
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Admin failed to update account status");
    return sendError(res, { statusCode: 500, message: "Unable to update account status." });
  }
};

// @desc    Get all rides
// @route   GET /api/admin/rides
// @access  Private (Admin)
exports.getAllRides = async (req, res) => {
  try {
    const rides = await findRides(
      {},
      {
        populate: [
          { path: "user", select: "fullname email phone" },
          { path: "driver", select: "fullname vehicle email phone" },
        ],
        sort: { createdAt: -1 },
      },
    );
    
    return sendSuccess(res, {
      message: "Rides loaded successfully.",
      data: rides,
      meta: { count: rides.length },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Admin failed to load rides");
    return sendError(res, { statusCode: 500, message: "Unable to load rides." });
  }
};

exports.getAdminAnalytics = async (req, res) => {
  try {
    const [overview] = await aggregateRides([
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
          revenue: { $sum: { $ifNull: ["$fare.actualFare", "$fare.estimatedFare"] } },
        },
      },
    ]);

    const [usersCount, driversCount, activeDrivers] = await Promise.all([
      countUsers({ role: "user", status: { $ne: "deleted" } }),
      countDrivers({ status: { $ne: "deleted" } }),
      countDrivers({ isOnline: true, status: "active" }),
    ]);

    return sendSuccess(res, {
      message: "Admin analytics loaded successfully.",
      data: {
        totalUsers: usersCount,
        totalDrivers: driversCount,
        activeDrivers,
        totalRides: overview?.totalRides || 0,
        completedRides: overview?.completedRides || 0,
        cancelledRides: overview?.cancelledRides || 0,
        revenue: Math.round(overview?.revenue || 0),
      },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Admin analytics lookup failed");
    return sendError(res, { statusCode: 500, message: "Unable to load admin analytics." });
  }
};

exports.bulkUpdateRideStatuses = async (req, res) => {
  try {
    const { rideIds = [], status, cancellationReason } = req.body;

    if (!Array.isArray(rideIds) || !rideIds.length || !status) {
      return sendError(res, {
        statusCode: 400,
        message: "rideIds[] and status are required for bulk updates.",
      });
    }

    const updatePayload = {
      status,
      ...(status === "cancelled"
        ? {
            cancellation: {
              cancelledBy: "system",
              reason: cancellationReason || "Cancelled by admin bulk action",
              cancelledAt: new Date(),
            },
          }
        : {}),
    };

    const result = await updateManyRides(
      { _id: { $in: rideIds } },
      { $set: updatePayload }
    );

    return sendSuccess(res, {
      message: "Ride statuses updated successfully.",
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Bulk ride status update failed");
    return sendError(res, { statusCode: 500, message: "Unable to bulk update ride statuses." });
  }
};

exports.cleanupRides = async (req, res) => {
  try {
    const beforeDate = req.body.beforeDate ? new Date(req.body.beforeDate) : null;
    const statuses = req.body.statuses?.length ? req.body.statuses : ["cancelled"];

    const query = {
      status: { $in: statuses },
    };

    if (beforeDate) {
      query.createdAt = { $lt: beforeDate };
    }

    const deletion = await deleteManyRides(query);

    return sendSuccess(res, {
      message: "Ride cleanup completed successfully.",
      data: {
        deletedCount: deletion.deletedCount,
      },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Ride cleanup failed");
    return sendError(res, { statusCode: 500, message: "Unable to cleanup rides." });
  }
};

// @desc    Delete a user or driver
// @route   DELETE /api/admin/accounts/:type/:id
// @access  Private (Admin)
exports.deleteAccount = async (req, res) => {
  try {
    const { type, id } = req.params;
    
    if (!["user", "driver"].includes(type)) {
      return sendError(res, {
        statusCode: 400,
        message: "Invalid account type parameter. Use 'user' or 'driver'.",
      });
    }

    const deletedAccount = await deleteAccountByType(type, id);

    if (!deletedAccount) {
      return sendError(res, { statusCode: 404, message: "Account not found for deletion." });
    }

    return sendSuccess(res, {
      message: `${type.toUpperCase()} account successfully deleted.`,
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Admin failed to delete account");
    return sendError(res, { statusCode: 500, message: "Unable to delete account." });
  }
};
