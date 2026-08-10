const User = require("../models/user.model");
const Driver = require("../models/driver.model");
const Admin = require("../models/admin.model");
const { applyQueryOptions } = require("./query-options");

const roleModelMap = {
  user: User,
  customer: User,
  driver: Driver,
  admin: Admin,
};

const accountTypeModelMap = {
  user: User,
  customer: User,
  driver: Driver,
};

const getModelForRole = (role) => roleModelMap[role] || null;
const getModelForType = (type) => accountTypeModelMap[type] || null;

const findAccountByIdForRole = (role, id, options = {}) => {
  const Model = getModelForRole(role);
  if (!Model) return null;
  return applyQueryOptions(Model.findById(id), options);
};

const findAccountByFilterForRole = (role, filter, options = {}) => {
  const Model = getModelForRole(role);
  if (!Model) return null;
  return applyQueryOptions(Model.findOne(filter), options);
};

const updateAccountByIdForRole = (role, id, update, modelOptions = {}, queryOptions = {}) => {
  const Model = getModelForRole(role);
  if (!Model) return null;
  return applyQueryOptions(Model.findByIdAndUpdate(id, update, modelOptions), queryOptions);
};

const updateOneAccountForRole = (role, filter, update, options = {}) => {
  const Model = getModelForRole(role);
  if (!Model) return null;
  return Model.updateOne(filter, update, options);
};

const deleteAccountByIdForRole = (role, id) => {
  const Model = getModelForRole(role);
  if (!Model) return null;
  return Model.deleteOne({ _id: id });
};

const deleteAccountByType = (type, id) => {
  const Model = getModelForType(type);
  if (!Model) return null;
  return Model.findByIdAndDelete(id);
};

const saveAccount = (account) => account.save();

const findUserByEmail = (email, { includePassword = false } = {}) => {
  let query = User.findOne({ email });
  if (includePassword) {
    query = query.select("+password");
  }
  return query;
};

const createUser = (payload) => User.create(payload);
const findUsersForAdmin = () => User.find({ role: "user" }).select("-password").sort({ createdAt: -1 });
const countUsers = (filter = {}) => User.countDocuments(filter);

module.exports = {
  countUsers,
  createUser,
  deleteAccountByIdForRole,
  deleteAccountByType,
  findAccountByFilterForRole,
  findAccountByIdForRole,
  findUserByEmail,
  findUsersForAdmin,
  saveAccount,
  updateAccountByIdForRole,
  updateOneAccountForRole,
};
