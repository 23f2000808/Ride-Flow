const mongoose = require("mongoose");

const rideEventSchema = new mongoose.Schema({
  ride: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ride",
    required: true,
    index: true,
  },
  eventType: {
    type: String,
    enum: [
      "requested", "assigned", "accepted", "arriving", 
      "in_progress", "completed", "cancelled", 
      "timeout", "reassigned", "driver_disconnected"
    ],
    required: true,
  },
  actor: {
    type: String,
    enum: ["user", "driver", "system"],
    required: true,
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null, // Null if system
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

rideEventSchema.index({ ride: 1, createdAt: -1 });

module.exports = mongoose.model("RideEvent", rideEventSchema);
