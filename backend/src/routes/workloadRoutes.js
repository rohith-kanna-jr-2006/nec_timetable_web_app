const express = require('express');
const router = express.Router();
const workloadController = require('../controllers/workloadController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { validateWorkloadPayload, validateWorkloadUpdatePayload } = require('../validators/workloadValidators');

// Specific sub-paths before parameterized paths
router.get('/summary', workloadController.getWorkloadSummary);
router.get('/discrepancies', workloadController.getWorkloadDiscrepancies);
router.get('/incomplete', workloadController.getWorkloadIncomplete);

// General list & ID lookup
router.get('/', workloadController.getWorkloadList);
router.get('/:facultyId/allocations', workloadController.getFacultyAllocations);
router.get('/:facultyId', workloadController.getWorkloadById);

// Mutations protected by HOD / ADMIN
router.post(
  '/',
  authenticateUser,
  requireRole('HOD', 'ADMIN'),
  validate(validateWorkloadPayload),
  workloadController.createWorkload
);

router.put(
  '/:facultyId',
  authenticateUser,
  requireRole('HOD', 'ADMIN'),
  validate(validateWorkloadUpdatePayload),
  workloadController.updateWorkload
);

router.delete(
  '/:facultyId',
  authenticateUser,
  requireRole('HOD', 'ADMIN'),
  workloadController.deleteWorkload
);

module.exports = router;
