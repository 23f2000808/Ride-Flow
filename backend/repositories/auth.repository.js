const bcrypt = require("bcryptjs");
const Customer = require("../models/customer.model");
const Driver = require("../models/driver.model");
const Admin = require("../models/admin.model");
const RefreshToken = require("../models/refreshToken.model");

const authRoleModelMap = {
  customer: Customer,
  driver: Driver,
  admin: Admin,
};

const getAuthModelForRole = (role) => authRoleModelMap[role] || null;
const isSupportedAuthRole = (role) => Object.prototype.hasOwnProperty.call(authRoleModelMap, role);

const findExistingAccountIdsByEmail = (email) =>
  Promise.all(
    Object.values(authRoleModelMap).map((Model) =>
      Model.findOne({ email }).select("_id").lean()
    )
  );

const findExistingAccountIdsByPhone = (phone, role) => {
  const phoneModels = role === "driver"
    ? [Driver, Customer]
    : [Customer, Driver];

  return Promise.all(
    phoneModels.map((Model) => Model.findOne({ phone }).select("_id").lean())
  );
};

const insertValidatedDocument = async (Model, payload) => {
  const preparedPayload = {
    ...payload,
    password: await bcrypt.hash(payload.password, 12),
  };

  const document = new Model(preparedPayload);
  await document.validate();
  await Model.collection.insertOne(document.toObject());
  return Model.findById(document._id);
};

const createCustomerAccount = (payload) => insertValidatedDocument(Customer, payload);
const createDriverAccount = (payload) => insertValidatedDocument(Driver, payload);
const createAdminAccount = (payload) => insertValidatedDocument(Admin, payload);

const findAuthAccountByEmail = (role, email, { includePassword = false } = {}) => {
  const Model = getAuthModelForRole(role);
  if (!Model) return null;

  let query = Model.findOne({ email });
  if (includePassword) {
    query = query.select("+password");
  }
  return query;
};

const findAuthAccountById = (role, userId) => {
  const Model = getAuthModelForRole(role);
  if (!Model) return null;
  return Model.findById(userId);
};

const createRefreshToken = (payload) => RefreshToken.create(payload);

const revokeRefreshTokenByHash = (tokenHash) =>
  RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

const findActiveRefreshTokenByHash = (tokenHash) =>
  RefreshToken.findOne({
    tokenHash,
    revokedAt: null,
  });

module.exports = {
  createAdminAccount,
  createCustomerAccount,
  createDriverAccount,
  createRefreshToken,
  findActiveRefreshTokenByHash,
  findAuthAccountByEmail,
  findAuthAccountById,
  findExistingAccountIdsByEmail,
  findExistingAccountIdsByPhone,
  isSupportedAuthRole,
  revokeRefreshTokenByHash,
};
