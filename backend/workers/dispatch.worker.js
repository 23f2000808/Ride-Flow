const { Queue, Worker } = require("bullmq");
const redisClient = require("../config/redis");
const { createRideEvent, findRideById } = require("../repositories/ride.repository");

// Instantiate Persistent Distributed Queue
const dispatchQueue = new Queue('ride-dispatch', { connection: redisClient });

const initDispatchWorker = () => {
  const worker = new Worker('ride-dispatch', async (job) => {
    const { rideId, userId, driversList, batchIndex } = job.data;
    const BATCH_SIZE = 3;

    // Determine current processing scope
    const startIndex = batchIndex * BATCH_SIZE;
    const batch = driversList.slice(startIndex, startIndex + BATCH_SIZE);

    // Re-verify the ride is unequivocally still active exclusively
    const ride = await findRideById(rideId);
    if (!ride || ride.status !== "requested") return; // Handled concurrently elsewhere

    const { getIO } = require("../config/socket");

    // Stop the current dispatch cycle once every candidate has been notified.
    // Keep the ride open so drivers can still pick it up from their dashboard.
    if (batch.length === 0) {
      await createRideEvent({ 
        ride: rideId,
        eventType: "timeout",
        actor: "system",
        details: { message: "Dispatch cycle finished without an acceptance. Ride remains open." }
      });
      return;
    }

    // Ping the precise current slice batch concurrently
    batch.forEach((d) => {
      try {
        getIO().to(`driver_${d.driverId}`).emit('new-ride-request', {
          rideId,
          pickup: ride.pickup,
          destination: ride.destination,
          fare: ride.fare.estimatedFare,
          driverEtaMins: d.etaMinutes
        });
      } catch(e) {}
    });

    // Enqueue the exact SAME job but shifted window recursively, delayed by 15 full seconds natively inside Redis backing
    await dispatchQueue.add('dispatch-next-batch', {
      rideId, userId, driversList, batchIndex: batchIndex + 1
    }, { 
      delay: 15000, 
      removeOnComplete: true 
    });

  }, { connection: redisClient });

  worker.on('failed', (job, err) => {
    console.error(`❌ Dispatch Job Failed [Ride ID ${job.data.rideId}]:`, err.message);
  });

  return worker;
};

module.exports = { dispatchQueue, initDispatchWorker };
