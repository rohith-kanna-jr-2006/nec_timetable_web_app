const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production');
    }
    return 'nec_faculty_secret_jwt_key_2026_production_grade';
  }
  return secret;
}

/**
 * Generate a signed JWT for an authenticated user.
 */
function generateToken(user, customExpiresIn = null) {
  const secret = getJwtSecret();
  const expiresIn = customExpiresIn || process.env.JWT_EXPIRES_IN || '7d';

  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    facultyId: user.facultyId,
    name: user.name,
  };

  return jwt.sign(payload, secret, { expiresIn });
}

function verifyToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
}

module.exports = {
  generateToken,
  verifyToken,
};
