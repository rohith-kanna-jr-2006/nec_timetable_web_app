import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getFacultyTimetable,
  getCurrentDayId,
  getCurrentPeriodStatus,
  calculateTimetableMetrics,
} from '../../services/timetableService';
import { getWorkloadByFaculty } from '../../services/workloadService';
import { getNotifications } from '../../services/notificationService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [workload, setWorkload] = useState(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  const facultyId = user?.facultyId || 'FWL-03';
  const facultyName = user?.name || 'Faculty Member';
  const todayId = getCurrentDayId();
  const currentPeriod = getCurrentPeriodStatus();

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      setIsLoading(true);
      try {
        const [ttRes, wlRes, notifRes] = await Promise.allSettled([
          getFacultyTimetable(facultyId),
          getWorkloadByFaculty(facultyId),
          getNotifications(),
        ]);

        if (isMounted) {
          if (ttRes.status === 'fulfilled' && ttRes.value) {
            setSessions(ttRes.value.sessions || []);
          }
          if (wlRes.status === 'fulfilled' && wlRes.value) {
            setWorkload(wlRes.value);
          }
          if (notifRes.status === 'fulfilled' && notifRes.value) {
            setUnreadAlerts(notifRes.value.unreadCount || 0);
          }
        }
      } catch (err) {
        console.warn('[FacultyDashboard] Error loading dashboard data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [facultyId]);

  const todaySessions = sessions.filter((s) => s.day === todayId);
  const metrics = calculateTimetableMetrics(sessions);
  const totalHours =
    workload?.calculatedTotalHours ??
    workload?.summary?.totalHours ??
    metrics.totalContactPeriods;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${facultyName}`}
        description={`Faculty ID: ${facultyId} • Department of Computer Science & Engineering • Academic Term: Odd 2024-25`}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Faculty Portal', path: '/faculty/dashboard' },
              { label: 'Dashboard' },
            ]}
          />
        }
        badge={<Badge variant="primary">FACULTY PORTAL</Badge>}
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              icon="🗓️"
              onClick={() => navigate('/faculty/timetable')}
            >
              My Timetable
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="📅"
              onClick={() => navigate('/faculty/weekly-timetable')}
            >
              Weekly Matrix
            </Button>
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
            TODAY&apos;S SCHEDULE ({todayId})
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
            {todaySessions.length} {todaySessions.length === 1 ? 'Period' : 'Periods'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
            {currentPeriod.isActive
              ? `Current: ${currentPeriod.name} (${currentPeriod.label})`
              : 'Outside active lecture hours'}
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
            WEEKLY TEACHING LOAD
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
            {totalHours} <span style={{ fontSize: '1rem', fontWeight: 500 }}>hrs/wk</span>
          </div>
          <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            <Badge variant={totalHours >= 16 ? 'success' : 'neutral'}>
              {totalHours >= 16 ? 'Norm Compliant (>= 16 hrs)' : 'Below 16 hrs Norm'}
            </Badge>
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
            SCHEDULE MATRIX
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
            {sessions.length} Slots
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
            Across {metrics.daysCount || 5} instructional working days
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
            UNREAD ALERTS
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: unreadAlerts > 0 ? 'var(--color-error)' : 'var(--color-primary)', marginTop: '4px' }}>
            {unreadAlerts}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
            {unreadAlerts > 0 ? 'Requires your attention' : 'All caught up'}
          </div>
        </Card>
      </div>

      {/* Main Grid: Today's Classes & Quick Actions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: '20px',
        }}
      >
        {/* Today's Schedule Card */}
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              Today&apos;s Lectures & Labs
            </h3>
            <Badge variant="primary">{todayId}</Badge>
          </div>

          {isLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <Spinner size="md" />
            </div>
          ) : todaySessions.length === 0 ? (
            <EmptyState
              title="No classes scheduled today"
              description="You have no instructional teaching sessions or laboratories assigned for today."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/faculty/weekly-timetable')}
                >
                  View Full Week
                </Button>
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {todaySessions
                .sort((a, b) => (a.period || '').localeCompare(b.period || ''))
                .map((s, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-surface-container-low)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                          {s.period}
                        </span>
                        <Badge variant={s.sessionType === 'LAB' ? 'warning' : 'primary'}>
                          {s.sessionType || 'THEORY'}
                        </Badge>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '4px' }}>
                        {s.courseName || s.courseCode}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                        Room: {s.room || 'TBD'} • Class: {s.academicContextId?.year || 'CSE'} {s.academicContextId?.section ? `'${s.academicContextId.section}'` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--color-outline)' }}>
                      {s.courseCode}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>

        {/* Quick Operations & Workload Overview */}
        <Card style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Quick Operations
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              type="button"
              onClick={() => navigate('/faculty/timetable')}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 12px',
                textAlign: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🗓️</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>My Timetable</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/faculty/weekly-timetable')}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 12px',
                textAlign: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>📅</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Weekly Matrix</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/faculty/workload')}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 12px',
                textAlign: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>⚖️</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Workload Norms</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/faculty/availability')}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 12px',
                textAlign: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🕒</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Slot Preferences</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/faculty/absence')}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 12px',
                textAlign: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>📝</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Report Absence</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/faculty/notifications')}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 12px',
                textAlign: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🔔</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Notifications</span>
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
