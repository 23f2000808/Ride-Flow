const Driver = require("../models/driver.model");
const { applyQueryOptions } = require("./query-options");

const findDriverByEmail = (email) => Driver.findOne({ email });
const createDriver = (payload) => Driver.create(payload);

const findDriverById = (id, options = {}) =>
  applyQueryOptions(Driver.findById(id), options);

const findDrivers = (filter = {}, options = {}) =>
  applyQueryOptions(Driver.find(filter), options);

const findNearbyDrivers = (longitude, latitude, radiusInKm = 5, vehicleType = null, options = {}) =>
  applyQueryOptions(
    Driver.findNearbyDrivers(longitude, latitude, radiusInKm, vehicleType),
    options,
  );

const updateDriverById = (id, update, modelOptions = {}, queryOptions = {}) =>
  applyQueryOptions(Driver.findByIdAndUpdate(id, update, modelOptions), queryOptions);

const updateManyDrivers = (filter, update, options = {}) =>
  Driver.updateMany(filter, update, options);

const countDrivers = (filter = {}) => Driver.countDocuments(filter);
const saveDriver = (driver) => driver.save();
const findDriversForAdmin = () => Driver.find().select("-password").sort({ createdAt: -1 });

module.exports = {
  countDrivers,
  createDriver,
  findDriverByEmail,
  findDriverById,
  findDrivers,
  findDriversForAdmin,
  findNearbyDrivers,
  saveDriver,
  updateDriverById,
  updateManyDrivers,
};
