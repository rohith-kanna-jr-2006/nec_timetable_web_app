/**
 * Notification Service for Web Application
 * Handles API calls for /api/notifications endpoints.
 */

import { api } from './api.js';

/**
 * Fetch user notifications
 * GET /api/notifications
 */
export async function getNotifications(params = {}) {
  const query = new URLSearchParams();
  if (params.isRead !== undefined) query.append('isRead', params.isRead);
  if (params.recipientUserId) query.append('recipientUserId', params.recipientUserId);

  const qs = query.toString();
  const endpoint = `/notifications${qs ? `?${qs}` : ''}`;
  const response = await api.get(endpoint);
  return response?.data || response;
}

/**
 * Create a new notification
 * POST /api/notifications
 */
export async function createNotification(payload) {
  const response = await api.post('/notifications', payload);
  return response?.data || response;
}

/**
 * Mark notification as read
 * PATCH /api/notifications/:id/read
 */
export async function markNotificationRead(id) {
  const response = await api.patch(`/notifications/${encodeURIComponent(id)}/read`, {});
  return response?.data || response;
}

/**
 * Mark all notifications read
 * PATCH /api/notifications/read-all
 */
export async function markAllNotificationsRead() {
  const response = await api.patch('/notifications/read-all', {});
  return response?.data || response;
}

export default {
  getNotifications,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
};
