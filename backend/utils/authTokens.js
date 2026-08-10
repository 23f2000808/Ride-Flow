const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
const REMEMBER_ME_REFRESH_TTL = process.env.JWT_REFRESH_REMEMBER_EXPIRES_IN || "30d";

const getAccessSecret = () => process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

const normalizeRole = (role) => {
  if (role === "user") return "customer";
  return role;
};

const signAccessToken = ({ _id, role }) =>
  jwt.sign(
    { _id, role: normalizeRole(role), type: "access" },
    getAccessSecret(),
    { expiresIn: ACCESS_TOKEN_TTL }
  );

const signRefreshToken = ({ _id, role, remember = false }) =>
  jwt.sign(
    { _id, role: normalizeRole(role), type: "refresh" },
    getRefreshSecret(),
    { expiresIn: remember ? REMEMBER_ME_REFRESH_TTL : REFRESH_TOKEN_TTL }
  );

const verifyAccessToken = (token) => jwt.verify(token, getAccessSecret());
const verifyRefreshToken = (token) => jwt.verify(token, getRefreshSecret());

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const decodeToken = (token) => jwt.decode(token);

const getRefreshCookieOptions = (remember = false) => {
  const isProduction = process.env.NODE_ENV === "production";
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/api/auth",
  };

  if (remember) {
    options.maxAge = 30 * 24 * 60 * 60 * 1000;
  }

  return options;
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  decodeToken,
  getRefreshCookieOptions,
  normalizeRole,
};
