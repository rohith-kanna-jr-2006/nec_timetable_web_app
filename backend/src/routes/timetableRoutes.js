const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { validateTimetableVersion, validateTimetableSession } = require('../validators/timetableValidators');

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
