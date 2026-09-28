import React, { useState, useEffect } from 'react';
import { getAcademicContexts } from '../../services/academicContextService';
import { getClassTimetable } from '../../services/timetableService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';

export default function ConflictDetectionPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [auditedSlotsCount, setAuditedSlotsCount] = useState(0);

  const runAudit = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch contexts
      const contextsRes = await getAcademicContexts();
      const contexts = Array.isArray(contextsRes) ? contextsRes : contextsRes?.data || [];

      // 2. Fetch class schedules for all contexts
      const allSessions = [];
      for (const ctx of contexts) {
        try {
          const res = await getClassTimetable(ctx._id);
          const list = res.sessions || [];
          list.forEach((s) => allSessions.push({ ...s, contextInfo: `${ctx.year} '${ctx.section}'` }));
        } catch {
          // continue
        }
      }

      setAuditedSlotsCount(allSessions.length);

      // 3. Detect collisions:
      // Group by day-period-facultyId
      // Group by day-period-room
      const detected = [];
      const facultySlots = {};
      const roomSlots = {};

      allSessions.forEach((s) => {
        if (!s.day || !s.period) return;

        // Faculty collision check
        if (s.facultyId) {
          const key = `${s.day}-${s.period}-${s.facultyId}`;
          if (!facultySlots[key]) facultySlots[key] = [];
          facultySlots[key].push(s);
        }

        // Room collision check
        if (s.room) {
          const key = `${s.day}-${s.period}-${s.room}`;
          if (!roomSlots[key]) roomSlots[key] = [];
          roomSlots[key].push(s);
        }
      });

      // Audit faculty collisions
      Object.entries(facultySlots).forEach(([key, items]) => {
        if (items.length > 1) {
          const [day, period, fId] = key.split('-');
          detected.push({
            id: key,
            type: 'FACULTY_DOUBLE_BOOKING',
            entity: `Faculty Member: ${fId}`,
            day,
            period,
            description: `Assigned concurrently to ${items.length} classes: ${items.map((i) => `${i.contextInfo} (${i.courseCode})`).join(', ')}`,
            severity: 'CRITICAL',
          });
        }
      });

      // Audit room collisions
      Object.entries(roomSlots).forEach(([key, items]) => {
        if (items.length > 1) {
          const [day, period, room] = key.split('-');
          detected.push({
            id: key,
            type: 'ROOM_COLLISION',
            entity: `Venue: ${room}`,
            day,
            period,
            description: `Room occupied concurrently by ${items.length} classes: ${items.map((i) => `${i.contextInfo} (${i.courseCode})`).join(', ')}`,
            severity: 'HIGH',
          });
        }
      });

      setConflicts(detected);
    } catch (err) {
      console.error('[ConflictDetectionPage] Audit failed:', err);
      setError(err.message || 'Unable to complete conflict audit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  return (
    <div>
      <PageHeader
        title="Timetable Conflict Detection Audit"
        description="Automated collision audit across faculty schedules, room reservations, and academic cohorts."
        breadcrumbs={[
          { label: 'Coordinator Portal', path: '/coordinator/dashboard' },
          { label: 'Conflict Detection' },
        ]}
        badge={
          <Badge variant={conflicts.length === 0 ? 'success' : 'danger'}>
            {conflicts.length === 0 ? 'ZERO CONFLICTS' : `${conflicts.length} COLLISIONS DETECTED`}
          </Badge>
        }
        actions={
          <Button variant="primary" size="sm" icon="🔍" onClick={runAudit}>
            Rerun Audit
          </Button>
        }
      />

      {/* KPI Cards */}
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
            AUDITED TIMETABLE SLOTS
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
            {auditedSlotsCount} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Periods</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
            Across all active class timetables
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
            HARD CONFLICTS DETECTED
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: conflicts.length > 0 ? 'var(--color-error)' : 'var(--color-success)', marginTop: '4px' }}>
            {conflicts.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
            {conflicts.length === 0 ? 'Optimal scheduling achieved' : 'Requires adjustment'}
          </div>
        </Card>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Collision Audit Log ({conflicts.length})
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spinner size="md" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Executing comprehensive conflict audit...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={runAudit} />
          </div>
        ) : conflicts.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🛡️</div>
            <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-primary)' }}>
              Zero Timetable Collisions Detected
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-on-surface-variant)', marginTop: '6px' }}>
              All faculty members and classrooms are free of double-booking across the {auditedSlotsCount} audited periods.
            </div>
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Severity</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Slot</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Entity</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Conflict Details</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant="danger">{c.severity}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {c.type === 'FACULTY_DOUBLE_BOOKING' ? 'Faculty Double-Booking' : 'Room Collision'}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {c.day} • {c.period}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                      {c.entity}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-error)' }}>
                      {c.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
