const {
  decodeToken,
  getRefreshCookieOptions,
  hashToken,
  normalizeRole,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("../utils/authTokens");
const logger = require("../utils/logger");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const {
  createAdminAccount,
  createCustomerAccount,
  createDriverAccount,
  createRefreshToken,
  findActiveRefreshTokenByHash,
  findAuthAccountByEmail,
  findAuthAccountById,
  findExistingAccountIdsByEmail,
  findExistingAccountIdsByPhone,
  isSupportedAuthRole,
  revokeRefreshTokenByHash,
} = require("../repositories/auth.repository");

const driverCapacityMap = {
  motorcycle: 1,
  auto: 3,
  car: 4,
  van: 6,
};

const splitName = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return {
    firstname: parts[0] || "",
    lastname: parts.slice(1).join(" "),
  };
};

const titleCase = (value = "") =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

const ensureUniqueAccount = async ({ email, phone, role }) => {
  const emailChecks = await findExistingAccountIdsByEmail(email);

  if (emailChecks.some(Boolean)) {
    return "An account with this email already exists.";
  }

  if (!phone) return null;

  const phoneChecks = await findExistingAccountIdsByPhone(phone, role);

  if (phoneChecks.some(Boolean)) {
    return "An account with this phone number already exists.";
  }

  return null;
};

const createUserForRole = async ({ name, email, password, role, phone, vehicleType, licenseNumber }) => {
  if (role === "customer") {
    const fullname = splitName(name);

    return createCustomerAccount({
      fullname,
      email,
      password,
      phone,
      role: "user",
    });
  }

  if (role === "driver") {
    const fullname = splitName(name);
    const normalizedVehicleType = vehicleType?.toLowerCase();
    const suffix = Date.now().toString().slice(-6);

    return createDriverAccount({
      fullname,
      email,
      password,
      phone,
      vehicle: {
        plate: `RF-${suffix}`,
        color: "Black",
        vehicleType: normalizedVehicleType,
        model: `${titleCase(normalizedVehicleType)} - Pending profile`,
        capacity: driverCapacityMap[normalizedVehicleType] || 4,
      },
      documents: {
        drivingLicense: {
          number: licenseNumber,
          verified: false,
        },
      },
      verificationStatus: "pending",
      isOnline: false,
      status: "active",
    });
  }

  return createAdminAccount({
    name,
    email,
    password,
    role: "admin",
    status: "active",
  });
};

const serializeUser = (user, role) => {
  if (role === "admin") {
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role,
    };
  }

  const first = user.fullname?.firstname || "";
  const last = user.fullname?.lastname || "";

  return {
    id: user._id,
    name: `${first} ${last}`.trim(),
    email: user.email,
    role,
  };
};

const refreshCookieName = "rideflow_refresh_token";

const issueTokens = async (user, role, remember = false) => {
  const normalizedRole = normalizeRole(role);
  const accessToken = signAccessToken({ _id: user._id, role: normalizedRole });
  const refreshToken = signRefreshToken({ _id: user._id, role: normalizedRole, remember });
  const decodedRefresh = decodeToken(refreshToken);

  await createRefreshToken({
    userId: user._id,
    role: normalizedRole,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(decodedRefresh.exp * 1000),
    remember,
  });

  return { accessToken, refreshToken };
};

const revokeRefreshToken = async (token) => {
  if (!token) return;

  await revokeRefreshTokenByHash(hashToken(token));
};

const getUserForRole = async (role, userId) => {
  return findAuthAccountById(normalizeRole(role), userId);
};

