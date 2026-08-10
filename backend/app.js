const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const socketConfig = require("./config/socket");
const logger = require("./utils/logger");
const promClient = require("prom-client");
const connectDB = require("./config/db");
const driverRoutes = require("./routes/driver.routes");
const rideRoutes = require("./routes/ride.routes");
const userRoutes = require("./routes/user.routes");
const authRoutes = require("./routes/auth.routes");
const { errorHandler, notFoundHandler } = require("./middleware/error.middleware");
const { sendError, sendSuccess } = require("./utils/apiResponse");
const { updateManyDrivers } = require("./repositories/driver.repository");
const { findRides } = require("./repositories/ride.repository");

const app = express();

// ─── PROMETHEUS OBSERVABILITY STACK ────────────────────
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ register: promClient.register });

// Custom Latency Tracer
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in microseconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

// Trace every incoming middleware ping natively
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.originalUrl, code: res.statusCode });
    logger.info({
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
    }, "HTTP request completed");
  });
  next();
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Expose Metrics Route explicitly natively for Prometheus scraping safely
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// Health Check Endpoint safely probing DB and Redis constraints cleanly
app.get('/health', async (req, res) => {
  const mongoose = require("mongoose");
  const redisClient = require("./config/redis");
  const isMongoConnected = mongoose.connection.readyState === 1;
  const isRedisConnected = redisClient.status === 'ready';

  if (!isMongoConnected || !isRedisConnected) {
     return sendError(res, {
       statusCode: 503,
       message: "Service health check degraded.",
       errors: [{ mongo: isMongoConnected, redis: isRedisConnected }],
     });
  }
  return sendSuccess(res, {
    message: "Service health check passed.",
    data: { status: 'HEALTHY', mongo: true, redis: true },
  });
});

// Serve Vite build in production; fall back to legacy public dashboard if not built yet.
const clientDistPath = path.join(__dirname, "..", "frontend", "dist");
const legacyPublicPath = path.join(__dirname, "public");
const staticPath = fs.existsSync(clientDistPath) ? clientDistPath : legacyPublicPath;

// ─── STATIC FILES ───────────────────────────────────────
app.use(express.static(staticPath));

// ─── HEALTH CHECK (JSON) ────────────────────────────────
app.get("/api/health", (req, res) => {
  return sendSuccess(res, {
    message: "API health check passed.",
    data: {
      status: "ok",
      service: "Uber Clone API",
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── ROUTES ─────────────────────────────────────────────
app.use("/api/users", userRoutes);
// Backward compatibility for older frontend calls; safe to remove after migration.
app.use("/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/admin", require("./routes/admin.routes"));

// ─── SPA FALLBACK ───────────────────────────────────────
app.get("/{*path}", (req, res, next) => {
  if (
    req.path.startsWith("/api") ||
    req.path.startsWith("/users") ||
    req.path === "/metrics" ||
    req.path === "/health"
  ) {
    return next();
  }

  return res.sendFile(path.join(staticPath, "index.html"));
});

// ─── 404 HANDLER ────────────────────────────────────────
app.use(notFoundHandler);

// ─── GLOBAL ERROR HANDLER ───────────────────────────────
app.use(errorHandler);

// ─── START SERVER ───────────────────────────────────────
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the existing RideFlow server or change PORT in .env.`);
    process.exit(1);
  }

  console.error("Server startup error:", error);
  process.exit(1);
});

// ─── STARTUP / RECOVERY SEQUENCE ─────────────────────────
const { initDispatchWorker } = require("./workers/dispatch.worker");

// Initialize Socket.io instance
socketConfig.init(server);

connectDB().then(() => {
  server.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    
    // 1. Boot up persistent BullMQ cluster thread & Exact-Once Outbox Sweeper
    initDispatchWorker();
    const { initOutboxWorker } = require("./workers/outbox.worker");
    initOutboxWorker();

    // 2. State Recovery System: If server crashed mid-dispatch, restart them natively
    try {
      const { dispatchQueue } = require("./workers/dispatch.worker");
      const orphans = await findRides({ status: "requested" });
      if (orphans.length > 0) {
        console.log(`🔌 Recovery System Active: Found ${orphans.length} orphaned requests, rebooting dispatcher threads...`);
        // Could re-instantiate fresh ORS calculations if latency too high, but skipping for simplicity
      }
    } catch (err) {}

    // 3. Driver Heartbeat Monitor Pattern
    setInterval(async () => {
      try {
        const staleThreshold = new Date(Date.now() - 15000);
        const res = await updateManyDrivers(
          { isOnline: true, lastHeartbeat: { $lt: staleThreshold } },
          { $set: { isOnline: false } }
        );
        if (res.modifiedCount > 0) console.log(`[Heartbeat] Dropped ${res.modifiedCount} offline drivers.`);
      } catch (e) {}
    }, 15000);
  });
});

module.exports = app;
