const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const redisClient = require("./redis");
const { normalizeRole, verifyAccessToken } = require("../utils/authTokens");
const { findDriverById, updateDriverById } = require("../repositories/driver.repository");
const { findRideById } = require("../repositories/ride.repository");

let io;

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH']
      }
    });

    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));

    // ─── AUTHENTICATION MIDDLEWARE ───────────────────────
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error("Authentication error: No token provided"));
        
        const decoded = verifyAccessToken(token);
        socket.user = { ...decoded, role: normalizeRole(decoded.role) };
        next();
      } catch (err) {
        next(new Error("Authentication error: Invalid token"));
      }
    });

    io.on('connection', (socket) => {
      console.log(`🔌 Client connected: [${socket.user.role}] ${socket.user._id}`);

      // 1. Join scalable role-based personal room cleanly targeting exact schemas
      const personalRoom = `${socket.user.role}_${socket.user._id.toString()}`;
      socket.join(personalRoom);
      if (socket.user.role === "driver") {
        socket.join("drivers_lobby");
      }

      // 2. Join specific Ride Room for real-time syncing
      socket.on('join_ride', (rideId) => {
        socket.join(`ride_${rideId}`);
        console.log(`${personalRoom} joined ride room: ride_${rideId}`);
      });

      // 3. Driver Location Update -> Broadcast to Ride Room & Update MongoDB
      socket.on('driver_location_update', async (data) => {
        const { rideId, location } = data;
        
        // Broadcast securely purely to people inside this exact ride
        if (rideId) {
          io.to(`ride_${rideId}`).emit('driver_location_update', location);
        }

        // Update MongoDB state silently in background
        if (socket.user.role === 'driver') {
          try {
            await updateDriverById(socket.user._id, {
              $set: { 
                "location.coordinates": [location.lng, location.lat],
                lastHeartbeat: new Date()
              }
            });
          } catch (e) {}
        }
      });

      // 4. Update status dynamically across parties
      socket.on('ride_status_update', (data) => {
        const { rideId, status } = data;
        io.to(`ride_${rideId}`).emit('ride_status_update', { rideId, status });
      });

      // 5. Driver Disconnect Handling (Graceful handling of dropped mid-ride packets)
      socket.on('disconnect', async () => {
        console.log(`🔌 Client disconnected: ${personalRoom}`);
        
        // Check if driver was on an active ride
        if (socket.user.role === 'driver') {
           const activeDriver = await findDriverById(socket.user._id, { select: 'currentRideId' });
           if (activeDriver?.currentRideId) {
              const ride = await findRideById(activeDriver.currentRideId);
              if (ride && ['accepted', 'arriving', 'in_progress'].includes(ride.status)) {
                 io.to(`ride_${activeDriver.currentRideId}`).emit('driver_disconnected', { 
                   message: "Driver connection interrupted. Waiting for reconnection...",
                   rideId: activeDriver.currentRideId
                 });
                 // System could internally kick off a 2 minute timer before auto-cancelling
              }
           }
        }
      });
    });

    return io;
  },
  
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io is not initialized!');
    }
    return io;
  }
};
