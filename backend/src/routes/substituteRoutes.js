const express = require('express');
const router = express.Router();
const substituteController = require('../controllers/substituteController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', authenticateUser, substituteController.getSubstitutes);
router.post('/', authenticateUser, requireRole('HOD', 'ADMIN'), substituteController.assignSubstitute);
router.patch('/:id/status', authenticateUser, substituteController.updateSubstituteStatus);

module.exports = router;
