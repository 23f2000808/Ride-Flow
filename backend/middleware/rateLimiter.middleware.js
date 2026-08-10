const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').RedisStore;
const redisClient = require('../config/redis');

const userRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
  windowMs: 60 * 1000, 
  max: 5, // Limit User to 5 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many ride requests explicitly detected. Please natively wait 60 seconds." },
});

const driverRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
  windowMs: 60 * 1000, 
  max: 30, // Limit Driver acceptance spam to 30 actions per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Action limit exceeded natively. Wait slightly before trying again." },
});

module.exports = { userRateLimiter, driverRateLimiter };
