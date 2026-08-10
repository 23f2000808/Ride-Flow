const mongoose = require("mongoose");

const outboxEventSchema = new mongoose.Schema({
  aggregateId: { type: mongoose.Schema.Types.ObjectId, required: true },
  aggregateType: { type: String, enum: ['Ride', 'Driver', 'Transaction'], required: true },
  eventType: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  processed: { type: Boolean, default: false },
  retryCount: { type: Number, default: 0 },
  errorLogs: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

// Index specifically scoped finding pending un-emitted locks
outboxEventSchema.index({ processed: 1 });

module.exports = mongoose.model("OutboxEvent", outboxEventSchema);
