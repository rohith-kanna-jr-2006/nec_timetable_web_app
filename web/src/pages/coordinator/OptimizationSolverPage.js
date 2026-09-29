import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { getAcademicContexts } from '../../services/academicContextService';
import { getCourses } from '../../services/courseService';
import { getHODAllocations } from '../../services/hodAllocationService';
import { solveTimetable } from '../../services/timetableService';
import {
  RELEVANT_YEARS,
  YEAR_SEMESTER_MAP,
  resolveCurriculumSemester,
  findMatchingAcademicContext,
} from '../../constants/academicContext';
import {
  fetchAllCoursesForContext,
  deriveAutomaticCourseRows,
  calculateAssignmentPlanStatus,
} from '../../services/coordinatorDesignService';

import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Card from '../../components/common/Card';

export default function OptimizationSolverPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Root Data Loading States
  const [baseLoading, setBaseLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [error, setError] = useState(null);

  // Core Data Stores
  const [contexts, setContexts] = useState([]);
  const [hodAllocations, setHodAllocations] = useState([]);
  const [allCatalogCourses, setAllCatalogCourses] = useState([]);
  const [currentSemesterCourses, setCurrentSemesterCourses] = useState([]);

  // Cascading Academic Context State
  const [selectedYear, setSelectedYear] = useState('III Year');
  const [selectedSemester, setSelectedSemester] = useState('Semester V');
  const [selectedSection, setSelectedSection] = useState('A');

  // Generation Action State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSummary, setGenerationSummary] = useState(null);
  const [generationError, setGenerationError] = useState(null);

  // Load initial base data (contexts, all allocations, catalog overview)
  const loadBaseEnvironment = useCallback(async () => {
    try {
      setBaseLoading(true);
      setError(null);

      const [ctxRes, hodRes, catalogRes] = await Promise.allSettled([
        getAcademicContexts(),
        getHODAllocations(),
        getCourses({ limit: 500 }),
      ]);

      if (ctxRes.status === 'fulfilled' && ctxRes.value) {
        const ctxList = Array.isArray(ctxRes.value) ? ctxRes.value : ctxRes.value.data || [];
        setContexts(ctxList);

        // Derive initial year and section if available
        if (ctxList.length > 0) {
          const availableYears = [...new Set(ctxList.map((c) => c.year))].filter(Boolean);
          if (availableYears.includes('III Year')) {
            setSelectedYear('III Year');
          } else if (availableYears.length > 0) {
            setSelectedYear(availableYears[0]);
          }
        }
      }

      if (hodRes.status === 'fulfilled' && hodRes.value) {
        const allocList = Array.isArray(hodRes.value) ? hodRes.value : hodRes.value.data || [];
        setHodAllocations(allocList);
      }

      if (catalogRes.status === 'fulfilled' && catalogRes.value) {
        const crsList = Array.isArray(catalogRes.value)
          ? catalogRes.value
          : catalogRes.value.items || catalogRes.value.data?.items || catalogRes.value.data || [];
        setAllCatalogCourses(crsList);
      }
    } catch (err) {
      console.error('[OptimizationSolverPage] Base load error:', err);
      setError(err.message || 'Unable to load coordinator design environment.');
    } finally {
      setBaseLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBaseEnvironment();
  }, [loadBaseEnvironment]);

  // Resolve target curriculum semester (e.g. 'Semester V')
  const targetCurriculumSemester = resolveCurriculumSemester(selectedYear, selectedSemester);

  // Resolve matching AcademicContext in the database
  const activeContext = findMatchingAcademicContext(contexts, {
    year: selectedYear,
    semester: selectedSemester,
    section: selectedSection,
    department: 'CSE',
  });
  const activeContextId = activeContext?._id || activeContext?.id || '';

  // Load applicable active courses whenever curriculum context changes
  const loadSemesterCourses = useCallback(async (sem, ctxId) => {
    if (!sem) return;
    try {
      setCoursesLoading(true);
      const fetched = await fetchAllCoursesForContext({
        semester: sem,
        academicContextId: ctxId || undefined,
      });
      setCurrentSemesterCourses(fetched);
    } catch (err) {
      console.error('[OptimizationSolverPage] Error loading courses for semester:', sem, err);
      setCurrentSemesterCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!baseLoading) {
      loadSemesterCourses(targetCurriculumSemester, activeContextId);
    }
  }, [baseLoading, targetCurriculumSemester, activeContextId, loadSemesterCourses]);

  // Refresh HOD allocations when academic context changes
  const refreshAllocations = useCallback(async () => {
    try {
      const res = await getHODAllocations();
      const list = Array.isArray(res) ? res : res?.data || [];
      setHodAllocations(list);
    } catch (err) {
      console.warn('[OptimizationSolverPage] Allocations refresh warning:', err);
    }
  }, []);

  // Handle Cascading Context Selection
  const handleYearChange = (year) => {
    setSelectedYear(year);
    const validSems = YEAR_SEMESTER_MAP[year] || [];
    if (validSems.length > 0 && !validSems.includes(selectedSemester)) {
      setSelectedSemester(validSems[0]);
    }
    setGenerationSummary(null);
  };

  const handleSemesterChange = (sem) => {
    setSelectedSemester(sem);
    setGenerationSummary(null);
  };

  const handleSectionChange = (sec) => {
    setSelectedSection(sec);
    setGenerationSummary(null);
  };

  // Derive Automatic Course Rows & Synchronized Assignment Plan
  const courseRows = deriveAutomaticCourseRows({
    courses: currentSemesterCourses,
    allCatalogCourses,
    hodAllocations,
    academicContextId: activeContextId,
    targetCurriculumSemester,
  });

  // Calculate Assignment Plan Status and Metrics
  const planStatus = calculateAssignmentPlanStatus(courseRows, {
    hasContext: Boolean(activeContextId || (selectedYear && selectedSemester && selectedSection)),
    loading: baseLoading || coursesLoading,
    error,
  });

  // Trigger Timetable Generation
  const handleGenerateTimetable = async () => {
    if (!planStatus.isReady) {
      showToast('Faculty allocation is pending HOD decision for one or more courses.', 'warning');
      return;
    }

    if (!activeContextId) {
      const msg = 'No active academic context found for the selected Year, Semester, and Section.';
      setGenerationError(msg);
      showToast(msg, 'error');
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationError(null);
      setGenerationSummary(null);
      showToast(`Generating timetable for ${selectedYear} - Section ${selectedSection}...`, 'info');

      // Build authoritative assignment plan payload for real solver
      const assignmentPlan = courseRows
        .filter((r) => r.facultyId && r.courseCode)
        .map((r) => ({
          courseCode: r.courseCode,
          facultyId: r.facultyId,
          type: r.type === 'LAB' ? 'LAB' : 'THEORY',
          requiredPeriods: Number(r.requiredPeriods) || 3,
        }));

      const res = await solveTimetable({
        academicContextId: activeContextId,
        assignmentPlan,
      });

      const data = res?.data || res;
      const version = data.timetableVersion || {};
      const sessionsCreated = data.sessionsCreated ?? (data.assignments?.length || 0);

      setGenerationSummary({
        status: 'GENERATED',
        versionId: version._id || version.id || '',
        versionLabel: version.versionLabel || 'v1.0',
        academicContextId: activeContextId,
        academicContext: `${selectedYear} | ${targetCurriculumSemester} | Section ${selectedSection}`,
        totalCourses: planStatus.totalCourses,
        theoryCourses: planStatus.theoryCount,
        labCourses: planStatus.labCount,
        allocatedCourses: planStatus.allocatedCount,
        sessionsCreated,
        timestamp: new Date().toLocaleTimeString(),
      });
      showToast(`Timetable successfully generated (${sessionsCreated} sessions scheduled).`, 'success');
    } catch (err) {
      console.error('[OptimizationSolverPage] solveTimetable error:', err);
      const errMsg = err.message || 'Timetable generation failed.';
      setGenerationError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Available semesters for selected year
  const availableSemesters = YEAR_SEMESTER_MAP[selectedYear] || ['Semester III', 'Semester IV'];

  return (
    <div>
      <PageHeader
        title="Prepare Timetable Assignment"
        description="Select an academic cohort to automatically load curriculum courses, resolve authoritative HOD faculty allocations, and review the assignment plan."
        breadcrumbs={[
          { label: 'Coordinator Portal', path: '/coordinator/dashboard' },
          { label: 'Timetable Design' },
        ]}
        badge={<Badge variant="secondary">AUTO-ASSIGNMENT ENGINE</Badge>}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refreshAllocations();
              loadSemesterCourses(targetCurriculumSemester, activeContextId);
              showToast('Assignment roster refreshed.', 'info');
            }}
          >
            🔄 Refresh Roster
          </Button>
        }
      />

      {baseLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <Spinner size="lg" />
          <div style={{ marginTop: '16px', fontSize: '0.9375rem', color: 'var(--color-outline)' }}>
            Loading coordinator solver environment and curriculum master...
          </div>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadBaseEnvironment} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Cascading Academic Context Selector */}
          <Card style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--color-primary)' }}>
                  Academic Cohort Selection
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-outline)' }}>
                  Changing Year, Semester, or Section automatically recalculates the curriculum courses and HOD faculty roster.
                </p>
              </div>
              <div>
                {activeContext ? (
                  <Badge variant="success">COHORT RESOLVED: {activeContext.department || 'CSE'} - {activeContext.section}</Badge>
                ) : (
                  <Badge variant="warning">UNREGISTERED COHORT CONTEXT</Badge>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                gap: '16px',
              }}
            >
              {/* Year Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                  Academic Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className="form-select"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-outline-variant)',
                    backgroundColor: 'var(--color-surface)',
                    fontSize: '0.875rem',
                  }}
                >
                  {RELEVANT_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                  Curriculum Semester
                </label>
                <select
                  value={selectedSemester}
                  onChange={(e) => handleSemesterChange(e.target.value)}
                  className="form-select"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-outline-variant)',
                    backgroundColor: 'var(--color-surface)',
                    fontSize: '0.875rem',
                  }}
                >
                  {availableSemesters.map((s) => (
                    <option key={s} value={s}>
                      {s} {['Semester III', 'Semester V', 'Semester VII'].includes(s) ? '(Odd Term)' : '(Even Term)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                  Class Section
                </label>
                <select
                  value={selectedSection}
                  onChange={(e) => handleSectionChange(e.target.value)}
                  className="form-select"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-outline-variant)',
                    backgroundColor: 'var(--color-surface)',
                    fontSize: '0.875rem',
                  }}
                >
                  {['A', 'B', 'C', 'D'].map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Context Verification Strip */}
            <div
              style={{
                marginTop: '16px',
                padding: '10px 14px',
                backgroundColor: 'var(--color-surface-container-low)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <strong>Active Context:</strong> Computer Science & Engineering • {selectedYear} • {targetCurriculumSemester} • Section {selectedSection}
              </div>
              <div style={{ color: 'var(--color-outline)' }}>
                {activeContextId ? `Context ID: ${activeContextId}` : 'No active context ID'}
              </div>
            </div>
          </Card>

          {/* Assignment Plan & Course Rows Area */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--color-primary)' }}>
                  Curriculum Course–Faculty Assignment Plan
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-outline)' }}>
                  Automatically populated from backend Course curriculum and authoritative HOD Faculty Allocations.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge variant={planStatus.isReady ? 'success' : planStatus.state === 'PARTIAL' ? 'warning' : 'neutral'}>
                  {planStatus.state}
                </Badge>
                {courseRows.length > 0 && (
                  <Badge variant="secondary">{courseRows.length} Courses</Badge>
                )}
              </div>
            </div>

            {/* Summary Metrics Bar */}
            {courseRows.length > 0 && (
              <div
                style={{
                  padding: '14px 24px',
                  backgroundColor: 'var(--color-surface-container-low)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  flexWrap: 'wrap',
                  fontSize: '0.875rem',
                }}
              >
                <div>
                  <strong>Total Applicable Courses:</strong> {planStatus.totalCourses}
                </div>
                <div>
                  <strong>Theory:</strong> {planStatus.theoryCount}
                </div>
                <div>
                  <strong>Lab:</strong> {planStatus.labCount}
                </div>
                <div>
                  <strong>HOD Allocated:</strong>{' '}
                  <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                    {planStatus.allocatedCount}
                  </span>
                </div>
                {planStatus.pendingCount > 0 && (
                  <div>
                    <strong>Pending HOD Decision:</strong>{' '}
                    <span style={{ color: 'var(--color-warning-dark)', fontWeight: 600 }}>
                      {planStatus.pendingCount}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* User-facing State Alert Banner */}
            {planStatus.state === 'PARTIAL' && (
              <div
                style={{
                  padding: '14px 24px',
                  backgroundColor: 'var(--color-warning-container)',
                  borderBottom: '1px solid var(--color-warning)',
                  color: 'var(--color-on-warning-container)',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                <div>
                  <strong>Faculty Allocation Pending:</strong> Faculty allocation is pending HOD decision for one or more courses. Courses marked <strong>[REQUIRES HOD DECISION]</strong> must be allocated by the Head of Department before timetable generation can proceed.
                </div>
              </div>
            )}

            {planStatus.state === 'READY' && (
              <div
                style={{
                  padding: '14px 24px',
                  backgroundColor: 'var(--color-success-container)',
                  borderBottom: '1px solid var(--color-success)',
                  color: 'var(--color-on-success-container)',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>✓</span>
                <div>
                  <strong>All Courses Allocated:</strong> All course-faculty assignments are verified from authoritative HOD allocations. Ready for timetable generation.
                </div>
              </div>
            )}

            {/* Table Content */}
            {coursesLoading ? (
              <div style={{ padding: '60px 0', textAlign: 'center' }}>
                <Spinner size="md" />
                <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
                  Loading applicable courses and verifying HOD faculty allocations...
                </div>
              </div>
            ) : courseRows.length === 0 ? (
              <div style={{ padding: '40px 24px' }}>
                <EmptyState
                  title="No active courses available"
                  description="No active courses are available for this academic context."
                />
              </div>
            ) : (
              <div className="ui-table-scroll-container">
                <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--color-surface-container-low)',
                        textAlign: 'left',
                        borderBottom: '1px solid var(--color-surface-container)',
                      }}
                    >
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Code</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Title</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Faculty</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>
                        Required Periods
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseRows.map((row) => (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: '1px solid var(--color-surface-container)',
                          backgroundColor: row.isAllocated
                            ? 'transparent'
                            : 'var(--color-surface-container-lowest)',
                        }}
                      >
                        <td
                          style={{
                            padding: '12px 16px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            color: 'var(--color-primary)',
                          }}
                        >
                          {row.courseCode}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 500 }}>{row.courseTitle}</span>
                          {row.isElectiveSlot && (
                            <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: 'var(--color-outline)' }}>
                              (Curriculum Slot)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {row.isAllocated ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-on-surface)' }}>
                                {row.facultyName}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>
                                ID: {row.facultyId}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-warning-dark)', fontWeight: 600 }}>
                              [REQUIRES HOD DECISION]
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant={row.type === 'LAB' ? 'tertiary' : 'secondary'}>
                            {row.type}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>
                          {row.requiredPeriods}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant={row.status === 'HOD ALLOCATED' ? 'success' : 'warning'}>
                            {row.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div
              style={{
                padding: '20px 24px',
                borderTop: '1px solid var(--color-border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                backgroundColor: 'var(--color-surface)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-on-surface-variant)', fontSize: '0.875rem' }}>
                  Assignment Status:
                </span>
                <Badge variant={planStatus.isReady ? 'success' : planStatus.state === 'PARTIAL' ? 'warning' : 'neutral'}>
                  {planStatus.state}
                </Badge>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-outline)' }}>
                  ({planStatus.allocatedCount} / {planStatus.totalCourses} courses allocated)
                </span>
              </div>

              <Button
                variant="primary"
                size="lg"
                disabled={!planStatus.isReady || isGenerating}
                onClick={handleGenerateTimetable}
              >
                {isGenerating
                  ? 'Generating Timetable...'
                  : planStatus.isReady
                  ? 'Generate Timetable'
                  : 'Generate Timetable (Pending HOD Allocations)'}
              </Button>
            </div>
          </Card>

          {/* Timetable Generation Error Area */}
          {generationError && (
            <Card style={{ padding: '20px', marginTop: '20px', borderLeft: '4px solid var(--color-error)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-error)', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.25rem' }}>❌</span>
                <h3 style={{ margin: 0, fontSize: '1.0625rem' }}>Timetable Generation Failed</h3>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.875rem', color: 'var(--color-on-surface)' }}>
                {generationError}
              </p>
              <Button variant="outline" size="sm" onClick={() => setGenerationError(null)}>
                Dismiss
              </Button>
            </Card>
          )}

          {/* Timetable Generation Success Area */}
          {generationSummary && (
            <Card style={{ padding: '24px', borderLeft: '4px solid var(--color-success)', marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.5rem' }}>🎉</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--color-success)' }}>
                      Timetable Generated Successfully
                    </h3>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-outline)', marginTop: '2px' }}>
                      Version {generationSummary.versionLabel} • {generationSummary.timestamp}
                    </div>
                  </div>
                </div>
                <Badge variant="success">GENERATED & PERSISTED</Badge>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  marginBottom: '20px',
                  fontSize: '0.875rem',
                  padding: '16px',
                  backgroundColor: 'var(--color-surface-container-low)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div>
                  <strong>Academic Context:</strong> {generationSummary.academicContext}
                </div>
                <div>
                  <strong>Sessions Created:</strong>{' '}
                  <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                    {generationSummary.sessionsCreated} periods
                  </span>
                </div>
                <div>
                  <strong>Allocated Courses:</strong> {generationSummary.allocatedCourses} / {generationSummary.totalCourses}
                </div>
                <div>
                  <strong>Theory / Lab:</strong> {generationSummary.theoryCourses} Theory, {generationSummary.labCourses} Lab
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() =>
                    navigate(
                      `/coordinator/view?academicContextId=${generationSummary.academicContextId}${
                        generationSummary.versionId ? `&versionId=${generationSummary.versionId}` : ''
                      }`
                    )
                  }
                >
                  Open Review Matrix 📊
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() =>
                    navigate(
                      `/faculty/class-timetable?academicContextId=${generationSummary.academicContextId}`
                    )
                  }
                >
                  View Class Timetable 📅
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
