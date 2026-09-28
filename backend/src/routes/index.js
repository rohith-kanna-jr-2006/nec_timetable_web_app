const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const facultyRoutes = require('./facultyRoutes');
const workloadRoutes = require('./workloadRoutes');
const courseRoutes = require('./courseRoutes');
const courseFacultyHandlerRoutes = require('./courseFacultyHandlerRoutes');
const academicContextRoutes = require('./academicContextRoutes');
const classAdvisorRoutes = require('./classAdvisorRoutes');
const hodAllocationRoutes = require('./hodAllocationRoutes');
const timetableRoutes = require('./timetableRoutes');
const notificationRoutes = require('./notificationRoutes');
const availabilityRoutes = require('./availabilityRoutes');
const absenceRoutes = require('./absenceRoutes');
const substituteRoutes = require('./substituteRoutes');

/**
 * Health Check Endpoint
 * GET /api/health
 */
router.get('/health', (req, res) => {
  return res.status(200).json({
    success: true,
    service: 'nec-faculty-backend',
  });
});

// Mount domain routes
router.use('/auth', authRoutes);
router.use('/faculty', facultyRoutes);
router.use('/workload', workloadRoutes);
router.use('/courses', courseRoutes);
router.use('/course-faculty-handlers', courseFacultyHandlerRoutes);
router.use('/academic-contexts', academicContextRoutes);
router.use('/class-advisors', classAdvisorRoutes);
router.use('/hod-allocations', hodAllocationRoutes);
router.use('/timetable', timetableRoutes);
router.use('/notifications', notificationRoutes);
router.use('/availability', availabilityRoutes);
router.use('/absences', absenceRoutes);
router.use('/substitutes', substituteRoutes);

module.exports = router;
