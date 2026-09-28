const Notification = require('../models/Notification');

/**
 * Creates and saves an in-app notification.
 */
async function createNotification({ recipientUserId, type, title, message, relatedEntity, relatedEntityId }) {
  return Notification.create({
    recipientUserId,
    type,
    title,
    message,
    relatedEntity,
    relatedEntityId,
    isRead: false,
  });
}

/**
 * Marks notification as read.
 */
async function markAsRead(notificationId, userId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, recipientUserId: userId },
    { isRead: true },
    { new: true }
  );
}

/**
 * Marks all notifications as read for a user.
 */
async function markAllAsRead(userId) {
  return Notification.updateMany(
    { recipientUserId: userId, isRead: false },
    { isRead: true }
  );
}

module.exports = {
  createNotification,
  markAsRead,
  markAllAsRead,
};
