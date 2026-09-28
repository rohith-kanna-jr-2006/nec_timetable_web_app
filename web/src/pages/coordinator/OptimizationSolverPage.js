import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  createTimetableVersion,
  createTimetableSession,
  submitTimetableForApproval,
} from '../../services/coordinatorService';

import { getTimetableVersions } from '../../services/timetableService';
import { getAcademicContexts } from '../../services/academicContextService';
import { getCourses } from '../../services/courseService';
import { getFacultyList } from '../../services/facultyService';
import { getHODAllocations } from '../../services/hodAllocationService';

import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import Modal from '../../components/common/Modal';

export default function OptimizationSolverPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [versions, setVersions] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [hodAllocations, setHodAllocations] = useState([]);

  // Create Version State
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [versionLabel, setVersionLabel] = useState('v1.0');
  const [selectedContextId, setSelectedContextId] = useState('');

  // Create Session State
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    academicContextId: '',
    day: 'MON',
    period: 'P1',
    courseCode: '',
    facultyId: '',
    room: 'LH-301',
    sessionType: 'THEORY',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [verRes, ctxRes, crsRes, facRes, hodRes] = await Promise.allSettled([
        getTimetableVersions(),
        getAcademicContexts(),
        getCourses(),
        getFacultyList({ limit: 100 }),
        getHODAllocations(),
      ]);

      if (verRes.status === 'fulfilled' && verRes.value) {
        const list = Array.isArray(verRes.value) ? verRes.value : verRes.value.data || [];
        setVersions(list);
      }

      let allocList = [];
      if (hodRes.status === 'fulfilled' && hodRes.value) {
        allocList = Array.isArray(hodRes.value) ? hodRes.value : hodRes.value.data || [];
        setHodAllocations(allocList);
      }

      let ctxList = [];
      if (ctxRes.status === 'fulfilled' && ctxRes.value) {
        ctxList = Array.isArray(ctxRes.value) ? ctxRes.value : ctxRes.value.data || [];
        setContexts(ctxList);
        if (ctxList.length > 0) {
          const firstCtxId = ctxList[0]._id;
          setSelectedContextId(firstCtxId);

          const cohortAllocs = allocList.filter(
            (a) => (a.academicContextId?._id || a.academicContextId) === firstCtxId
          );

          if (cohortAllocs.length > 0) {
            setSessionForm((prev) => ({
              ...prev,
              academicContextId: firstCtxId,
              courseCode: cohortAllocs[0].courseCode,
              facultyId: cohortAllocs[0].facultyId?._id || cohortAllocs[0].facultyId,
              sessionType: cohortAllocs[0].allocationType || 'THEORY',
            }));
          } else {
            setSessionForm((prev) => ({ ...prev, academicContextId: firstCtxId }));
          }
        }
      }

      if (crsRes.status === 'fulfilled' && crsRes.value) {
        const list = Array.isArray(crsRes.value) ? crsRes.value : crsRes.value.data || [];
        setCourses(list);
        setSessionForm((prev) => {
          if (!prev.courseCode && list.length > 0) {
            return { ...prev, courseCode: list[0].courseCode };
          }
          return prev;
        });
      }

      if (facRes.status === 'fulfilled' && facRes.value) {
        const list = facRes.value.items || facRes.value.data || (Array.isArray(facRes.value) ? facRes.value : []);
        setFacultyList(list);
        setSessionForm((prev) => {
          if (!prev.facultyId && list.length > 0) {
            return { ...prev, facultyId: list[0].facultyId };
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('[OptimizationSolverPage] Failed to fetch:', err);
      setError(err.message || 'Unable to load solver data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateVersion = async (e) => {
    e.preventDefault();
    const ctx = contexts.find((c) => c._id === selectedContextId);

    try {
      setCreatingVersion(true);
      await createTimetableVersion({
        academicYear: ctx?.academicYear || '2024-2025',
        semester: ctx?.semester || 'ODD',
        department: ctx?.department || 'CSE',
        year: ctx?.year || 'III Year',
        section: ctx?.section || 'A',
        versionLabel: versionLabel.trim(),
      });
      showToast(`Timetable candidate version ${versionLabel} initialized.`, 'success');
      setIsVersionModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to initialize version.', 'error');
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleCohortChange = (newContextId) => {
    const cohortAllocs = hodAllocations.filter(
      (a) => (a.academicContextId?._id || a.academicContextId) === newContextId
    );
    let newCourse = courses[0]?.courseCode || '';
    let newFaculty = facultyList[0]?.facultyId || '';
    let newType = 'THEORY';

    if (cohortAllocs.length > 0) {
      newCourse = cohortAllocs[0].courseCode;
      newFaculty = cohortAllocs[0].facultyId?._id || cohortAllocs[0].facultyId;
      newType = cohortAllocs[0].allocationType || 'THEORY';
    }

    setSessionForm((prev) => ({
      ...prev,
      academicContextId: newContextId,
      courseCode: newCourse,
      facultyId: newFaculty,
      sessionType: newType,
    }));
  };

  const handleCourseChange = (newCourseCode) => {
    const match = hodAllocations.find(
      (a) =>
        (a.academicContextId?._id || a.academicContextId) === sessionForm.academicContextId &&
        a.courseCode === newCourseCode
    );

    if (match) {
      setSessionForm((prev) => ({
        ...prev,
        courseCode: newCourseCode,
        facultyId: match.facultyId?._id || match.facultyId,
        sessionType: match.allocationType || prev.sessionType,
      }));
    } else {
      setSessionForm((prev) => ({
        ...prev,
        courseCode: newCourseCode,
      }));
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    const crs = courses.find((c) => c.courseCode === sessionForm.courseCode);

    try {
      setCreatingSession(true);
      await createTimetableSession({
        academicContextId: sessionForm.academicContextId,
        day: sessionForm.day,
        period: sessionForm.period,
        courseCode: sessionForm.courseCode,
        courseName: crs?.courseName || sessionForm.courseCode,
        facultyId: sessionForm.facultyId,
        room: sessionForm.room,
        sessionType: sessionForm.sessionType,
      });
      showToast(`Session scheduled on ${sessionForm.day} ${sessionForm.period}.`, 'success');
      setIsSessionModalOpen(false);
    } catch (err) {
      showToast(err.message || 'Conflict detected or session failed.', 'error');
    } finally {
      setCreatingSession(false);
    }
  };

  const [submittingVersionId, setSubmittingVersionId] = useState(null);

  const handleSubmitForApproval = async (versionId) => {
    try {
      setSubmittingVersionId(versionId);
      await submitTimetableForApproval(versionId);
      showToast('Timetable version submitted for HOD approval.', 'success');
      await loadData();
    } catch (err) {
      console.warn('[OptimizationSolverPage] Submit for approval:', err);
      showToast(err.message || 'Submission status updated.', 'info');
      await loadData();
    } finally {
      setSubmittingVersionId(null);
    }
  };

  const cohortAllocs = hodAllocations.filter(
    (a) => (a.academicContextId?._id || a.academicContextId) === sessionForm.academicContextId
  );
  const matchingAlloc = cohortAllocs.find((a) => a.courseCode === sessionForm.courseCode);

  return (
    <div>
      <PageHeader
        title="Timetable Design & Preparation"
        description="Coordinator workspace for assigning course details, building timetable versions, scheduling slot sessions, and submitting for HOD approval."
        breadcrumbs={[
          { label: 'Coordinator Portal', path: '/coordinator/dashboard' },
          { label: 'Timetable Design' },
        ]}
        badge={<Badge variant="secondary">COORDINATOR DESIGN DESK</Badge>}
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"

              icon="➕"
              onClick={() => setIsSessionModalOpen(true)}
            >
              Add Scheduled Slot
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="⚡"
              onClick={() => setIsVersionModalOpen(true)}
            >
              Initialize New Version
            </Button>
          </div>
        }
      />

      {/* Backend Engine Status Banner */}
      <Card style={{ marginBottom: '24px', padding: '18px 20px', borderLeft: '4px solid var(--color-warning)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <span style={{ fontSize: '1.5rem' }}>⚙️</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                Autonomous Linear / Genetic Auto-Solver Status:
              </span>
              <Badge variant="warning">BLOCKED BY BACKEND</Badge>
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.875rem', color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
              The automated heavy combinatorial solver engine (`POST /api/timetable/solve`) is under active development by Ragul (Backend Owner).
              In the interim, Academic Coordinators can initialize timetable versions (`POST /api/timetable/version`), schedule individual slots with automated hard-conflict verification (`POST /api/timetable/session`), and advance versions to HOD Review.
            </p>
          </div>
        </div>
      </Card>

      {/* Timetable Versions Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Candidate Timetable Versions ({versions.length})
          </h3>
          <Button variant="subtle" size="sm" icon="🔄" onClick={loadData}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spinner size="md" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading candidate versions...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadData} />
          </div>
        ) : versions.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              title="No timetable versions generated"
              description="Click 'Initialize New Version' to start building a timetable schedule."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  icon="⚡"
                  onClick={() => setIsVersionModalOpen(true)}
                >
                  Initialize v1.0
                </Button>
              }
            />
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Version</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Academic Term</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Cohort</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Generated By</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Created Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((ver) => (
                  <tr key={ver._id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {ver.versionLabel || 'v1.0'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {ver.academicYear} ({ver.semester})
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                      {ver.year || 'CSE'} {ver.section ? `'${ver.section}'` : ''}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge
                        variant={
                          ver.status === 'PUBLISHED'
                            ? 'success'
                            : ver.status === 'APPROVED'
                            ? 'primary'
                            : ver.status === 'PENDING_HOD_APPROVAL'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {ver.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>
                      {ver.generatedBy || 'Academic Coordinator'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--color-outline)' }}>
                      {ver.createdAt ? new Date(ver.createdAt).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {ver.status !== 'APPROVED' && ver.status !== 'PUBLISHED' && ver.status !== 'PENDING_HOD_APPROVAL' ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={submittingVersionId === ver._id}
                          onClick={() => handleSubmitForApproval(ver._id)}
                        >
                          {submittingVersionId === ver._id ? 'Submitting...' : 'Submit for HOD Approval'}
                        </Button>
                      ) : ver.status === 'PENDING_HOD_APPROVAL' ? (
                        <Badge variant="warning">Awaiting HOD Review</Badge>
                      ) : (
                        <Badge variant="success">Approved</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

          </div>
        )}
      </Card>

      {/* Initialize Version Modal */}
      {isVersionModalOpen && (
        <Modal
          isOpen={isVersionModalOpen}
          onClose={() => !creatingVersion && setIsVersionModalOpen(false)}
          title="Initialize Timetable Version"
        >
          <form onSubmit={handleCreateVersion}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Target Cohort
              </label>
              <select
                value={selectedContextId}
                onChange={(e) => setSelectedContextId(e.target.value)}
                className="form-select"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
              >
                {contexts.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.department || 'CSE'} - {c.year} &apos;{c.section}&apos; ({c.academicYear})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Version Label
              </label>
              <input
                type="text"
                placeholder="e.g. v1.0 Draft, v1.1 Revised"
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsVersionModalOpen(false)}
                disabled={creatingVersion}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={creatingVersion}
              >
                {creatingVersion ? 'Initializing...' : 'Initialize Version'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Schedule Slot Session Modal */}
      {isSessionModalOpen && (
        <Modal
          isOpen={isSessionModalOpen}
          onClose={() => !creatingSession && setIsSessionModalOpen(false)}
          title="Schedule Timetable Slot"
        >
          <form onSubmit={handleCreateSession}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Cohort Class
              </label>
              <select
                value={sessionForm.academicContextId}
                onChange={(e) => handleCohortChange(e.target.value)}
                className="form-select"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
              >
                {contexts.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.department || 'CSE'} - {c.year} &apos;{c.section}&apos; (Sem {c.semester || 'ODD'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Day</label>
                <select
                  value={sessionForm.day}
                  onChange={(e) => setSessionForm({ ...sessionForm, day: e.target.value })}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
                >
                  <option value="MON">MON</option>
                  <option value="TUE">TUE</option>
                  <option value="WED">WED</option>
                  <option value="THU">THU</option>
                  <option value="FRI">FRI</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Period</label>
                <select
                  value={sessionForm.period}
                  onChange={(e) => setSessionForm({ ...sessionForm, period: e.target.value })}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
                >
                  <option value="P1">Period 1</option>
                  <option value="P2">Period 2</option>
                  <option value="P3">Period 3</option>
                  <option value="P4">Period 4</option>
                  <option value="P5">Period 5</option>
                  <option value="P6">Period 6</option>
                  <option value="P7">Period 7</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Course</label>
                {cohortAllocs.length > 0 && (
                  <Badge variant="success">{cohortAllocs.length} HOD Allocated</Badge>
                )}
              </div>
              <select
                value={sessionForm.courseCode}
                onChange={(e) => handleCourseChange(e.target.value)}
                className="form-select"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
              >
                {cohortAllocs.length > 0 && (
                  <optgroup label="HOD Allocated Courses (Authoritative)">
                    {cohortAllocs.map((alloc) => (
                      <option key={alloc.courseCode} value={alloc.courseCode}>
                        {alloc.courseCode}: {alloc.courseName || alloc.courseCode} ({alloc.facultyName || alloc.facultyId})
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Other Curriculum Courses">
                  {courses
                    .filter((crs) => !cohortAllocs.some((a) => a.courseCode === crs.courseCode))
                    .map((crs) => (
                      <option key={crs.courseCode} value={crs.courseCode}>
                        {crs.courseCode}: {crs.courseName}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                  Faculty Instructor
                </label>
                {matchingAlloc ? (
                  <div style={{ padding: '8px 10px', backgroundColor: 'var(--color-surface-container-low)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.875rem' }}>
                        {matchingAlloc.facultyName || matchingAlloc.facultyId}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>
                        ID: {matchingAlloc.facultyId?._id || matchingAlloc.facultyId}
                      </div>
                    </div>
                    <Badge variant="success">HOD ALLOCATED</Badge>
                  </div>
                ) : (
                  <div>
                    <select
                      value={sessionForm.facultyId}
                      onChange={(e) => setSessionForm({ ...sessionForm, facultyId: e.target.value })}
                      className="form-select"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-warning)' }}
                    >
                      <option value="">-- Select Instructor --</option>
                      {facultyList.map((f) => (
                        <option key={f.facultyId} value={f.facultyId}>
                          {f.facultyId}: {f.facultyName}
                        </option>
                      ))}
                    </select>
                    <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-warning-dark)' }}>
                      ⚠️ No HOD allocation for this course. [REQUIRES HOD DECISION]
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Room</label>
                <input
                  type="text"
                  value={sessionForm.room}
                  onChange={(e) => setSessionForm({ ...sessionForm, room: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsSessionModalOpen(false)}
                disabled={creatingSession}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={creatingSession}
              >
                {creatingSession ? 'Scheduling...' : 'Schedule Slot'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
