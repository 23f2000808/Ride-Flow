const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema(
  {
    // ─── PARTICIPANTS ───────────────────────────────────
    // Reference to the user who booked the ride
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Ride must belong to a user"],
      index: true,
    },

    // Reference to the assigned driver (null until a driver accepts)
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
      index: true,
    },

    // ─── PICKUP LOCATION ────────────────────────────────
    // Where the rider wants to be picked up
    pickup: {
      address: {
        type: String,
        required: [true, "Pickup address is required"],
      },
      location: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: [true, "Pickup coordinates are required"],
        },
      },
    },

    // ─── DESTINATION ────────────────────────────────────
    // Where the rider wants to go
    destination: {
      address: {
        type: String,
        required: [true, "Destination address is required"],
      },
      location: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: [true, "Destination coordinates are required"],
        },
      },
    },

    // ─── RIDE LIFECYCLE STATUS ──────────────────────────
    // Tracks the ride through its entire lifecycle:
    //   requested → accepted → driver_arrived → in_progress → completed
    //   At any point it can move to → cancelled
    status: {
      type: String,
      enum: ["requested", "accepted", "rejected", "in_progress", "completed", "cancelled"],
      default: "requested",
    },

    // Who cancelled and why — important for dispute resolution & analytics
    cancellation: {
      cancelledBy: {
        type: String,
        enum: ["user", "driver", "system"],
      },
      reason: { type: String },
      cancelledAt: { type: Date },
    },

    // ─── VEHICLE TYPE ───────────────────────────────────
    // Must match a vehicle type from the Driver schema
    vehicleType: {
      type: String,
      required: [true, "Vehicle type is required"],
      enum: ["car", "auto", "motorcycle", "van"],
    },

    // Distributed Schema Multi-Region Mapping
    regionId: {
      type: String,
      default: 'global_default'
    },

    // Strict Linear Event Versioning
    version: {
      type: Number,
      default: 0,
    },

    // ─── FARE / PRICING ─────────────────────────────────
    fare: {
      // Estimated fare shown to user before ride starts
      estimatedFare: {
        type: Number,
        required: [true, "Estimated fare is required"],
        min: [0, "Fare cannot be negative"],
      },
      // Actual fare calculated after ride completion (may differ due to route changes)
      actualFare: {
        type: Number,
        min: [0, "Fare cannot be negative"],
      },
      // Dynamic pricing multiplier (>1 during peak demand)
      surgePriceMultiplier: {
        type: Number,
        default: 1.0,
        min: [1, "Surge multiplier cannot be less than 1"],
      },
      // Breakdown for transparency
      baseFare: { type: Number, default: 0 },
      perKmRate: { type: Number, default: 0 },
      perMinuteRate: { type: Number, default: 0 },
      // Promo/coupon code applied
      discount: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
    },

    // Normalized fare used by list queries so sorting/filtering can hit a single index.
    effectiveFare: {
      type: Number,
      default: 0,
    },

    // ─── TRIP METRICS ───────────────────────────────────
    // Calculated after ride completes — used for billing and analytics
    distance: {
      type: Number, // in kilometers
      default: null,
    },

    duration: {
      type: Number, // in seconds
      default: null,
    },

    // ─── TIMESTAMPS ─────────────────────────────────────
    // Track each lifecycle event for analytics, SLAs, and dispute resolution
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    acceptedAt: { type: Date },
    driverArrivedAt: { type: Date },
    startedAt: { type: Date },   // When rider got in and trip started
    completedAt: { type: Date },

    // ─── PAYMENT ────────────────────────────────────────
    payment: {
      method: {
        type: String,
        enum: ["cash", "card", "wallet", "upi"],
      },
      // Enum covers general lifecycle: pending -> completed -> failed -> refunded
      status: {
        type: String,
        enum: ["pending", "completed", "failed", "refunded"],
        default: "pending",
      },

      // Payment gateway / transaction mapping IDs tracking logs linearly safely
      transactionId: {
        type: String,
      },
      
      transactionLogs: [{
        status: String,
        amount: Number,
        recordedAt: { type: Date, default: Date.now },
        gatewayResponse: mongoose.Schema.Types.Mixed
      }]
    },

    // ─── RATINGS ────────────────────────────────────────
    // Post-ride feedback — stored on the ride for audit trail
    ratings: {
      userRating: {
        score: { type: Number, min: 1, max: 5 },
        review: { type: String, maxlength: 500 },
      },
      driverRating: {
        score: { type: Number, min: 1, max: 5 },
        review: { type: String, maxlength: 500 },
      },
    },

    // ─── OTP VERIFICATION ───────────────────────────────
    // OTP that rider gives to driver before starting ride — safety measure
    otp: {
      code: {
        type: String,
        select: false, // Don't expose in normal queries
      },
      expiresAt: { type: Date },
      verified: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

// ─── INDEXES ────────────────────────────────────────────
// Geospatial index on pickup for "rides near me" queries
rideSchema.pre("validate", function normalizeRideDates() {
  if (typeof this.createdAt === "string") {
    const parsedCreatedAt = new Date(this.createdAt);
    if (!Number.isNaN(parsedCreatedAt.getTime())) {
      this.createdAt = parsedCreatedAt;
    }
  }

  if (typeof this.updatedAt === "string") {
    const parsedUpdatedAt = new Date(this.updatedAt);
    if (!Number.isNaN(parsedUpdatedAt.getTime())) {
      this.updatedAt = parsedUpdatedAt;
    }
  }

  if (!this.requestedAt && this.createdAt) {
    this.requestedAt = this.createdAt;
  }

  const normalizedFare = this.fare?.actualFare ?? this.fare?.estimatedFare ?? 0;
  if (Number.isFinite(Number(normalizedFare))) {
    this.effectiveFare = Number(normalizedFare);
  }
});

rideSchema.index({ "pickup.location": "2dsphere" });

// Fast lookups for active rides by status
rideSchema.index({ status: 1, requestedAt: -1 });

// Fast global timeline lookups
rideSchema.index({ requestedAt: -1 });

// Find all rides for a user sorted by date
rideSchema.index({ user: 1, requestedAt: -1 });
rideSchema.index({ user: 1, status: 1, requestedAt: -1 });
rideSchema.index({ user: 1, effectiveFare: 1, requestedAt: -1 });
rideSchema.index({ user: 1, distance: 1, requestedAt: -1 });

// Find all rides for a driver sorted by date
rideSchema.index({ driver: 1, requestedAt: -1 });
rideSchema.index({ driver: 1, status: 1, requestedAt: -1 });
rideSchema.index({ driver: 1, effectiveFare: 1, requestedAt: -1 });
rideSchema.index({ driver: 1, distance: 1, requestedAt: -1 });
rideSchema.index({ driver: 1, status: 1, updatedAt: -1 });

// Shared dispatch and open-request scans.
rideSchema.index({ status: 1, driver: 1, requestedAt: -1 });

// Sorting and filtering optimizations for fare and distance queries
rideSchema.index({ effectiveFare: 1 });
rideSchema.index({ distance: 1 });

const Ride = mongoose.model("Ride", rideSchema);

module.exports = Ride;
