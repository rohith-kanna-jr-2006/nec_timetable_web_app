import React, { useState, useEffect, useCallback } from 'react';
import { getAcademicContexts } from '../../services/academicContextService';
import { getClassTimetable, groupSessionsByDay, calculateTimetableMetrics } from '../../services/timetableService';
import { WEEK_DAYS, PERIOD_TIMINGS } from '../../constants/schedule';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

export default function TimetableReviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contexts, setContexts] = useState([]);
  const [selectedContextId, setSelectedContextId] = useState('');
  const [sessions, setSessions] = useState([]);

  // Load contexts
  useEffect(() => {
    async function loadContexts() {
      try {
        const res = await getAcademicContexts();
        const list = Array.isArray(res) ? res : res?.data || [];
        setContexts(list);
        if (list.length > 0) {
          const defaultCtx = list.find((c) => c.year === 'III Year' && c.section === 'A') || list[0];
          setSelectedContextId(defaultCtx._id);
        }
      } catch (err) {
        console.warn('[TimetableReviewPage] Could not load contexts:', err);
      }
    }
    loadContexts();
  }, []);

  const loadSchedule = useCallback(async () => {
    if (!selectedContextId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getClassTimetable(selectedContextId);
      setSessions(res.sessions || []);
    } catch (err) {
      console.error('[TimetableReviewPage] Failed to fetch schedule:', err);
      setError(err.message || 'Unable to load class timetable.');
    } finally {
      setLoading(false);
    }
  }, [selectedContextId]);

  useEffect(() => {
    if (selectedContextId) {
      loadSchedule();
    }
  }, [selectedContextId, loadSchedule]);

  const activeCtx = contexts.find((c) => c._id === selectedContextId);
  const grouped = groupSessionsByDay(sessions);
  const metrics = calculateTimetableMetrics(sessions);
  const periods = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];

  return (
    <div>
      <PageHeader
        title="Class Timetable Review Matrix"
        description="Comprehensive master grid review across all Computer Science & Engineering classes before executive ratification."
        breadcrumbs={[
          { label: 'HOD Portal', path: '/hod/dashboard' },
          { label: 'Timetable Review' },
        ]}
        badge={
          <Badge variant="primary">
            {activeCtx ? `${activeCtx.department} • ${activeCtx.year} '${activeCtx.section}'` : 'CLASS TIMETABLE'}
          </Badge>
        }
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <label htmlFor="hod-review-context-select" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Cohort:</label>
            <select
              id="hod-review-context-select"
              value={selectedContextId}
              onChange={(e) => setSelectedContextId(e.target.value)}
              className="form-select form-select-sm"
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-outline-variant)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--color-primary)',
                background: '#ffffff',
              }}
            >
              {contexts.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.department || 'CSE'} - {c.year} &apos;{c.section}&apos; ({c.academicYear})
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" icon="🖨️" onClick={() => window.print()}>
              Print Grid
            </Button>
            <Button variant="primary" size="sm" icon="🔄" onClick={loadSchedule}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* Grid Card */}
      <Card style={{ padding: '20px', marginBottom: '24px' }}>
        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spinner size="lg" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading master timetable grid...
            </div>
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={loadSchedule} />
        ) : sessions.length === 0 ? (
          <EmptyState
            title="No scheduled timetable sessions"
            description="No draft or published sessions are currently mapped for this class."
          />
        ) : (
          <div className="ui-timetable-scroll-container">
            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', borderBottom: '2px solid var(--color-border-subtle)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, width: '100px' }}>Day</th>
                  {periods.map((p) => {
                    const timing = PERIOD_TIMINGS.find((t) => t.period === p);
                    return (
                      <th key={p} style={{ padding: '10px 8px', fontWeight: 700 }}>
                        <div>{p}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--color-outline)' }}>
                          {timing ? `${timing.startTime} - ${timing.endTime}` : ''}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {WEEK_DAYS.map((day) => {
                  const daySessions = grouped[day.id] || [];
                  const sessionMap = {};
                  daySessions.forEach((s) => {
                    sessionMap[s.period] = s;
                  });

                  return (
                    <tr key={day.id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                      <td style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-primary)', backgroundColor: 'var(--color-surface-container-lowest)' }}>
                        {day.label}
                      </td>
                      {periods.map((period) => {
                        const s = sessionMap[period];
                        if (!s) {
                          return (
                            <td key={period} style={{ padding: '10px 4px', color: 'var(--color-outline)', backgroundColor: 'transparent' }}>
                              —
                            </td>
                          );
                        }

                        const isLab = s.sessionType === 'LAB';
                        return (
                          <td
                            key={period}
                            style={{
                              padding: '8px 4px',
                              backgroundColor: isLab ? 'rgba(234, 179, 8, 0.08)' : 'rgba(37, 99, 235, 0.06)',
                            }}
                          >
                            <div style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: `1px solid ${isLab ? 'rgba(234, 179, 8, 0.25)' : 'rgba(37, 99, 235, 0.2)'}` }}>
                              <div style={{ fontWeight: 700, color: isLab ? 'var(--color-warning)' : 'var(--color-primary)' }}>
                                {s.courseCode}
                              </div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 500, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.courseName}>
                                {s.courseName}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
                                Room: {s.room || 'TBD'} • {s.facultyId}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
