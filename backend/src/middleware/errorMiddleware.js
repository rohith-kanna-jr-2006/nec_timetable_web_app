const { errorResponse } = require('../utils/responseHandler');

/**
 * 404 Route Not Found Handler
 */
function notFoundHandler(req, res, next) {
  return errorResponse(res, `Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND');
}

/**
 * Global Centralized Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  // Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return errorResponse(res, `Invalid format for field: ${err.path}`, 400, 'INVALID_ID');
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => e.message);
    return errorResponse(res, 'Validation error', 400, 'VALIDATION_ERROR', details);
  }

  // Mongoose Duplicate Key Error (Code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return errorResponse(
      res,
      `Duplicate value entered for ${field}. It must be unique.`,
      409,
      'DUPLICATE_KEY'
    );
  }

  // Custom status code if assigned
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code && typeof err.code === 'string' ? err.code : 'INTERNAL_SERVER_ERROR';

  const details = process.env.NODE_ENV === 'development' ? err.stack : undefined;

  return errorResponse(res, message, statusCode, code, details);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
