const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const connectDB = require("../config/db");
const {
  createRideIndexes,
  updateManyRides,
} = require("../repositories/ride.repository");

async function backfillRideQueryFields() {
  await connectDB();

  const updateResult = await updateManyRides(
    {},
    [
      {
        $set: {
          requestedAt: {
            $ifNull: ["$requestedAt", "$createdAt"],
          },
          effectiveFare: {
            $ifNull: [
              "$effectiveFare",
              {
                $ifNull: [
                  "$fare.actualFare",
                  {
                    $ifNull: ["$fare.estimatedFare", 0],
                  },
                ],
              },
            ],
          },
        },
      },
    ],
    { updatePipeline: true }
  );

  await createRideIndexes();

  console.log(
    JSON.stringify(
      {
        matched: updateResult.matchedCount,
        modified: updateResult.modifiedCount,
      },
      null,
      2
    )
  );
}

backfillRideQueryFields()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
