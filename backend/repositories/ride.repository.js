const Ride = require("../models/ride.model");
const RideEvent = require("../models/rideEvent.model");
const { applyQueryOptions } = require("./query-options");

const findRideById = (id, options = {}) =>
  applyQueryOptions(Ride.findById(id), options);

const findOneRide = (filter, options = {}) =>
  applyQueryOptions(Ride.findOne(filter), options);

const findRides = (filter = {}, options = {}) =>
  applyQueryOptions(Ride.find(filter), options);

const createRide = (payload) => Ride.create(payload);

const insertRideDraft = async (payload) => {
  const rideDraft = new Ride(payload);
  await rideDraft.validate();
  await Ride.collection.insertOne(rideDraft.toObject());
  return rideDraft;
};

const updateRideById = (id, update, modelOptions = {}, queryOptions = {}) =>
  applyQueryOptions(Ride.findByIdAndUpdate(id, update, modelOptions), queryOptions);

const updateOneRide = (filter, update, modelOptions = {}, queryOptions = {}) =>
  applyQueryOptions(Ride.findOneAndUpdate(filter, update, modelOptions), queryOptions);

const updateManyRides = (filter, update, options = {}) =>
  Ride.updateMany(filter, update, options);

const deleteRideById = (id) => Ride.deleteOne({ _id: id });
const deleteManyRides = (filter) => Ride.deleteMany(filter);
const countRides = (filter = {}) => Ride.countDocuments(filter);
const aggregateRides = (pipeline) => Ride.aggregate(pipeline);
const createRideEvent = (payload) => RideEvent.create(payload);
const saveRide = (ride) => ride.save();
const findSampleRides = (limit = 5) => Ride.find().limit(limit);
const findAllRides = () => Ride.find();
const createRideIndexes = () => Ride.createIndexes();

module.exports = {
  aggregateRides,
  countRides,
  createRide,
  createRideEvent,
  createRideIndexes,
  deleteManyRides,
  deleteRideById,
  findAllRides,
  findOneRide,
  findRideById,
  findRides,
  findSampleRides,
  insertRideDraft,
  saveRide,
  updateManyRides,
  updateOneRide,
  updateRideById,
};
