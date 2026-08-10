const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const {
  findAllRides,
  findSampleRides,
  saveRide,
} = require("../repositories/ride.repository");

async function fixRideCreatedAt() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const sample = await findSampleRides(5);
  sample.forEach((ride) => {
    console.log("createdAt:", ride.createdAt, "type:", typeof ride.createdAt);
  });

  const rides = await findAllRides();
  let updatedCount = 0;
  let invalidCount = 0;

  for (const ride of rides) {
    if (typeof ride.createdAt === "string") {
      const fixedDate = new Date(ride.createdAt);

      if (!Number.isNaN(fixedDate.getTime())) {
        ride.createdAt = fixedDate;
        await saveRide(ride);
        updatedCount += 1;
      } else {
        console.error("Invalid date found:", ride._id, ride.createdAt);
        invalidCount += 1;
      }
    }
  }

  console.log(`Updated ${updatedCount} ride dates.`);
  console.log(`Invalid ride dates remaining: ${invalidCount}.`);

  await mongoose.disconnect();
}

fixRideCreatedAt().catch((error) => {
  console.error("Ride date migration failed:", error);
  process.exit(1);
});
