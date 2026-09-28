const express = require('express');
const router = express.Router();
const absenceController = require('../controllers/absenceController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', authenticateUser, absenceController.getAbsences);
router.post('/', authenticateUser, absenceController.reportAbsence);
router.patch('/:id/status', authenticateUser, requireRole('HOD', 'ADMIN'), absenceController.updateAbsenceStatus);

module.exports = router;
