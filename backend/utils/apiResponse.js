const sendSuccess = (res, {
  statusCode = 200,
  message = "Request completed successfully.",
  data = null,
  meta,
} = {}) => {
  const payload = {
    success: true,
    statusCode,
    message,
  };

  if (data !== null) {
    payload.data = data;
  }

  if (meta) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
};

const sendError = (res, {
  statusCode = 500,
  message = "Internal server error.",
  errors,
} = {}) => {
  const payload = {
    success: false,
    statusCode,
    message,
  };

  if (errors) {
    payload.errors = Array.isArray(errors) ? errors : [errors];
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  sendSuccess,
  sendError,
};
