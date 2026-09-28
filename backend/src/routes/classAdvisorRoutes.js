const express = require('express');
const router = express.Router();
const classAdvisorController = require('../controllers/classAdvisorController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { validateClassAdvisor } = require('../validators/allocationValidators');

router.get('/', classAdvisorController.getAdvisors);
router.post(
  '/',
  authenticateUser,
  requireRole('HOD', 'ADMIN'),
  validate(validateClassAdvisor),
  classAdvisorController.assignAdvisor
);
router.patch('/:id/deactivate', authenticateUser, requireRole('HOD', 'ADMIN'), classAdvisorController.deactivateAdvisor);

module.exports = router;
