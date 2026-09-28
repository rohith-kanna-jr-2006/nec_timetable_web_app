const Notification = require('../models/Notification');
const { createNotification, markAsRead, markAllAsRead } = require('../services/notificationService');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Get user notifications
 * GET /api/notifications
 */
async function getNotifications(req, res, next) {
  try {
    const userId = req.user ? req.user.email || req.user._id.toString() : req.query.recipientUserId;
    if (!userId) {
      return errorResponse(res, 'User identity missing', 400, 'BAD_REQUEST');
    }

    const { isRead } = req.query;
    const query = { recipientUserId: userId };
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ recipientUserId: userId, isRead: false });

    return successResponse(res, { unreadCount, notifications });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new notification
 * POST /api/notifications
 */
async function postNotification(req, res, next) {
  try {
    const { recipientUserId, type, title, message, relatedEntity, relatedEntityId } = req.body;

    const notification = await createNotification({
      recipientUserId,
      type,
      title,
      message,
      relatedEntity,
      relatedEntityId,
    });

    return successResponse(res, notification, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Mark notification as read
 * PATCH /api/notifications/:id/read
 */
async function markNotificationRead(req, res, next) {
  try {
    const userId = req.user ? req.user.email || req.user._id.toString() : req.query.recipientUserId;
    const notification = await markAsRead(req.params.id, userId);

    if (!notification) {
      return errorResponse(res, 'Notification not found or unauthorized', 404, 'NOT_FOUND');
    }

    return successResponse(res, notification);
  } catch (error) {
    next(error);
  }
}

/**
 * Mark all notifications as read
 * PATCH /api/notifications/read-all
 */
async function markAllNotificationsRead(req, res, next) {
  try {
    const userId = req.user ? req.user.email || req.user._id.toString() : req.query.recipientUserId;
    await markAllAsRead(userId);

    return successResponse(res, { message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getNotifications,
  postNotification,
  markNotificationRead,
  markAllNotificationsRead,
};
