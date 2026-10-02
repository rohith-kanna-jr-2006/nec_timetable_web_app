import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAcademicContexts } from '../../services/academicContextService';
import {
  getClassTimetable,
  getTimetableVersions,
  groupSessionsByDay,
  calculateTimetableMetrics,
} from '../../services/timetableService';
import { transitionTimetableVersion } from '../../services/hodAllocationService';
import { useToast } from '../../context/ToastContext';
import { WEEK_DAYS, PERIOD_TIMINGS } from '../../constants/schedule';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

// TC Role name constant
const TC_ROLE_NAME = 'TimeTable Coordinator';

// ─── Session Cell Component ────────────────────────────────────────────────────
function SessionCell({ session }) {
  if (!session) {
    return (
      <td style={{ padding: '8px 4px', color: 'var(--color-outline)', backgroundColor: 'transparent', minWidth: '100px' }}>
        <span style={{ opacity: 0.4 }}>—</span>
      </td>
    );
  }

  const isLab = session.sessionType === 'LAB';
  const bgColor = isLab ? 'rgba(234, 179, 8, 0.07)' : 'rgba(37, 99, 235, 0.05)';
  const borderColor = isLab ? 'rgba(234, 179, 8, 0.22)' : 'rgba(37, 99, 235, 0.18)';
  const accentColor = isLab ? 'var(--color-warning)' : 'var(--color-primary)';

  return (
    <td style={{ padding: '6px 4px', backgroundColor: bgColor }}>
      <div style={{
        padding: '7px 8px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${borderColor}`,
        height: '100%',
        minHeight: '90px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        gap: '3px',
      }}>
        {/* Course Code */}
        <div style={{ fontWeight: 800, fontSize: '0.75rem', color: accentColor, lineHeight: 1.2 }}>
          {session.courseCode || 'N/A'}
        </div>
        {/* Course Name */}
        <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-on-surface)', lineHeight: 1.3, flexGrow: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {session.courseName || 'Unknown'}
        </div>
        {/* Room */}
        <div style={{ fontSize: '0.65rem', color: 'var(--color-on-surface-variant)', marginTop: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          📍 {session.room || 'TBD'}
        </div>
        {/* Faculty */}
        <div style={{ fontSize: '0.65rem', color: 'var(--color-on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          👤 {session.facultyName ? `${session.facultyName} (${session.facultyId})` : (session.facultyId || 'Unassigned')}
        </div>
      </div>
    </td>
  );
}

export default function TimetableReviewPage({ portalType = 'HOD' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramContextId = searchParams.get('academicContextId');
  const paramVersionId = searchParams.get('versionId');
  const paramClassId = searchParams.get('classId');

  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contexts, setContexts] = useState([]);
  const [selectedContextId, setSelectedContextId] = useState(paramContextId || '');
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(paramVersionId || '');
  const [selectedClassId, setSelectedClassId] = useState(paramClassId || '');
  const [sessions, setSessions] = useState([]);
  const [tcUser, setTcUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  // Load available academic contexts
  useEffect(() => {
    async function loadContexts() {
      try {
        const res = await getAcademicContexts();
        const list = Array.isArray(res) ? res : res?.data || [];
        setContexts(list);

        if (list.length > 0) {
          // If query param matches an existing context, retain it; otherwise select default
          if (paramContextId && list.some((c) => (c._id || c.id) === paramContextId)) {
            setSelectedContextId(paramContextId);
          } else if (!selectedContextId) {
            const defaultCtx = list.find((c) => c.year === 'III Year' && c.section === 'A') || list[0];
            setSelectedContextId(defaultCtx._id || defaultCtx.id);
          }
        }
      } catch (err) {
        console.warn('[TimetableReviewPage] Could not load contexts:', err);
      }
    }
    loadContexts();
  }, [paramContextId]);

  // Load available timetable versions
  useEffect(() => {
    async function loadVersions() {
      try {
        const res = await getTimetableVersions();
        const list = Array.isArray(res) ? res : res?.data || [];
        setVersions(list);

        if (paramVersionId && list.some((v) => (v._id || v.id) === paramVersionId)) {
          setSelectedVersionId(paramVersionId);
        }
      } catch (err) {
        console.warn('[TimetableReviewPage] Could not load timetable versions:', err);
      }
    }
    loadVersions();
  }, [paramVersionId]);

  // Sync state changes with URL query parameters
  const updateFilterParams = useCallback(
    (newContextId, newVersionId) => {
      const nextParams = {};
      if (newContextId) nextParams.academicContextId = newContextId;
      if (newVersionId) nextParams.versionId = newVersionId;
      setSearchParams(nextParams, { replace: true });
    },
    [setSearchParams]
  );

  const handleContextChange = (ctxId) => {
    setSelectedContextId(ctxId);
    setSessions([]);
    updateFilterParams(ctxId, selectedVersionId);
  };

  const handleVersionChange = (verId) => {
    setSelectedVersionId(verId);
    setSessions([]);
    updateFilterParams(selectedContextId, verId);
  };

  // Fetch schedule whenever selected cohort or version changes
  const loadSchedule = useCallback(async () => {
    if (!selectedContextId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getClassTimetable(selectedContextId, selectedVersionId || null);
      const sessionList = res?.sessions || res?.data?.sessions || [];
      setSessions(sessionList);
    } catch (err) {
      console.error('[TimetableReviewPage] Failed to fetch schedule:', err);
      setError(err.message || 'Unable to load class timetable.');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedContextId, selectedVersionId]);

  useEffect(() => {
    if (selectedContextId) {
      loadSchedule();
    }
  }, [selectedContextId, selectedVersionId]);

  const activeCtx = contexts.find((c) => (c._id || c.id) === selectedContextId);
  const activeVer = versions.find((v) => (v._id || v.id) === selectedVersionId);
  const grouped = groupSessionsByDay(sessions);
  const metrics = calculateTimetableMetrics(sessions);
  const periods = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];

  const isCoordinator = portalType === 'Coordinator';
  const pageTitle = 'Class Timetable Review Matrix';
  const pageDescription = isCoordinator
    ? 'Review generated timetable sessions across Computer Science & Engineering classes before final publication.'
    : 'Comprehensive master grid review across all Computer Science & Engineering classes before executive ratification.';
  const breadcrumbs = isCoordinator
    ? [
        { label: 'Coordinator Portal', path: '/coordinator/dashboard' },
        { label: 'Timetable Design', path: '/coordinator/design' },
        { label: 'Timetable Review' },
      ]
    : [
        { label: 'HOD Portal', path: '/hod/dashboard' },
        { label: 'Timetable Review' },
      ];

  const handleSubmitToHOD = async () => {
    if (!activeVer || !activeVer._id) return;
    try {
      setSubmitting(true);
      await transitionTimetableVersion(activeVer._id || activeVer.id, 'PENDING_HOD_APPROVAL');
      showToast('Timetable submitted to HOD successfully.', 'success');
      // Reload versions to reflect status update
      const res = await getTimetableVersions();
      const list = Array.isArray(res) ? res : res?.data || [];
      setVersions(list);
    } catch (err) {
      console.error('[TimetableReviewPage] Submit to HOD failed:', err);
      showToast(err.message || 'Failed to submit timetable to HOD.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        breadcrumbs={breadcrumbs}
        badge={
          <Badge variant="primary">
            {activeCtx
              ? `${activeCtx.department || 'CSE'} • ${activeCtx.year} '${activeCtx.section}'`
              : 'CLASS TIMETABLE'}
          </Badge>
        }
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="hod-review-context-select" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                Cohort:
              </label>
              <select
                id="hod-review-context-select"
                value={selectedContextId}
                onChange={(e) => handleContextChange(e.target.value)}
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
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.department || 'CSE'} - {c.year} &apos;{c.section}&apos; ({c.academicYear || '2025-2026'})
                  </option>
                ))}
              </select>
            </div>

            {versions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label htmlFor="hod-review-version-select" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  Version:
                </label>
                <select
                  id="hod-review-version-select"
                  value={selectedVersionId}
                  onChange={(e) => handleVersionChange(e.target.value)}
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
                  <option value="">Latest Active Version</option>
                  {versions.map((v) => (
                    <option key={v._id || v.id} value={v._id || v.id}>
                      {v.versionLabel || v._id} ({v.status || 'DRAFT'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button variant="outline" size="sm" icon="🖨️" onClick={() => window.print()}>
              Print Grid
            </Button>
            <Button variant="primary" size="sm" icon="🔄" onClick={loadSchedule}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* Context & Metrics Summary Card */}
      <Card style={{ padding: '16px 20px', marginBottom: '20px', backgroundColor: 'var(--color-surface-container-low)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
              Academic Cohort Review
            </div>
            <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
              {activeCtx
                ? `${activeCtx.department || 'CSE'} — Year ${activeCtx.year} / Sem ${activeCtx.semester} — Section ${activeCtx.section}`
                : 'Select Cohort'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge variant="secondary">Total Scheduled: {sessions.length} Periods</Badge>
            {activeVer && <Badge variant="neutral">Version: {activeVer.versionLabel || activeVer._id}</Badge>}
            {metrics.hardConflicts > 0 ? (
              <Badge variant="error">{metrics.hardConflicts} Conflicts</Badge>
            ) : (
              <Badge variant="success">0 Conflicts</Badge>
            )}
          </div>
        </div>

        {isCoordinator && activeVer && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', padding: '12px 16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-on-surface)' }}>Coordinator Actions:</span>
              {activeVer.status === 'GENERATED' && <Badge variant="warning">Generated — Awaiting TC Submission</Badge>}
              {activeVer.status === 'PENDING_HOD_APPROVAL' && <Badge variant="primary">Pending HOD Approval</Badge>}
              {activeVer.status === 'APPROVED' && <Badge variant="success">Approved</Badge>}
              {activeVer.status === 'REJECTED' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <Badge variant="danger">Rejected</Badge>
                  {activeVer.rejectionReason && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-error)' }}>
                      Remarks: {activeVer.rejectionReason}
                    </span>
                  )}
                </div>
              )}
              {activeVer.status === 'PUBLISHED' && <Badge variant="success">Published</Badge>}
            </div>
            <div>
              {activeVer.status === 'GENERATED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmitToHOD}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit to HOD'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Grid Card */}
      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: '24px' }}>
        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spinner size="lg" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading master timetable grid...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadSchedule} />
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              title="No scheduled timetable sessions"
              description="No draft or generated sessions are currently mapped for this cohort in the selected version."
            />
          </div>
        ) : (
          <div className="ui-timetable-scroll-container">
            <table
              style={{
                width: '100%',
                minWidth: '850px',
                borderCollapse: 'collapse',
                textAlign: 'center',
                fontSize: '0.8125rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-surface-container-low)',
                    borderBottom: '2px solid var(--color-border-subtle)',
                  }}
                >
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, width: '100px' }}>Day</th>
                  {periods.map((p) => {
                    const timing = PERIOD_TIMINGS.find((t) => t.period === p);
                    return (
                      <th key={p} style={{ padding: '10px 8px', fontWeight: 700 }}>
                        <div>{p}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--color-outline)' }}>
                          {timing ? timing.label || `${timing.startTime} – ${timing.endTime}` : ''}
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
                      <td
                        style={{
                          padding: '14px 16px',
                          textAlign: 'left',
                          fontWeight: 700,
                          color: 'var(--color-primary)',
                          backgroundColor: 'var(--color-surface-container-lowest)',
                        }}
                      >
                        {day.label}
                      </td>
                      {periods.map((period) => {
                        const s = sessionMap[period];
                        if (!s) {
                          return (
                            <td
                              key={period}
                              style={{
                                padding: '10px 4px',
                                color: 'var(--color-outline)',
                                backgroundColor: 'transparent',
                              }}
                            >
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
                            <div
                              style={{
                                padding: '6px',
                                borderRadius: 'var(--radius-sm)',
                                border: `1px solid ${
                                  isLab ? 'rgba(234, 179, 8, 0.25)' : 'rgba(37, 99, 235, 0.2)'
                                }`,
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 700,
                                  color: isLab ? 'var(--color-warning)' : 'var(--color-primary)',
                                }}
                              >
                                {s.courseCode}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  marginTop: '2px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={s.courseName}
                              >
                                {s.courseName}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.7rem',
                                  color: 'var(--color-on-surface-variant)',
                                  marginTop: '4px',
                                }}
                              >
                                Room: {s.room || 'TBD'} • {s.facultyName ? `${s.facultyName} (${s.facultyId})` : s.facultyId}
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
