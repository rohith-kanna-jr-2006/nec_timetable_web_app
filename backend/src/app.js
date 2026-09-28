const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Security Headers
app.use(helmet());

// CORS Configuration
const allowedOriginEnv = process.env.CLIENT_ORIGIN;
const defaultDevOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

const corsOriginHandler = (origin, callback) => {
  // Allow requests with no origin (e.g. mobile app, curl, server-to-server)
  if (!origin) return callback(null, true);

  if (allowedOriginEnv === '*') {
    return callback(null, true);
  }

  if (allowedOriginEnv) {
    const configuredOrigins = allowedOriginEnv.split(',').map((o) => o.trim());
    if (configuredOrigins.includes(origin) || configuredOrigins.includes('*')) {
      return callback(null, true);
    }
  }

  // In non-production, permit standard localhost development origins
  if (process.env.NODE_ENV !== 'production') {
    if (defaultDevOrigins.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
  }

  return callback(null, false);
};

app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting for Auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

// Mount API
app.use('/api', apiRoutes);

// Root Welcome / Ping
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'NEC Faculty Timetable API Service is running.',
    healthEndpoint: '/api/health',
  });
});

// Centralized 404 and Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
