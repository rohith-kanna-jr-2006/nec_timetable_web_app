/**
 * Standard API JSON Response Helpers
 */

function successResponse(res, data = {}, statusCode = 200, meta = null) {
  const response = {
    success: true,
    data,
  };
  if (meta) {
    response.meta = meta;
  }
  return res.status(statusCode).json(response);
}

function errorResponse(res, message = 'Internal server error', statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
  const response = {
    success: false,
    message,
    code,
  };
  if (details) {
    response.details = details;
  }
  return res.status(statusCode).json(response);
}

module.exports = {
  successResponse,
  errorResponse,
};
