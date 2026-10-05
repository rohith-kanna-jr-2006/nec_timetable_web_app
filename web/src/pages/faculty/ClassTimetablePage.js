import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getClassTimetable, getPublishedClassTimetable, getSessionFacultyList } from '../../services/timetableService';
import { getAcademicContexts } from '../../services/academicContextService';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const queryContextId = searchParams.get('academicContextId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contexts, setContexts] = useState([]);
  const [selectedContextId, setSelectedContextId] = useState(queryContextId || '');
  const [timetableMatrix, setTimetableMatrix] = useState({});
  const [totalSessions, setTotalSessions] = useState(0);
  const [isPublished, setIsPublished] = useState(true);
  const [publishMessage, setPublishMessage] = useState(null);
  const [gridDays, setGridDays] = useState(WEEK_DAYS);

  // Filter only regular academic periods (excluding standalone breaks)
  const academicPeriods = PERIOD_TIMINGS.filter((p) => Boolean(p.period));

  // Load cohort contexts
  useEffect(() => {
    async function initContexts() {
      try {
        setLoading(true);
        const res = await getAcademicContexts();
        const list = Array.isArray(res) ? res : res?.data || [];
        setContexts(list);

        if (list.length > 0) {
          if (queryContextId && list.some((c) => (c._id || c.id) === queryContextId)) {
            setSelectedContextId(queryContextId);
          } else if (!selectedContextId) {
            setSelectedContextId(list[0]._id || list[0].id);
          }
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
  }, [queryContextId]);

  // Load timetable matrix when selected cohort changes (stale response safe)
  useEffect(() => {
    let isCancelled = false;
    if (!selectedContextId) return;

    async function loadSchedule() {
      try {
        setLoading(true);
        setError(null);
        setTimetableMatrix({});
        setTotalSessions(0);

        // FE-P1-010: Use published-only endpoint for student/faculty class perspective
        const res = await getPublishedClassTimetable(selectedContextId);
        if (isCancelled) return;

        const published = res?.isPublished !== false;
        setIsPublished(published);
        setPublishMessage(res?.message || (published ? null : 'Timetable has not yet been published for this cohort.'));

        const sessions = published ? (res?.sessions || res?.data?.sessions || []) : [];
        setTotalSessions(sessions.length);

        // Build 2D matrix: [dayId][periodCode] -> session
        const matrix = {};
        const daysToInclude = [...WEEK_DAYS];
        const hasSat = sessions.some((s) => (s.day || '').toUpperCase() === 'SAT');
        if (hasSat) {
          daysToInclude.push({ id: 'SAT', label: 'Sat', full: 'Saturday' });
        }
        setGridDays(daysToInclude);

        daysToInclude.forEach((d) => {
          matrix[d.id] = {};
        });

        sessions.forEach((s) => {
          const dayId = (s.day || '').toUpperCase();
          const periodCode = (s.period || '').toUpperCase();
          if (matrix[dayId]) {
            matrix[dayId][periodCode] = s;
          }
        });

        setTimetableMatrix(matrix);
      } catch (err) {
        if (!isCancelled) {
          console.error('[ClassTimetablePage] Failed to load schedule:', err);
          setError(err.message || 'Unable to retrieve class schedule matrix.');
          setTimetableMatrix({});
          setTotalSessions(0);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadSchedule();
    return () => {
      isCancelled = true;
    };
  }, [selectedContextId]);

  const activeContext = contexts.find((c) => (c._id || c.id) === selectedContextId);
  const contextLabel = activeContext
    ? `${activeContext.department || 'CSE'} — Year ${activeContext.year || 'II'} / Sem ${activeContext.semester || 'III'} — Section ${activeContext.section || 'A'}`
    : 'Selected Class';

  const handleContextChange = (e) => {
    const nextId = e.target.value;
    setSelectedContextId(nextId);
    if (nextId) {
      setSearchParams({ academicContextId: nextId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  return (
    <div>
      <PageHeader
        title="Class Timetable"
        description="Official published schedule: viewing complete weekly period allocations for the selected class cohort."
        breadcrumbs={[
          { label: 'Faculty Portal', path: '/faculty/dashboard' },
          { label: 'Class Timetable' },
        ]}
        badge={<Badge variant={isPublished ? 'success' : 'warning'}>{isPublished ? 'PUBLISHED' : 'UNPUBLISHED'}</Badge>}
        actions={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Select
              id="class-cohort-select"
              label="Class Cohort"
              value={selectedContextId}
              onChange={handleContextChange}
              options={contexts.map((c) => ({
                value: c._id || c.id,
                label: `${c.department || 'CSE'} Yr ${c.year || ''} Sem ${c.semester || ''} Sec ${c.section || ''} (${c.academicYear || ''})`,
              }))}
              style={{ minWidth: '240px', height: '36px' }}
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
        ) : !isPublished || totalSessions === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              title={!isPublished ? 'Timetable Not Published' : 'No scheduled sessions'}
              description={publishMessage || 'No published sessions are currently mapped for this class cohort.'}
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
                  {gridDays.map((d) => (
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
                        const session = timetableMatrix[d.id]?.[p.period];
                        const isLab = session?.sessionType === 'LAB';
                        const facultyList = getSessionFacultyList(session);

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
                                  : 'rgba(37, 99, 235, 0.04)'
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
                                {/* All assigned faculty members rendered in single cell */}
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-outline)', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                  {facultyList.length > 0 ? (
                                    facultyList.map((fa, faIdx) => (
                                      <span key={faIdx} title={`${fa.facultyName || fa.facultyId} (${fa.role || 'PRIMARY'})`} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        👤 {fa.facultyName || fa.facultyId}
                                        {fa.role && fa.role !== 'PRIMARY' && (
                                          <span style={{ fontSize: '0.6rem', marginLeft: '4px', opacity: 0.85, fontWeight: 600 }}>[{fa.role}]</span>
                                        )}
                                      </span>
                                    ))
                                  ) : (
                                    <span>👤 Unassigned</span>
                                  )}
                                </div>
                                {session.room && (
                                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-on-surface-variant)' }}>
                                    Room: {session.room}
                                  </span>
                                )}
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
