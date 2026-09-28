/**
 * Validation rules for authentication payloads.
 */

function validateLogin(req) {
  const errors = [];
  const { email, password } = (req.body && typeof req.body === 'object') ? req.body : {};

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.push('Please enter a valid email address');
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    errors.push('Password is required');
  }

  return errors;
}

function validateRegister(req) {
  const errors = [];
  const { name, email, password, role } = (req.body && typeof req.body === 'object') ? req.body : {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('Name is required');
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.push('Please enter a valid email address');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (role && !['FACULTY', 'AC', 'HOD', 'ADMIN'].includes(role)) {
    errors.push('Role must be one of: FACULTY, AC, HOD, ADMIN');
  }

  return errors;
}

module.exports = {
  validateLogin,
  validateRegister,
};
