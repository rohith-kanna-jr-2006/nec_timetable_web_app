import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/notificationService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

export default function FacultyNotificationsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getNotifications();
      const list = res?.notifications || (Array.isArray(res) ? res : res?.data || []);
      setNotifications(list);
      setUnreadCount(res?.unreadCount ?? list.filter((n) => !n.isRead).length);
    } catch (err) {
      console.error('[FacultyNotificationsPage] Failed to fetch alerts:', err);
      setError(err.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      showToast('Notification marked as read.', 'info');
    } catch (err) {
      showToast(err.message || 'Could not update notification.', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      showToast('All notifications marked as read.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not mark all as read.', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Alerts & Notifications"
        description="Department announcements, schedule modifications, timetable publishing decrees, and leave approvals."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Faculty Portal', path: '/faculty/dashboard' },
              { label: 'Notifications' },
            ]}
          />
        }
        badge={
          <Badge variant={unreadCount > 0 ? 'warning' : 'success'}>
            {unreadCount > 0 ? `${unreadCount} Unread` : 'All Caught Up'}
          </Badge>
        }
        actions={
          unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              icon="✓"
              onClick={handleMarkAllRead}
            >
              Mark All Read
            </Button>
          )
        }
      />

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spinner size="md" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Retrieving institutional alerts...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadNotifications} />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              title="No notifications"
              description="You have no notifications or institutional alerts at this time."
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.map((notif, idx) => (
              <div
                key={notif._id || idx}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  backgroundColor: notif.isRead
                    ? 'transparent'
                    : 'var(--color-surface-container-low)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '14px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {!notif.isRead && (
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--color-primary)',
                        }}
                      />
                    )}
                    <span style={{ fontWeight: notif.isRead ? 600 : 700, fontSize: '0.9375rem' }}>
                      {notif.title || 'System Notification'}
                    </span>
                    <Badge variant={notif.type === 'ALERT' ? 'danger' : 'secondary'}>
                      {notif.type || 'INFO'}
                    </Badge>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
                    {notif.message}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '6px' }}>
                    {notif.createdAt
                      ? new Date(notif.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : 'Just now'}
                  </div>
                </div>

                {!notif.isRead && (
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => handleMarkAsRead(notif._id)}
                  >
                    Mark Read
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
