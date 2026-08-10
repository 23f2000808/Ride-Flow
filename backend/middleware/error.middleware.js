const logger = require("../utils/logger");
const { sendError } = require("../utils/apiResponse");

const notFoundHandler = (req, res) =>
  sendError(res, {
    statusCode: 404,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal server error.";

  logger.error({
    err,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    body: req.body,
    params: req.params,
    query: req.query,
  }, "Unhandled route error");

  return sendError(res, {
    statusCode,
    message,
    errors: process.env.NODE_ENV === "development" && err.stack ? [err.stack] : undefined,
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
