import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getClassTimetable } from '../../services/timetableService';
import { getAcademicContexts } from '../../services/academicContextService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import { WEEK_DAYS, PERIOD_TIMINGS } from '../../constants/schedule';

/**
 * Class Timetable View
 * Perspective: Class / Section
 * Displays timetable for the cohort associated through Class Advisor assignment or selected cohort context.
 */
export default function ClassTimetablePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contexts, setContexts] = useState([]);
  const [selectedContextId, setSelectedContextId] = useState('');
  const [timetableMatrix, setTimetableMatrix] = useState({});
  const [totalSessions, setTotalSessions] = useState(0);

  // Load cohort contexts
  useEffect(() => {
    async function initContexts() {
      try {
        setLoading(true);
        const res = await getAcademicContexts();
        const list = Array.isArray(res) ? res : res?.data || [];
        setContexts(list);

        if (list.length > 0) {
          setSelectedContextId(list[0]._id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('[ClassTimetablePage] Failed to fetch academic contexts:', err);
        setError('Unable to load academic cohorts.');
        setLoading(false);
      }
    }
    initContexts();
  }, []);

  // Load timetable matrix when selected cohort changes
  useEffect(() => {
    if (!selectedContextId) return;

    async function loadSchedule() {
      try {
        setLoading(true);
        setError(null);
        const res = await getClassTimetable(selectedContextId);
        const sessions = res?.sessions || res?.data?.sessions || [];
        setTotalSessions(sessions.length);

        // Build 2D matrix: [day][period] -> session
        const matrix = {};
        WEEK_DAYS.forEach((d) => {
          matrix[d.code] = {};
        });

        sessions.forEach((s) => {
          const dayCode = (s.day || '').toUpperCase();
          const periodCode = (s.period || '').toUpperCase();
          if (matrix[dayCode]) {
            matrix[dayCode][periodCode] = s;
          }
        });

        setTimetableMatrix(matrix);
      } catch (err) {
        console.error('[ClassTimetablePage] Failed to load schedule:', err);
        setError(err.message || 'Unable to retrieve class schedule matrix.');
        setTimetableMatrix({});
      } finally {
        setLoading(false);
      }
    }

    loadSchedule();
  }, [selectedContextId]);

  const activeContext = contexts.find((c) => c._id === selectedContextId);
  const contextLabel = activeContext
    ? `${activeContext.department || 'CSE'} — Year ${activeContext.year || 'II'} / Sem ${activeContext.semester || 'III'} — Section ${activeContext.section || 'A'}`
    : 'Selected Class';

  return (
    <div>
      <PageHeader
        title="Class Timetable"
        description="Class-centric schedule perspective: viewing complete weekly period allocations for the class cohort associated through Class Advisor assignment."
        breadcrumbs={[
          { label: 'Faculty Portal', path: '/faculty/dashboard' },
          { label: 'Class Timetable' },
        ]}
        badge={<Badge variant="primary">CLASS PERSPECTIVE</Badge>}
        actions={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-outline)' }}>Class Cohort:</span>
            <Select
              value={selectedContextId}
              onChange={(e) => setSelectedContextId(e.target.value)}
              options={contexts.map((c) => ({
                value: c._id,
                label: `${c.department || 'CSE'} Yr ${c.year || ''} Sem ${c.semester || ''} Sec ${c.section || ''} (${c.academicYear || ''})`,
              }))}
              style={{ minWidth: '220px', height: '36px' }}
            />
          </div>
        }
      />

      {/* Class Perspective Context Header */}
      <Card style={{ marginBottom: '20px', padding: '16px 20px', background: 'var(--color-surface-container-low)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
              Perspective: Class / Section Schedule
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
              {contextLabel}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Badge variant="secondary">Total Scheduled: {totalSessions} Periods</Badge>
            {activeContext && <Badge variant="neutral">Academic Year: {activeContext.academicYear || '2025-2026'}</Badge>}
          </div>
        </div>
      </Card>

      {/* Class Timetable Grid */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spinner size="lg" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading class timetable matrix...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={() => setSelectedContextId((id) => id)} />
          </div>
        ) : contexts.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              title="No academic cohorts configured"
              description="Contact the Head of Department to initialize academic cohorts."
            />
          </div>
        ) : (
          <div>
            <div style={{ padding: '8px 14px', fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', background: 'var(--color-surface-container-low)', borderBottom: '1px solid var(--color-surface-container)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>↔️</span>
              <span>Scroll horizontally to view all 7 periods</span>
            </div>
            <div className="ui-table-scroll-container">
              <table style={{ width: '100%', minWidth: '880px', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface-container-low)', borderBottom: '2px solid var(--color-surface-container)' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 700, width: '110px', textAlign: 'left' }}>Day / Period</th>
                    {PERIOD_TIMINGS.map((p) => (
                      <th key={p.period} style={{ padding: '10px 8px', fontWeight: 600, borderLeft: '1px solid var(--color-surface-container)' }}>
                        <div>{p.period}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--color-outline)', marginTop: '2px' }}>
                          {p.timing}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {WEEK_DAYS.map((d) => (
                    <tr key={d.code} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                      <td style={{ padding: '14px', fontWeight: 700, backgroundColor: 'var(--color-surface-container-lowest)', textAlign: 'left', borderRight: '1px solid var(--color-surface-container)' }}>
                        {d.label}
                      </td>
                      {PERIOD_TIMINGS.map((p) => {
                        const session = timetableMatrix[d.code]?.[p.period];
                        return (
                          <td
                            key={p.period}
                            style={{
                              padding: '8px',
                              borderLeft: '1px solid var(--color-surface-container)',
                              height: '76px',
                              verticalAlign: 'middle',
                              backgroundColor: session ? 'rgba(37, 99, 235, 0.04)' : 'transparent',
                            }}
                          >
                            {session ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                                  {session.courseCode}
                                </span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-on-surface)' }}>
                                  {session.courseName || session.title}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--color-outline)' }}>
                                  Faculty: {session.facultyName || session.facultyId || 'Instructor'}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-outline)', fontSize: '0.75rem' }}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
