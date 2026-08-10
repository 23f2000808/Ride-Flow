const OutboxEvent = require("../models/outboxEvent.model");

const findPendingOutboxEvents = (limit = 50) =>
  OutboxEvent.find({ processed: false }).limit(limit);

const saveOutboxEvent = (event) => event.save();

module.exports = {
  findPendingOutboxEvents,
  saveOutboxEvent,
};
