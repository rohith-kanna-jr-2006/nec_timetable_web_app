const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.get('/', authenticateUser, notificationController.getNotifications);
router.post('/', authenticateUser, notificationController.postNotification);
router.patch('/read-all', authenticateUser, notificationController.markAllNotificationsRead);
router.patch('/:id/read', authenticateUser, notificationController.markNotificationRead);

module.exports = router;
