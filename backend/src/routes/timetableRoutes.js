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

// Version Management
router.get('/versions', timetableController.getVersions);
router.get('/version/:id', timetableController.getVersionById);
router.post(
  '/version',
  authenticateUser,
  requireRole('HOD', 'AC', 'ADMIN'),
  validate(validateTimetableVersion),
  timetableController.createVersion
);
router.patch(
  '/version/:id/status',
  authenticateUser,
  requireRole('HOD', 'ADMIN'),
  timetableController.transitionVersion
);

// Session Scheduling
router.post(
  '/session',
  authenticateUser,
  requireRole('HOD', 'AC', 'ADMIN'),
  validate(validateTimetableSession),
  timetableController.createSession
);
router.delete(
  '/session/:id',
  authenticateUser,
  requireRole('HOD', 'AC', 'ADMIN'),
  timetableController.deleteSession
);

module.exports = router;
