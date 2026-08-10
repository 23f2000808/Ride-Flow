const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const driverSchema = new mongoose.Schema(
  {
    fullname: {
      firstname: {
        type: String,
        required: [true, "First name is required"],
        trim: true,
        minlength: [2, "First name must be at least 2 characters"],
        maxlength: [50, "First name cannot exceed 50 characters"],
      },
      lastname: {
        type: String,
        trim: true,
        maxlength: [50, "Last name cannot exceed 50 characters"],
      },
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },

    phone: {
      type: String,
      required: [true, "Phone number is required for drivers"],
      unique: true,
      match: [/^\+?[\d\s-]{10,15}$/, "Please provide a valid phone number"],
    },

    // Socket.io ID — used to push real-time ride requests & navigation updates
    socketId: {
      type: String,
      default: null,
    },

    // ─── DRIVER-SPECIFIC: VEHICLE INFORMATION ───────────
    vehicle: {
      plate: {
        type: String,
        required: [true, "Vehicle plate number is required"],
        uppercase: true,
        trim: true,
      },
      color: {
        type: String,
        required: [true, "Vehicle color is required"],
        trim: true,
      },
      vehicleType: {
        type: String,
        required: [true, "Vehicle type is required"],
        enum: ["car", "auto", "motorcycle", "van"],
      },
      model: {
        type: String,
        trim: true,
      },
      year: {
        type: Number,
        min: [2000, "Vehicle must be year 2000 or newer"],
      },
      // Max passengers the vehicle can carry (used for ride matching)
      capacity: {
        type: Number,
        required: [true, "Vehicle capacity is required"],
        min: [1, "Capacity must be at least 1"],
        max: [8, "Capacity cannot exceed 8"],
      },
    },

    // ─── DRIVER-SPECIFIC: REAL-TIME LOCATION (GEOSPATIAL) ──
    // GeoJSON Point — enables MongoDB $near, $geoWithin queries
    // for finding nearby drivers when a user requests a ride
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude] — GeoJSON order
        default: [0, 0],
      },
    },

    // ─── DRIVER-SPECIFIC: AVAILABILITY ──────────────────
    // Whether the driver is currently online and accepting rides
    isOnline: {
      type: Boolean,
      default: false,
    },

    // Tracks whether the driver is currently on an active ride
    currentRideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      default: null,
    },

    // Dynamic Tracking Socket Heartbeat
    lastHeartbeat: {
      type: Date,
      default: Date.now,
    },

    // ─── DRIVER-SPECIFIC: VERIFICATION & DOCUMENTS ──────
    // Onboarding status — drivers must be verified before accepting rides
    verificationStatus: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected"],
      default: "pending",
    },

    // Document references (license, insurance, etc.)
    documents: {
      drivingLicense: {
        number: { type: String },
        expiryDate: { type: Date },
        verified: { type: Boolean, default: false },
      },
      vehicleInsurance: {
        policyNumber: { type: String },
        expiryDate: { type: Date },
        verified: { type: Boolean, default: false },
      },
      vehicleRegistration: {
        number: { type: String },
        verified: { type: Boolean, default: false },
      },
    },

    // ─── DRIVER-SPECIFIC: RATINGS & EARNINGS ────────────
    rating: {
      average: { type: Number, default: 5.0, min: 1, max: 5 },
      totalRatings: { type: Number, default: 0 },
    },

    earnings: {
      totalEarnings: { type: Number, default: 0 },
      currentBalance: { type: Number, default: 0 },
      lastPaidOut: { type: Date },
    },

    // Account status
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "deleted"],
      default: "active",
    },

    avatar: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ─── GEOSPATIAL INDEX (2dsphere) ────────────────────────
// This is the KEY index for ride-matching. When a user requests a ride,
// we query: "find all available drivers within X km of pickup point".
// MongoDB's 2dsphere index makes this query O(log n) instead of O(n).
driverSchema.index({ location: "2dsphere" });

// ─── OTHER INDEXES ──────────────────────────────────────
driverSchema.index({ email: 1 });
driverSchema.index({ phone: 1 });
// Compound index: quickly find nearby AND available drivers in one query
driverSchema.index({ isOnline: 1, "vehicle.vehicleType": 1 });

// ─── MIDDLEWARE ─────────────────────────────────────────
driverSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ─── INSTANCE METHODS ───────────────────────────────────
driverSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

driverSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    { _id: this._id, role: "driver" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
  );
};

// ─── STATIC METHODS ─────────────────────────────────────
// Find drivers near a given point — core of ride matching
driverSchema.statics.findNearbyDrivers = function (
  longitude,
  latitude,
  radiusInKm = 5,
  vehicleType = null
) {
  const query = {
    isOnline: true,
    currentRideId: null,
    verificationStatus: "approved",
    status: "active",
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        $maxDistance: radiusInKm * 1000, // Convert km to meters
      },
    },
  };

  if (vehicleType) {
    query["vehicle.vehicleType"] = vehicleType;
  }

  return this.find(query).select("-password");
};

const Driver = mongoose.model("Driver", driverSchema);

module.exports = Driver;
