import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAcademicContexts } from '../../services/academicContextService';
import {
  getClassTimetable,
  getTimetableVersions,
  getReviewMatrix,
  groupSessionsByDay,
  getSessionFacultyList,
  calculateTimetableMetrics,
} from '../../services/timetableService';
import { submitTimetableForApproval } from '../../services/coordinatorService';
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
const TC_ROLE_NAME = 'TimeTable Coordinator (TC)';

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
  const facultyList = getSessionFacultyList(session);

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
        {/* Faculty Assignments (all displayed in single cell, no duplicate cells) */}
        <div style={{ fontSize: '0.65rem', color: 'var(--color-on-surface-variant)', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
          {facultyList.length > 0 ? (
            facultyList.map((fa, faIdx) => (
              <div
                key={faIdx}
                style={{ display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                title={`${fa.facultyName || fa.facultyId} (${fa.role || 'PRIMARY'})`}
              >
                <span style={{ fontSize: '0.6rem' }}>👤</span>
                <span style={{ fontWeight: 600 }}>{fa.facultyName || fa.facultyId}</span>
                {fa.role && fa.role !== 'PRIMARY' && (
                  <span style={{
                    fontSize: '0.55rem',
                    padding: '1px 3px',
                    borderRadius: '2px',
                    backgroundColor: 'var(--color-surface-container-high)',
                    color: 'var(--color-outline)',
                    fontWeight: 700,
                  }}>
                    {fa.role}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              👤 Unassigned
            </div>
          )}
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
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contexts, setContexts] = useState([]);
  const [selectedContextId, setSelectedContextId] = useState(paramContextId || '');
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(paramVersionId || '');
  const [selectedClassId, setSelectedClassId] = useState(paramClassId || '');
  const [sessions, setSessions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewSummary, setReviewSummary] = useState(null);

  // Load available academic contexts
  useEffect(() => {
    async function loadContexts() {
      try {
        const res = await getAcademicContexts();
        const list = Array.isArray(res) ? res : res?.data || [];
        setContexts(list);

        if (list.length > 0) {
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

  // Load available timetable versions scoped by academic context
  const loadVersions = useCallback(async () => {
    try {
      const params = selectedContextId ? { academicContextId: selectedContextId } : {};
      const res = await getTimetableVersions(params);
      const list = Array.isArray(res) ? res : res?.data || [];
      setVersions(list);

      if (paramVersionId && list.some((v) => (v._id || v.id) === paramVersionId)) {
        setSelectedVersionId(paramVersionId);
      } else if (list.length > 0 && !selectedVersionId) {
        setSelectedVersionId(list[0]._id || list[0].id);
      }
    } catch (err) {
      console.warn('[TimetableReviewPage] Could not load timetable versions:', err);
    }
  }, [selectedContextId, paramVersionId, selectedVersionId]);

  useEffect(() => {
    loadVersions();
  }, [selectedContextId]);

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
    setSelectedVersionId('');
    updateFilterParams(ctxId, '');
  };

  const handleVersionChange = (verId) => {
    setSelectedVersionId(verId);
    setSessions([]);
    updateFilterParams(selectedContextId, verId);
  };

  // Fetch schedule with stale-request prevention
  useEffect(() => {
    let isCancelled = false;

    async function fetchTimetable() {
      if (!selectedContextId) return;
      try {
        setLoading(true);
        setError(null);
        // Clear previous sessions immediately to prevent cross-context flicker
        setSessions([]);

        const [res, matrixRes] = await Promise.all([
          getClassTimetable(selectedContextId, selectedVersionId || null),
          getReviewMatrix({ academicContextId: selectedContextId, ...(selectedVersionId ? { versionId: selectedVersionId } : {}) }).catch(() => null),
        ]);

        if (!isCancelled) {
          const sessionList = res?.sessions || res?.data?.sessions || [];
          setSessions(sessionList);
          if (matrixRes && matrixRes.summary) {
            setReviewSummary(matrixRes.summary);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[TimetableReviewPage] Failed to fetch schedule:', err);
          setError(err.message || 'Unable to load class timetable.');
          setSessions([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchTimetable();

    return () => {
      isCancelled = true;
    };
  }, [selectedContextId, selectedVersionId]);

  const handleSubmitForApproval = async () => {
    const targetVerId = selectedVersionId || (versions[0]?._id || versions[0]?.id);
    if (!targetVerId) {
      showToast('Please select a timetable version to submit for approval.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      await submitTimetableForApproval(targetVerId);
      showToast('Timetable successfully submitted for HOD approval!', 'success');
      await loadVersions();
    } catch (err) {
      console.error('[TimetableReviewPage] Submit for approval failed:', err);
      showToast(err.message || 'Failed to submit timetable for HOD approval.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCtx = contexts.find((c) => (c._id || c.id) === selectedContextId);
  const activeVer = versions.find((v) => (v._id || v.id) === selectedVersionId) || versions[0];
  const grouped = groupSessionsByDay(sessions);
  const metrics = calculateTimetableMetrics(sessions);
  const periods = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];

  const displayDays = [...WEEK_DAYS];
  if (grouped.SAT && grouped.SAT.length > 0) {
    displayDays.push({ id: 'SAT', label: 'Sat', full: 'Saturday' });
  }

  const isCoordinator = portalType === 'Coordinator';
  const isHOD = portalType === 'HOD';
  const pageTitle = isHOD ? 'Class Timetable Review Matrix' : isCoordinator ? 'Timetable Review' : 'Timetable Review';
  const pageDescription = isCoordinator
    ? 'Review generated timetable sessions across Computer Science & Engineering classes before final publication.'
    : isHOD
    ? 'Comprehensive master grid review across all Computer Science & Engineering classes before executive ratification.'
    : 'Review timetable sessions across Computer Science & Engineering classes.';
  const breadcrumbs = isCoordinator
    ? [
        { label: 'Coordinator Portal', path: '/coordinator/dashboard' },
        { label: 'Timetable Design', path: '/coordinator/design' },
        { label: 'Timetable Review' },
      ]
    : isHOD
    ? [
        { label: 'HOD Portal', path: '/hod/dashboard' },
        { label: 'Timetable Review' },
      ]
    : [
        { label: 'Timetable Review' },
      ];

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

            {isCoordinator && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  icon="⚡"
                  onClick={() => navigate(`/coordinator/design?academicContextId=${selectedContextId}`)}
                >
                  Timetable Design
                </Button>
                {activeVer && (activeVer.status === 'GENERATED' || activeVer.status === 'DRAFT' || activeVer.status === 'REJECTED') && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon="📨"
                    isLoading={isSubmitting}
                    onClick={handleSubmitForApproval}
                  >
                    Submit to HOD
                  </Button>
                )}
              </>
            )}

            <Button variant="outline" size="sm" icon="🖨️" onClick={() => window.print()}>
              Print Grid
            </Button>
            <Button variant="primary" size="sm" icon="🔄" onClick={() => loadVersions()}>
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
            {activeVer && (
              <Badge variant={activeVer.status === 'PUBLISHED' ? 'success' : activeVer.status === 'APPROVED' ? 'primary' : activeVer.status === 'PENDING_HOD_APPROVAL' ? 'warning' : 'neutral'}>
                {activeVer.status || 'DRAFT'} ({activeVer.versionLabel || activeVer._id})
              </Badge>
            )}
            {reviewSummary && (
              <Badge variant="secondary">
                Matrix Sessions: {reviewSummary.sessionCount || reviewSummary.totalSessions || sessions.length}
              </Badge>
            )}
            {metrics.hardConflicts > 0 ? (
              <Badge variant="error">{metrics.hardConflicts} Conflicts</Badge>
            ) : (
              <Badge variant="success">0 Conflicts</Badge>
            )}
          </div>
        </div>
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
            <ErrorState message={error} onRetry={() => loadVersions()} />
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
                {displayDays.map((day) => {
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
                        return <SessionCell key={period} session={s} />;
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
