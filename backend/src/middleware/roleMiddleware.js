const { errorResponse } = require('../utils/responseHandler');

/**
 * Middleware to enforce role-based access control (RBAC).
 * Supports single role or multiple authorized roles.
 *
 * Example: requireRole('HOD', 'ADMIN')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized access', 401, 'UNAUTHORIZED');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Access denied. Role '${req.user.role}' is not authorized to perform this action.`,
        403,
        'FORBIDDEN'
      );
    }

    next();
  };
}

module.exports = {
  requireRole,
};
