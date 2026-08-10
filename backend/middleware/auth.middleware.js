const { normalizeRole, verifyAccessToken } = require("../utils/authTokens");
const logger = require("../utils/logger");
const { sendError } = require("../utils/apiResponse");
const { findAccountByIdForRole } = require("../repositories/account.repository");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(res, {
        statusCode: 401,
        message: "Authentication required.",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);
    const decodedRole = normalizeRole(decoded.role);

    const user = await findAccountByIdForRole(decodedRole, decoded._id);

    if (!user) {
      return sendError(res, {
        statusCode: 401,
        message: "Account not found or deleted.",
      });
    }

    if (user.status && user.status !== "active") {
      return sendError(res, {
        statusCode: 401,
        message: "Account suspended or inactive.",
      });
    }

    // Attach user payload
    req.user = {
      _id: user._id,
      email: user.email,
      role: decodedRole || normalizeRole(user.role),
      name: user.name || `${user.fullname?.firstname || ""} ${user.fullname?.lastname || ""}`.trim(),
    };
    
    // Pass raw model instance if explicitly needed by down-stream controllers
    req.userModel = user;

    next();
  } catch (error) {
    logger.warn({ error: error.message, path: req.originalUrl }, "JWT authentication failed");
    return sendError(res, {
      statusCode: 401,
      message: "Invalid or expired token.",
    });
  }
};

const roleMiddleware = (...roles) => {
  const normalizedRoles = roles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user || !normalizedRoles.includes(normalizeRole(req.user.role))) {
      return sendError(res, {
        statusCode: 403,
        message: `Forbidden. Route requires one of: ${normalizedRoles.join(", ")}.`,
      });
    }
    next();
  };
};

exports.requireAuth = authMiddleware;
exports.requireRole = roleMiddleware;
exports.authMiddleware = authMiddleware;
exports.roleMiddleware = roleMiddleware;
