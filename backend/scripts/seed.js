/**
 * Quick seed script to set up test data:
 * - Approves all drivers
 * - Sets locations around Bangalore
 * - Makes them available
 * 
 * Run: node scripts/seed.js
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const {
  createUser,
  findUserByEmail,
  saveAccount,
} = require("../repositories/account.repository");
const {
  findDrivers,
  updateDriverById,
} = require("../repositories/driver.repository");

const BANGALORE_LOCATIONS = [
  { lng: 77.5946, lat: 12.9716, name: "MG Road" },
  { lng: 77.5800, lat: 12.9780, name: "Cubbon Park" },
  { lng: 77.6100, lat: 12.9352, name: "Koramangala" },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const drivers = await findDrivers();
  console.log(`Found ${drivers.length} drivers`);

  for (let i = 0; i < drivers.length; i++) {
    const loc = BANGALORE_LOCATIONS[i % BANGALORE_LOCATIONS.length];
    await updateDriverById(drivers[i]._id, {
      $set: {
        verificationStatus: "approved",
        isOnline: true,
        currentRideId: null,
        status: "active",
        location: {
          type: "Point",
          coordinates: [loc.lng, loc.lat],
        },
      },
    });
    console.log(`✅ ${drivers[i].fullname.firstname} → approved, location: ${loc.name}`);
  }

  console.log("\nDone! All drivers are now approved and available.");

  // Seed Default Admin
  const adminEmail = "admin@rideflow.io";
  
  let admin = await findUserByEmail(adminEmail);
  if (!admin) {
    admin = await createUser({
      fullname: { firstname: "System", lastname: "Admin" },
      email: adminEmail,
      password: "adminpassword",
      role: "admin",
      status: "active"
    });
    console.log(`\n👑 Admin Seeded -> Email: admin@rideflow.io | Pass: adminpassword`);
  } else {
    // Force role up to date
    admin.role = "admin";
    await saveAccount(admin);
    console.log(`\n👑 Admin verified and ready`);
  }

  await mongoose.disconnect();
}

seed().catch(console.error);
