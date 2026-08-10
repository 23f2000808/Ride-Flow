const logger = require("../utils/logger");
const { getIO } = require("../config/socket");
const { dispatchQueue } = require("./dispatch.worker");
const {
  findPendingOutboxEvents,
  saveOutboxEvent,
} = require("../repositories/outbox.repository");

const processOutboxEvents = async () => {
  try {
    const pendingEvents = await findPendingOutboxEvents(50);
    
    if (pendingEvents.length === 0) return;

    for (let event of pendingEvents) {
      try {
        switch(event.eventType) {
           case "SOCKET_EMIT":
             const { room, channel, data } = event.payload;
             if (getIO) getIO().to(room).emit(channel, data);
             break;
           case "QUEUE_DISPATCH":
             await dispatchQueue.add(event.payload.jobName, event.payload.jobData, event.payload.opts);
             break;
           case "DLQ_ALERT":
             logger.warn("Dead Letter Queue Alert Fired via Outbox: Payload: ", event.payload);
             break;
        }

        event.processed = true;
        await saveOutboxEvent(event);
      } catch (err) {
        logger.error(`Outbox process error for Event ${event._id} : `, err.message);
        event.retryCount += 1;
        event.errorLogs.push(err.message);
        await saveOutboxEvent(event);
      }
    }
  } catch (err) {
    logger.error("Outbox poller generic error natively: ", err.message);
  }
};

// Polling daemon naturally picking out of outbox table exactly preventing state leaks scaling evenly.
const initOutboxWorker = () => {
  setInterval(processOutboxEvents, 3000); 
};

module.exports = { initOutboxWorker };
