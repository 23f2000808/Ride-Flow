const Redis = require("ioredis");

// Fallback gracefully without throwing hard exceptions if Redis is down locally,
// ensuring system boot survives network errors.
const redisOptions = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  }
};

const redisClient = new Redis(redisOptions);

redisClient.on("error", (err) => {
  console.error("❌ Redis Connection Error:", err.message);
});

redisClient.on("connect", () => {
  console.log("🟢 Connected to Redis Layer");
});

module.exports = redisClient;
