const User = require('../models/User');
const { generateToken } = require('../utils/generateToken');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * User Login Endpoint
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
    if (!user) {
      return errorResponse(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account has been deactivated. Please contact administrator.', 401, 'ACCOUNT_DEACTIVATED');
    }

    const token = generateToken(user);

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      facultyId: user.facultyId,
      isActive: user.isActive,
    };

    return successResponse(
      res,
      {
        user: userResponse,
        token,
        role: user.role,
        facultyId: user.facultyId,
      },
      200
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get Authenticated User Profile
 * GET /api/auth/me
 */
async function getMe(req, res, next) {
  try {
    const user = req.user;
    const profile = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      facultyId: user.facultyId,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
    return successResponse(res, {
      ...profile,
      user: profile,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Register User (Development & Admin helper)
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    const { name, email, password, role, facultyId } = req.body;
    const bcrypt = require('bcryptjs');

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return errorResponse(res, 'Email address is already registered', 409, 'EMAIL_EXISTS');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || 'FACULTY',
      facultyId: facultyId || null,
      isActive: true,
    });

    const token = generateToken(newUser);

    return successResponse(
      res,
      {
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          facultyId: newUser.facultyId,
        },
        token,
      },
      201
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  getMe,
  register,
};
