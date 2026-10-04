const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const timetableController = require('../controllers/timetableController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const {
  validateTimetableVersion,
  validateTimetableSession,
  validateGenerateFromContext,
} = require('../validators/timetableValidators');

// Timetable Views
router.get('/faculty/:facultyId', timetableController.getFacultyTimetable);
router.get('/class/:academicContextId', timetableController.getClassTimetable);
router.get('/published/:academicContextId', timetableController.getPublishedClassTimetable);
router.get('/context-status/:academicContextId', timetableController.getContextStatus);
router.get('/status/:academicContextId', timetableController.getContextStatus);
router.get('/review-matrix', timetableController.getReviewMatrix);
router.get('/matrix', timetableController.getReviewMatrix);

// TC Design Context — Phase 3: authoritative design dataset for TC timetable screen.
// Read-only: TC, HOD, ADMIN (and legacy AC) can view the design context.
router.get(
  '/design-context/:academicContextId',
  authenticateUser,
  requireRole('TC', 'AC', 'HOD', 'ADMIN'),
  timetableController.getDesignContext
);

// Version Management — read (public)
router.get('/versions', timetableController.getVersions);
router.get('/version/:id', timetableController.getVersionById);

// Version Management — create (TC / ADMIN only)
// HOD must NOT create timetable versions — design authority belongs to TC.
// Legacy: 'AC' is accepted temporarily during the AC→TC migration period.
router.post(
  '/version',
  authenticateUser,
  requireRole('TC', 'AC', 'ADMIN'),
  validate(validateTimetableVersion),
  timetableController.createVersion
);
// Status Transition — route allows TC + HOD + ADMIN (all lifecycle stakeholders).
// The service layer enforces per-target-status authority:
//   TC  → design targets only (DRAFT, GENERATED, PENDING_HOD_APPROVAL)
//   HOD → approval targets only (APPROVED, REJECTED, PUBLISHED)
// Legacy: 'AC' accepted temporarily during AC→TC migration.
router.patch(
  '/version/:id/status',
  authenticateUser,
  requireRole('TC', 'AC', 'HOD', 'ADMIN'),
  timetableController.transitionVersion
);

// Automatic Timetable Generation (CSP Engine) — TC / ADMIN only.
// HOD must receive HTTP 403 for these endpoints (governance requirement §7).
// Legacy: 'AC' accepted temporarily during AC→TC migration.
router.post(
  '/solve',
  authenticateUser,
  requireRole('TC', 'AC', 'ADMIN'),
  timetableController.solveTimetable
);
router.post(
  '/generate',
  authenticateUser,
  requireRole('TC', 'AC', 'ADMIN'),
  timetableController.solveTimetable
);

// Phase 4 — TC Timetable Generation Engine.
// Preferred generation path: the server re-derives the course list, HOD-approved
// faculty and period counts from the Phase 3 TC Design Context, runs the CSP
// solver, persists TimetableSession[] and sets TimetableVersion = GENERATED.
// HOD must receive HTTP 403 (governance requirement §7).
// Legacy: 'AC' is accepted temporarily during the AC→TC migration period.
const generationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // 20 generation runs per window per client
  skip: () => process.env.NODE_ENV === 'test',
  validate: {
    xForwardedForHeader: false,
    trustProxy: false,
  },
  message: {
    success: false,
    message: 'Too many timetable generation requests, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/generate-from-context',
  authenticateUser,
  requireRole('TC', 'AC', 'ADMIN'),
  validate(validateGenerateFromContext),
  generationLimiter,
  timetableController.generateFromDesignContext
);

// Session Scheduling — TC / ADMIN only.
// HOD must receive HTTP 403 for session create/delete (governance requirement §7).
// Legacy: 'AC' accepted temporarily during AC→TC migration.
router.post(
  '/session',
  authenticateUser,
  requireRole('TC', 'AC', 'ADMIN'),
  validate(validateTimetableSession),
  timetableController.createSession
);
router.delete(
  '/session/:id',
  authenticateUser,
  requireRole('TC', 'AC', 'ADMIN'),
  timetableController.deleteSession
);

module.exports = router;
