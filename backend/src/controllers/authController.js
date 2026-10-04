const User = require('../models/User');
const mongoose = require('mongoose');
const { generateToken } = require('../utils/generateToken');
const { successResponse, errorResponse } = require('../utils/responseHandler');

const DEMO_USERS = {
  'faculty@nec.edu.in': {
    _id: '65f0a0000000000000000003',
    id: '65f0a0000000000000000003',
    name: 'Dr. S. Karpusamy',
    email: 'faculty@nec.edu.in',
    role: 'FACULTY',
    facultyId: 'FWL-03',
    isActive: true,
  },
  'ac@nec.edu.in': {
    _id: '65f0a0000000000000000002',
    id: '65f0a0000000000000000002',
    name: 'Mr. R. Manikandan',
    email: 'ac@nec.edu.in',
    // Legacy AC entry kept for backward-compatibility during migration.
    // New logins should use tc@nec.edu.in.
    role: 'AC',
    facultyId: 'FWL-22',
    isActive: true,
  },
  'tc@nec.edu.in': {
    _id: '65f0a0000000000000000005',
    id: '65f0a0000000000000000005',
    name: 'Mr. R. Manikandan',
    email: 'tc@nec.edu.in',
    role: 'TC',
    facultyId: 'FWL-22',
    isActive: true,
  },
  'hod@nec.edu.in': {
    _id: '65f0a0000000000000000001',
    id: '65f0a0000000000000000001',
    name: 'Dr. T. Rajasekaran',
    email: 'hod@nec.edu.in',
    role: 'HOD',
    facultyId: 'FWL-01',
    isActive: true,
  },
  'admin@nec.edu.in': {
    _id: '65f0a0000000000000000000',
    id: '65f0a0000000000000000000',
    name: 'System Administrator',
    email: 'admin@nec.edu.in',
    role: 'ADMIN',
    facultyId: null,
    isActive: true,
  },
};

/**
 * User Login Endpoint
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    let user = null;
    let isDbOnline = mongoose.connection.readyState === 1;

    if (isDbOnline) {
      try {
        user = await User.findOne({ email: cleanEmail }).select('+passwordHash');
      } catch (dbErr) {
        isDbOnline = false;
      }
    }

    if (!isDbOnline) {
      const demo = DEMO_USERS[cleanEmail];
      if (demo && (password === 'Password123!' || process.env.NODE_ENV !== 'production')) {
        const token = generateToken(demo);
        return successResponse(
          res,
          {
            user: demo,
            token,
            role: demo.role,
            facultyId: demo.facultyId,
          },
          200
        );
      }
      return errorResponse(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

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
      id: user._id || user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      facultyId: user.facultyId,
      isActive: user.isActive !== false,
      createdAt: user.createdAt || new Date(),
    };
    return successResponse(res, {
      ...profile,
      user: profile,
      role: profile.role,
      facultyId: profile.facultyId,
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
