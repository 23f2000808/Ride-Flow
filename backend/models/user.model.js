const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
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
      select: false, // Never return password in queries by default
    },

    phone: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values while keeping uniqueness
      match: [/^\+?[\d\s-]{10,15}$/, "Please provide a valid phone number"],
    },

    // Socket.io connection ID for real-time updates (ride tracking, notifications)
    socketId: {
      type: String,
      default: null,
    },

    // Profile picture URL stored in cloud storage (S3, Cloudinary, etc.)
    avatar: {
      type: String,
      default: null,
    },

    // Saved addresses for quick ride booking
    savedAddresses: [
      {
        label: { type: String, enum: ["home", "work", "other"] },
        address: { type: String },
        location: {
          type: { type: String, enum: ["Point"] },
          coordinates: { type: [Number] }, // [longitude, latitude]
        },
      },
    ],

    // Account status — allows soft-disabling accounts without deletion
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "deleted"],
      default: "active",
    },

    // For email verification flow
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // For phone OTP verification flow
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    // ─── ROLE-BASED ACCESS CONTROL ─────────────────────────
    role: {
      type: String,
      enum: ["user", "driver", "admin"],
      default: "user"
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ─── INDEX ──────────────────────────────────────────────
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });

// ─── MIDDLEWARE ──────────────────────────────────────────
// Hash password before saving (only if modified)
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ─── INSTANCE METHODS ───────────────────────────────────
// Compare entered password with hashed password in DB
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT access token
userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    { _id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
  );
};

const User = mongoose.model("User", userSchema);

module.exports = User;
  