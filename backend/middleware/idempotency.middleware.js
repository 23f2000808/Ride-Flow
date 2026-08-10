const redisClient = require('../config/redis');
const logger = require('../utils/logger');
const { sendError } = require('../utils/apiResponse');

/**
 * Ensures a specific request (identified by an idempotency key) is executed exactly once natively.
 * Redis SET NX EX logic creates a temporary lock map mitigating duplicate transit requests natively.
 */
const requireIdempotency = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    return sendError(res, {
      statusCode: 400,
      message: "Missing 'Idempotency-Key' header.",
    });
  }

  const cacheKey = `idempotency:${idempotencyKey}`;

  try {
    // Attempt to Set only if Not eXists (NX) actively enforcing 24 hour TTL bounds natively resolving duplication
    const setNX = await redisClient.set(cacheKey, 'PENDING', 'NX', 'EX', 86400);

    if (!setNX) {
      // Key natively exists already. Checking resolving status natively.
      const status = await redisClient.get(cacheKey);
      
      if (status === 'PENDING') {
         return sendError(res, {
           statusCode: 409,
           message: "A matching request is already in progress.",
         });
      }

      // If finished, safely return the explicitly bound response payloads natively parsing JSON.
      try {
        const cachedResponse = JSON.parse(status);
        return res.status(200).json(cachedResponse);
      } catch(e) {
        return sendError(res, {
          statusCode: 409,
          message: "This request was already processed.",
        });
      }
    }

    // Intercept native explicitly parsing response json safely resolving lock natively upon execution completion.
    const originalJson = res.json;
    res.json = function(body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redisClient.set(cacheKey, JSON.stringify(body), 'EX', 86400).catch(err => logger.error("Idempotency Redis set failed:", err));
      } else {
        // Drop lock cleanly natively if exactly-once transaction naturally failed early.
        redisClient.del(cacheKey);
      }
      return originalJson.call(this, body);
    };

    next();
  } catch (err) {
    logger.error("Idempotency Middleware Error natively evaluated: ", err);
    next(); // Fallback natively passively natively bypassing locks if Redis natively resets passively.
  }
};

module.exports = { requireIdempotency };
