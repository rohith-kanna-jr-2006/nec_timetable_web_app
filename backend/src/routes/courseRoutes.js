const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', courseController.getCourses);
router.get('/:courseCode', courseController.getCourseByCode);
router.post('/', authenticateUser, requireRole('HOD', 'AC', 'ADMIN'), courseController.createCourse);
router.put('/:courseCode', authenticateUser, requireRole('HOD', 'AC', 'ADMIN'), courseController.updateCourse);
router.delete('/:courseCode', authenticateUser, requireRole('HOD', 'ADMIN'), courseController.deleteCourse);

module.exports = router;
