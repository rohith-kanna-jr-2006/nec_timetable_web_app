const express = require('express');
const router = express.Router();
const substituteController = require('../controllers/substituteController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', authenticateUser, substituteController.getSubstitutes);

// Phase 7: TC owns operational substitute mapping. HOD keeps its administrative
// authority and ADMIN keeps its override authority. Legacy AC is still accepted
// for the migration period, matching the timetable transition contract.
// FACULTY is deliberately excluded (403) — faculty cannot create or confirm a
// substitute mapping. This grant is scoped to substitute mapping only and does
// not give TC any HOD faculty-allocation authority.
router.post(
  '/',
  authenticateUser,
  requireRole('HOD', 'TC', 'AC', 'ADMIN'),
  substituteController.assignSubstitute
);

// Phase 7 read helpers for the TC mapping screen.
router.get(
  '/affected-sessions',
  authenticateUser,
  requireRole('HOD', 'TC', 'AC', 'ADMIN'),
  substituteController.getAffectedSessions
);
router.get(
  '/eligible-faculty',
  authenticateUser,
  requireRole('HOD', 'TC', 'AC', 'ADMIN'),
  substituteController.getEligibleFaculty
);

router.patch('/:id/status', authenticateUser, requireRole('HOD', 'TC', 'AC', 'ADMIN'), substituteController.updateSubstituteStatus);

module.exports = router;
