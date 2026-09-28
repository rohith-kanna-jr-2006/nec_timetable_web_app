const express = require('express');
const router = express.Router();
const hodAllocationController = require('../controllers/hodAllocationController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { validateHodAllocation } = require('../validators/allocationValidators');

router.get('/', hodAllocationController.getAllocations);
router.post(
  '/',
  authenticateUser,
  requireRole('HOD', 'AC', 'ADMIN'),
  validate(validateHodAllocation),
  hodAllocationController.createAllocation
);
router.patch('/:id/status', authenticateUser, requireRole('HOD', 'ADMIN'), hodAllocationController.updateStatus);
router.delete('/:id', authenticateUser, requireRole('HOD', 'ADMIN'), hodAllocationController.deleteAllocation);

module.exports = router;