exports.login = async (req, res) => {
  try {
    if (process.env.NODE_ENV !== "production") {
      console.log("[auth] POST /api/auth/login", {
        email: req.body?.email,
        role: req.body?.role,
      });
    }

    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const role = normalizeRole(req.body.role);
    const remember = Boolean(req.body.remember);

    if (!email || !password || !role) {
      return sendError(res, {
        statusCode: 400,
        message: "Email, password, and role are required.",
      });
    }

    if (!isSupportedAuthRole(role)) {
      return sendError(res, {
        statusCode: 400,
        message: "Invalid role supplied.",
      });
    }

    const user = await findAuthAccountByEmail(role, email, { includePassword: true });

    if (!user) {
      return sendError(res, {
        statusCode: 401,
        message: "Invalid credentials.",
      });
    }

    if (user.status && user.status !== "active") {
      return sendError(res, {
        statusCode: 403,
        message: "This account is not active.",
      });
    }

    const passwordMatches = await user.comparePassword(password);

    if (!passwordMatches) {
      return sendError(res, {
        statusCode: 401,
        message: "Invalid credentials.",
      });
    }

    const { accessToken, refreshToken } = await issueTokens(user, role, remember);
    res.cookie(refreshCookieName, refreshToken, getRefreshCookieOptions(remember));

    return sendSuccess(res, {
      statusCode: 200,
      message: "Login successful.",
      data: {
        accessToken,
        user: serializeUser(user, role),
      },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Login failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to complete login.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.signup = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const phone = req.body.phone?.trim();
    const role = normalizeRole(req.body.role);
    const remember = Boolean(req.body.remember ?? true);
    const extraFields = req.body.extraFields || {};

    if (!name || !email || !password || !role) {
      return sendError(res, {
        statusCode: 400,
        message: "Name, email, password, and role are required.",
      });
    }

    if (!isSupportedAuthRole(role)) {
      return sendError(res, {
        statusCode: 400,
        message: "Invalid role supplied.",
      });
    }

    if (password.length < 8) {
      return sendError(res, {
        statusCode: 400,
        message: "Password must be at least 8 characters long.",
      });
    }

    if (role !== "admin" && !phone) {
      return sendError(res, {
        statusCode: 400,
        message: "Phone number is required for this role.",
      });
    }

    if (role === "driver") {
      if (!extraFields.vehicleType || !driverCapacityMap[extraFields.vehicleType?.toLowerCase()]) {
        return sendError(res, {
          statusCode: 400,
          message: "A valid vehicle type is required for drivers.",
        });
      }

      if (!extraFields.licenseNumber?.trim()) {
        return sendError(res, {
          statusCode: 400,
          message: "License number is required for drivers.",
        });
      }
    }

    if (role === "admin") {
      const submittedCode = req.body.adminCode?.trim();
      const expectedCode = process.env.ADMIN_SIGNUP_CODE || "RIDEFLOW-ADMIN-2026";

      if (!submittedCode || submittedCode !== expectedCode) {
        return sendError(res, {
          statusCode: 403,
          message: "Invalid admin signup code.",
        });
      }
    }

    const uniquenessError = await ensureUniqueAccount({ email, phone, role });
    if (uniquenessError) {
      return sendError(res, {
        statusCode: 409,
        message: uniquenessError,
      });
    }

    const user = await createUserForRole({
      name,
      email,
      password,
      role,
      phone,
      vehicleType: extraFields.vehicleType,
      licenseNumber: extraFields.licenseNumber?.trim(),
    });

    const { accessToken, refreshToken } = await issueTokens(user, role, remember);
    res.cookie(refreshCookieName, refreshToken, getRefreshCookieOptions(remember));

    return sendSuccess(res, {
      statusCode: 201,
      message: "Signup successful.",
      data: {
        accessToken,
        user: serializeUser(user, role),
      },
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Signup failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to complete signup.",
      errors: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[refreshCookieName];

    if (!refreshToken) {
      return sendError(res, {
        statusCode: 401,
        message: "Refresh token is required.",
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (decoded.type !== "refresh") {
      return sendError(res, {
        statusCode: 401,
        message: "Invalid refresh token.",
      });
    }

    const storedToken = await findActiveRefreshTokenByHash(hashToken(refreshToken));

    if (!storedToken || storedToken.expiresAt <= new Date()) {
      return sendError(res, {
        statusCode: 401,
        message: "Refresh token expired or revoked.",
      });
    }

    const user = await getUserForRole(decoded.role, decoded._id);
    if (!user || (user.status && user.status !== "active")) {
      return sendError(res, {
        statusCode: 401,
        message: "Account not found or inactive.",
      });
    }

    const remember = storedToken.remember;

    await revokeRefreshToken(refreshToken);

    const { accessToken, refreshToken: rotatedRefreshToken } = await issueTokens(user, decoded.role, remember);
    res.cookie(refreshCookieName, rotatedRefreshToken, getRefreshCookieOptions(remember));

    return sendSuccess(res, {
      statusCode: 200,
      message: "Session refreshed successfully.",
      data: {
        accessToken,
        user: serializeUser(user, normalizeRole(decoded.role)),
      },
    });
  } catch (error) {
    res.clearCookie(refreshCookieName, getRefreshCookieOptions());
    logger.warn({ err: error, path: req.originalUrl }, "Refresh token flow failed");
    return sendError(res, {
      statusCode: 401,
      message: "Unable to refresh session.",
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[refreshCookieName];
    await revokeRefreshToken(refreshToken);
    res.clearCookie(refreshCookieName, getRefreshCookieOptions());

    return sendSuccess(res, {
      statusCode: 200,
      message: "Logged out successfully.",
    });
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, "Logout failed");
    return sendError(res, {
      statusCode: 500,
      message: "Unable to logout cleanly.",
    });
  }
};
