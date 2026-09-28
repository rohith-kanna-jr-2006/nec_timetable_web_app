const express = require('express');
const router = express.Router();
const facultyController = require('../controllers/facultyController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { validateFacultyCreationPayload } = require('../validators/facultyCreationValidators');

router.get('/', facultyController.getFacultyList);
router.get('/:facultyId/allocations', facultyController.getFacultyAllocations);
router.get('/:facultyId', facultyController.getFacultyById);
router.post(
  '/',
  authenticateUser,
  requireRole('HOD', 'ADMIN'),
  validate(validateFacultyCreationPayload),
  facultyController.createFaculty
);
router.put('/:facultyId', authenticateUser, requireRole('HOD', 'ADMIN'), facultyController.updateFaculty);
router.delete('/:facultyId', authenticateUser, requireRole('ADMIN'), facultyController.deleteFaculty);

module.exports = router;

