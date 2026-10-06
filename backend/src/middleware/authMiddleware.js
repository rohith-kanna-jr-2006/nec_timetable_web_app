const { verifyToken } = require('../utils/generateToken');
const { errorResponse } = require('../utils/responseHandler');
const User = require('../models/User');

/**
 * Middleware to authenticate requests using JWT Bearer token.
 */
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !/^Bearer\s+/i.test(authHeader.trim())) {
      return errorResponse(res, 'Authentication token missing or invalid', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.trim().replace(/^Bearer\s+/i, '');
    if (!token || !token.trim()) {
      return errorResponse(res, 'Authentication token missing', 401, 'UNAUTHORIZED');
    }

    let decoded;
    try {
      decoded = verifyToken(token.trim());
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 'Authentication token expired', 401, 'TOKEN_EXPIRED');
      }
      return errorResponse(res, 'Invalid authentication token', 401, 'INVALID_TOKEN');
    }

    if (!decoded || !decoded.id) {
      return errorResponse(res, 'Invalid authentication token payload', 401, 'INVALID_TOKEN');
    }

    const mongoose = require('mongoose');
    let user = null;

    if (mongoose.connection.readyState === 1) {
      try {
        user = await User.findById(decoded.id);
      } catch (dbErr) {
        // Fall back to decoded token claims
      }
    }

    if (!user) {
      // In offline/demo mode or if user was authenticated via demo credentials
      user = {
        _id: decoded.id,
        id: decoded.id,
        name: decoded.name || 'Staff User',
        email: decoded.email,
        role: decoded.role || 'FACULTY',
        facultyId: decoded.facultyId || null,
        isActive: true,
      };
    }

    if (!user.isActive) {
      return errorResponse(res, 'User account has been deactivated', 401, 'USER_INACTIVE');
    }

    req.user = user;
    next();
  } catch (error) {
    return errorResponse(res, 'Authentication error', 500, 'AUTH_ERROR', error.message);
  }
}

/**
 * Middleware to optionally authenticate requests using JWT Bearer token.
 * If Authorization header is provided, verifies token and attaches req.user.
 * If absent, leaves req.user = null and passes through to next middleware.
 */
async function optionalAuthenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !/^Bearer\s+/i.test(authHeader.trim())) {
      req.user = null;
      return next();
    }
    return authenticateUser(req, res, next);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authenticateUser,
  optionalAuthenticateUser,
};
