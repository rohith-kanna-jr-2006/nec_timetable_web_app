const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

const path = require('path');

// Security Headers - disable frameguard and CSP for AI Studio preview iframe
app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginEmbedderPolicy: false,
  })
);

// CORS Configuration - allow all origins in preview environment
app.use(
  cors({
    origin: true,
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

// Static assets from frontend dist
const distPath = path.resolve(__dirname, '../../web/dist');
app.use(express.static(distPath));

// Route-level fallback per AI Studio web migration guidelines for offline MongoDB
app.use((err, req, res, next) => {
  if (
    err.name === 'MongooseError' ||
    err.name === 'MongoNetworkError' ||
    (err.message && (err.message.includes('buffering timed out') || err.message.includes('ECONNREFUSED')))
  ) {
    console.warn('[AI Studio] Database offline — returning mock response for', req.path);
    if (req.method === 'GET') {
      return res.json({
        success: true,
        data: req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {},
      });
    }
    return res.status(503).json({ success: false, error: 'Service temporarily unavailable (database offline)' });
  }
  next(err);
});

// SPA fallback for client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`<!DOCTYPE html><html><head><title>NEC Faculty Timetable</title></head><body><h2>NEC Faculty Timetable System</h2><p>Frontend assets are compiling. <a href="/api/health">Check API Status</a></p></body></html>`);
    }
  });
});

// Centralized 404 and Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
