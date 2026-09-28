const express = require('express');
const router = express.Router();
const courseFacultyHandlerController = require('../controllers/courseFacultyHandlerController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', courseFacultyHandlerController.getHandlers);
router.get('/:courseCode', courseFacultyHandlerController.getHandlerByCourse);
router.post('/', authenticateUser, requireRole('AC', 'HOD', 'ADMIN'), courseFacultyHandlerController.createHandler);
router.put('/:courseCode', authenticateUser, requireRole('AC', 'HOD', 'ADMIN'), courseFacultyHandlerController.updateHandler);
router.delete('/:courseCode', authenticateUser, requireRole('AC', 'HOD', 'ADMIN'), courseFacultyHandlerController.deleteHandler);

module.exports = router;
