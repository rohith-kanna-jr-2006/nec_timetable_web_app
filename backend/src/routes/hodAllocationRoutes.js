const express = require('express');
const router = express.Router();
const hodAllocationController = require('../controllers/hodAllocationController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { validateHodAllocation } = require('../validators/allocationValidators');

router.get('/', hodAllocationController.getAllocations);
router.get('/validate/:academicContextId', hodAllocationController.validateCohortAllocations);
router.get('/context/:academicContextId', hodAllocationController.getAllocationContext);
router.put(
  '/context/:academicContextId/course/:courseCode',
  authenticateUser,
  requireRole('HOD', 'ADMIN'),
  hodAllocationController.saveCourseAllocation
);
router.post(
  '/',
  authenticateUser,
  requireRole('HOD', 'ADMIN'),
  validate(validateHodAllocation),
  hodAllocationController.createAllocation
);
router.patch('/:id/status', authenticateUser, requireRole('HOD', 'ADMIN'), hodAllocationController.updateStatus);
router.put('/:id', authenticateUser, requireRole('HOD', 'ADMIN'), hodAllocationController.updateAllocation);
router.delete('/:id', authenticateUser, requireRole('HOD', 'ADMIN'), hodAllocationController.deleteAllocation);

module.exports = router;

