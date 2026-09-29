import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getFacultyTimetable } from '../../services/timetableService';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import { WEEK_DAYS, PERIOD_TIMINGS } from '../../constants/schedule';

/**
 * Faculty Timetable View
 * Perspective: Individual Faculty
 * Displays personal teaching schedule for the authenticated faculty member based on assigned courses/periods.
 */
export default function FacultyTimetablePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scheduleMatrix, setScheduleMatrix] = useState({});
  const [sessionCount, setSessionCount] = useState(0);

  const facultyId = user?.facultyId || user?.id || 'FAC01';
  const facultyName = user?.name || user?.facultyName || 'Faculty Member';

  // Filter only regular academic periods (excluding standalone breaks)
  const academicPeriods = PERIOD_TIMINGS.filter((p) => Boolean(p.period));

  const loadSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getFacultyTimetable(facultyId);
      const sessions = res?.sessions || res?.data?.sessions || [];
      setSessionCount(sessions.length);

      // Build 2D matrix: [dayId][periodCode] -> session
      const matrix = {};
      WEEK_DAYS.forEach((d) => {
        matrix[d.id] = {};
      });

      sessions.forEach((s) => {
        const dayId = (s.day || '').toUpperCase();
        const periodCode = (s.period || '').toUpperCase();
        if (matrix[dayId]) {
          matrix[dayId][periodCode] = s;
        }
      });

      setScheduleMatrix(matrix);
    } catch (err) {
      console.error('[FacultyTimetablePage] Failed to fetch personal schedule:', err);
      setError(err.message || 'Unable to load your personal teaching timetable.');
      setScheduleMatrix({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, [facultyId]);

  return (
    <div>
      <PageHeader
        title="Faculty Timetable"
        description="Individual teaching schedule perspective: viewing assigned courses, classes, sections, and room allocations across the 7-period weekly timetable."
        breadcrumbs={[
          { label: 'Faculty Portal', path: '/faculty/dashboard' },
          { label: 'Faculty Timetable' },
        ]}
        badge={<Badge variant="secondary">INDIVIDUAL FACULTY PERSPECTIVE</Badge>}
        actions={
          <Button variant="outline" size="sm" icon="🔄" onClick={loadSchedule}>
            Refresh Schedule
          </Button>
        }
      />

      {/* Individual Perspective Context Header */}
      <Card style={{ marginBottom: '20px', padding: '16px 20px', background: 'var(--color-surface-container-low)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
              Perspective: Individual Teaching Assignment
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
              {facultyName} ({facultyId})
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Badge variant="primary">Assigned: {sessionCount} Periods / Week</Badge>
            <Badge variant="neutral">Department: {user?.department || 'Computer Science & Engineering'}</Badge>
          </div>
        </div>
      </Card>

      {/* Faculty 7-Period Weekly Teaching Grid */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spinner size="lg" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading your teaching schedule...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadSchedule} />
          </div>
        ) : sessionCount === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              title="No teaching sessions allocated"
              description="You currently have no scheduled course sessions in the published departmental timetable."
            />
          </div>
        ) : (
          <div>
            <div
              style={{
                padding: '8px 14px',
                fontSize: '0.75rem',
                color: 'var(--color-on-surface-variant)',
                background: 'var(--color-surface-container-low)',
                borderBottom: '1px solid var(--color-surface-container)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>↔️</span>
              <span>Scroll horizontally to view all 7 periods</span>
            </div>
            <div className="ui-table-scroll-container">
              <table
                style={{
                  width: '100%',
                  minWidth: '880px',
                  borderCollapse: 'collapse',
                  textAlign: 'center',
                  fontSize: '0.8125rem',
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--color-surface-container-low)',
                      borderBottom: '2px solid var(--color-surface-container)',
                    }}
                  >
                    <th style={{ padding: '12px 14px', fontWeight: 700, width: '110px', textAlign: 'left' }}>
                      Day / Period
                    </th>
                    {academicPeriods.map((p) => (
                      <th
                        key={p.period}
                        style={{
                          padding: '10px 8px',
                          fontWeight: 600,
                          borderLeft: '1px solid var(--color-surface-container)',
                        }}
                      >
                        <div>{p.period}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--color-outline)', marginTop: '2px' }}>
                          {p.label || `${p.startTime} – ${p.endTime}`}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {WEEK_DAYS.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                      <td
                        style={{
                          padding: '14px',
                          fontWeight: 700,
                          backgroundColor: 'var(--color-surface-container-lowest)',
                          textAlign: 'left',
                          borderRight: '1px solid var(--color-surface-container)',
                        }}
                      >
                        {d.label}
                      </td>
                      {academicPeriods.map((p) => {
                        const session = scheduleMatrix[d.id]?.[p.period];
                        const isLab = session?.sessionType === 'LAB';
                        return (
                          <td
                            key={p.period}
                            style={{
                              padding: '8px',
                              borderLeft: '1px solid var(--color-surface-container)',
                              height: '76px',
                              verticalAlign: 'middle',
                              backgroundColor: session
                                ? isLab
                                  ? 'rgba(234, 179, 8, 0.08)'
                                  : 'rgba(16, 185, 129, 0.05)'
                                : 'transparent',
                            }}
                          >
                            {session ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: isLab ? 'var(--color-warning)' : 'var(--color-primary)',
                                  }}
                                >
                                  {session.courseCode}
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    color: 'var(--color-on-surface)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={session.courseName || session.title}
                                >
                                  {session.courseName || session.title}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--color-outline)' }}>
                                  Class: {session.year ? `Yr ${session.year}` : ''}{' '}
                                  {session.section ? `Sec ${session.section}` : session.room || 'Classroom'}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-outline)', fontSize: '0.75rem' }}>FREE</span>
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
