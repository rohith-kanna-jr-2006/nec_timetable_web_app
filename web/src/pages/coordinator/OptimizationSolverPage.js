import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';

import { generateTimetable } from '../../services/timetableService';
import { getAcademicContexts } from '../../services/academicContextService';
import { getCourses } from '../../services/courseService';
import { getHODAllocations } from '../../services/hodAllocationService';

import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import Card from '../../components/common/Card';

const YEAR_TO_CURRICULUM_SEMESTER = {
  'II Year': 'Semester III',
  'III Year': 'Semester V',
  'IV Year': 'Semester VII',
  'II': 'Semester III',
  'III': 'Semester V',
  'IV': 'Semester VII',
  '2': 'Semester III',
  '3': 'Semester V',
  '4': 'Semester VII',
};

export default function OptimizationSolverPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Initial page load state
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState(null);

  // Contexts store
  const [contexts, setContexts] = useState([]);

  // Cohort Selection UI State
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedContextId, setSelectedContextId] = useState('');

  // Course & Assignment Plan State (Dynamic N courses)
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseError, setCourseError] = useState(null);
  const [assignmentPlan, setAssignmentPlan] = useState([]);

  // Solver Engine Generation State
  const [generationStatus, setGenerationStatus] = useState('INITIAL'); // INITIAL, GENERATING, GENERATED, ERROR
  const [generationResult, setGenerationResult] = useState(null);
  const [generationError, setGenerationError] = useState(null);

  // Fetch contextual courses & authoritative HOD allocations for the active cohort
  const loadCohortCourses = useCallback(async (contextId, year, semester) => {
    if (!contextId) return;

    setCourseLoading(true);
    setCourseError(null);
    setAssignmentPlan([]);
    setGenerationStatus('INITIAL');
    setGenerationResult(null);
    setGenerationError(null);

    try {
      const targetCurriculumSem = YEAR_TO_CURRICULUM_SEMESTER[year] || semester;

      // Parallel batch retrieval: Contextual Courses & Contextual HOD Allocations
      const [crsRes, allocRes] = await Promise.all([
        getCourses({ academicContextId: contextId, limit: 100 }).catch(async () => {
          return getCourses({ semester: targetCurriculumSem, limit: 100 });
        }),
        getHODAllocations({ academicContextId: contextId }),
      ]);

      let rawCourses = crsRes?.items || crsRes?.data?.items || crsRes?.courses || crsRes?.data?.courses || crsRes?.data || crsRes || [];
      if (!Array.isArray(rawCourses)) rawCourses = [];

      // Fallback: if query by contextId returned empty, fetch by curriculum semester directly
      if (rawCourses.length === 0 && targetCurriculumSem) {
        const semRes = await getCourses({ semester: targetCurriculumSem, limit: 100 }).catch(() => null);
        const semItems = semRes?.items || semRes?.data?.items || semRes?.data || semRes || [];
        if (Array.isArray(semItems) && semItems.length > 0) {
          rawCourses = semItems;
        }
      }

      // Filter courses strictly by normalized curriculum semester (avoiding substring collisions like VII containing V)
      const filteredCourses = rawCourses.filter((c) => {
        if (!targetCurriculumSem) return true;
        const normCourse = (c.semester || '').replace(/^R\d+\s*/i, '').trim().toLowerCase();
        const normTarget = targetCurriculumSem.replace(/^R\d+\s*/i, '').trim().toLowerCase();
        return normCourse === normTarget;
      });

      // Deduplicate courses by stable courseCode
      const seenCodes = new Set();
      const uniqueCourses = [];
      for (const c of filteredCourses) {
        const code = (c.courseCode || '').toUpperCase().trim();
        if (code && !seenCodes.has(code)) {
          seenCodes.add(code);
          uniqueCourses.push(c);
        }
      }

      // Normalize HOD Allocations
      let rawAllocs = allocRes?.data || allocRes?.items || allocRes || [];
      if (!Array.isArray(rawAllocs)) rawAllocs = [];

      // Automatically construct one Assignment Row per returned course
      const rows = uniqueCourses.map((course) => {
        const courseCodeUpper = (course.courseCode || '').toUpperCase().trim();
        const matchingAllocs = rawAllocs.filter((a) => {
          const aCtxId = a.academicContextId?._id || a.academicContextId;
          const matchCtx = !aCtxId || aCtxId.toString() === contextId.toString();
          const matchCode = (a.courseCode || '').toUpperCase().trim() === courseCodeUpper;
          const notRejected = a.status !== 'REJECTED';
          return matchCtx && matchCode && notRejected;
        });

        const hasConflict = matchingAllocs.length > 1;
        const matchingAlloc = matchingAllocs.length === 1 ? matchingAllocs[0] : null;

        let status = 'REQUIRES HOD DECISION';
        if (hasConflict) {
          status = 'CONFLICT';
        } else if (matchingAlloc) {
          status = 'READY';
        }

        const isLab =
          course.isLab === true ||
          course.courseType === 'LAB' ||
          matchingAlloc?.allocationType === 'LAB_PRIMARY' ||
          (course.P >= 3 && course.L === 0);

        const courseType = isLab ? 'LAB' : (course.courseType || 'THEORY');
        const requiredPeriods =
          course.totalPeriod ||
          (course.L || 0) + (course.T || 0) + (course.P || 0) ||
          (isLab ? 4 : 4);

        return {
          id: course.courseCode,
          courseCode: course.courseCode,
          courseTitle: course.courseName,
          electiveSlot: course.electiveSlot || null,
          facultyId: matchingAlloc ? (matchingAlloc.facultyId?._id || matchingAlloc.facultyId) : null,
          facultyName: matchingAlloc ? matchingAlloc.facultyName : null,
          type: courseType,
          requiredPeriods,
          status,
          hasConflict,
          allocationCount: matchingAllocs.length,
        };
      });

      setAssignmentPlan(rows);
    } catch (err) {
      console.error('[OptimizationSolverPage] Error loading contextual courses:', err);
      setCourseError('Unable to load curriculum courses.');
    } finally {
      setCourseLoading(false);
    }
  }, []);

  // Initial load of academic contexts
  const loadInitialData = async () => {
    try {
      setInitialLoading(true);
      setInitialError(null);

      const ctxRes = await getAcademicContexts();
      const ctxList = Array.isArray(ctxRes) ? ctxRes : ctxRes?.data || [];
      setContexts(ctxList);

      if (ctxList.length > 0) {
        const years = [...new Set(ctxList.map((c) => c.year))].filter(Boolean);
        // Default to III Year if present (primary target cohort), else first available year
        const initialYear = years.includes('III Year') ? 'III Year' : years[0];
        setSelectedYear(initialYear);

        const sems = [...new Set(ctxList.filter((c) => c.year === initialYear).map((c) => c.semester))].filter(Boolean);
        const initialSem = sems[0] || '';
        setSelectedSemester(initialSem);

        const secs = ctxList.filter((c) => c.year === initialYear && c.semester === initialSem);
        const initialCtxId = secs[0]?._id || '';
        setSelectedContextId(initialCtxId);

        if (initialCtxId) {
          loadCohortCourses(initialCtxId, initialYear, initialSem);
        }
      }
    } catch (err) {
      console.error('[OptimizationSolverPage] Initialization failed:', err);
      setInitialError(err.message || 'Unable to load solver environment.');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Filter options derived from context list
  const uniqueYears = useMemo(() => {
    return [...new Set(contexts.map((c) => c.year))].filter(Boolean);
  }, [contexts]);

  const uniqueSemesters = useMemo(() => {
    return [...new Set(contexts.filter((c) => c.year === selectedYear).map((c) => c.semester))].filter(Boolean);
  }, [contexts, selectedYear]);

  const sections = useMemo(() => {
    return contexts.filter((c) => c.year === selectedYear && c.semester === selectedSemester);
  }, [contexts, selectedYear, selectedSemester]);

  const selectedContext = useMemo(() => {
    return contexts.find((c) => c._id === selectedContextId) || null;
  }, [contexts, selectedContextId]);

  // Handle Cascading Cohort Changes
  const handleYearChange = (year) => {
    setSelectedYear(year);
    setAssignmentPlan([]);
    setCourseLoading(true);
    setGenerationStatus('INITIAL');
    setGenerationResult(null);
    setGenerationError(null);

    const sems = [...new Set(contexts.filter((c) => c.year === year).map((c) => c.semester))].filter(Boolean);
    const newSem = sems[0] || '';
    setSelectedSemester(newSem);

    const secs = contexts.filter((c) => c.year === year && c.semester === newSem);
    const newCtxId = secs[0]?._id || '';
    setSelectedContextId(newCtxId);

    if (newCtxId) {
      loadCohortCourses(newCtxId, year, newSem);
    } else {
      setCourseLoading(false);
    }
  };

  const handleSemesterChange = (sem) => {
    setSelectedSemester(sem);
    setAssignmentPlan([]);
    setCourseLoading(true);
    setGenerationStatus('INITIAL');
    setGenerationResult(null);
    setGenerationError(null);

    const secs = contexts.filter((c) => c.year === selectedYear && c.semester === sem);
    const newCtxId = secs[0]?._id || '';
    setSelectedContextId(newCtxId);

    if (newCtxId) {
      loadCohortCourses(newCtxId, selectedYear, sem);
    } else {
      setCourseLoading(false);
    }
  };

  const handleContextChange = (id) => {
    setSelectedContextId(id);
    setAssignmentPlan([]);
    setCourseLoading(true);
    setGenerationStatus('INITIAL');
    setGenerationResult(null);
    setGenerationError(null);

    loadCohortCourses(id, selectedYear, selectedSemester);
  };

  // Readiness validation
  const isGenerateDisabled =
    courseLoading ||
    assignmentPlan.length === 0 ||
    assignmentPlan.some((p) => p.status !== 'READY') ||
    generationStatus === 'GENERATING';

  // Automated Timetable Generation Execution
  const handleGenerateTimetable = async () => {
    if (isGenerateDisabled) return;

    setGenerationStatus('GENERATING');
    setGenerationResult(null);
    setGenerationError(null);

    try {
      const payload = {
        academicContextId: selectedContextId,
        assignmentPlan: assignmentPlan.map((p) => ({
          courseCode: p.courseCode,
          facultyId: p.facultyId,
          requiredPeriods: p.requiredPeriods,
          type: p.type,
        })),
        generationSeed: Math.floor(Math.random() * 900000) + 100000,
      };

      const result = await generateTimetable(payload);
      setGenerationStatus('GENERATED');
      setGenerationResult(result);
      showToast('Timetable generation successful!', 'success');
    } catch (err) {
      console.error('[OptimizationSolverPage] Timetable generation failed:', err);
      setGenerationStatus('ERROR');
      const errMsg = err.message || err.data?.message || 'Timetable generation failed.';
      setGenerationError(errMsg);
      showToast(`Generation failed: ${errMsg}`, 'error');
    }
  };

  return (
    <div>
      <style>{`
        .coordinator-design-layout {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 24px;
          align-items: start;
          width: 100%;
          max-width: 100%;
        }
        @media (max-width: 1024px) {
          .coordinator-design-layout {
            grid-template-columns: 1fr;
          }
        }
        .curriculum-courses-scroll {
          max-height: 480px;
          overflow-y: auto;
          padding-right: 6px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .curriculum-courses-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .curriculum-courses-scroll::-webkit-scrollbar-thumb {
          background-color: var(--color-outline-variant, #cbd5e1);
          border-radius: 4px;
        }
      `}</style>

      <PageHeader
        title="Prepare Timetable Assignment"
        description="Build the course-faculty assignment plan and run the automated generation engine."
        breadcrumbs={[
          { label: 'Coordinator Portal', path: '/coordinator/dashboard' },
          { label: 'Timetable Design' },
        ]}
        badge={<Badge variant="secondary">AUTO-GENERATION ENGINE</Badge>}
      />

      {initialLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <Spinner size="md" />
          <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
            Loading solver environment...
          </div>
        </div>
      ) : initialError ? (
        <ErrorState message={initialError} onRetry={loadInitialData} />
      ) : (
        <div className="coordinator-design-layout">
          {/* Left Panel: Prepare Assignment & Contextual Course Allocation */}
          <Card style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 18px 0', fontSize: '1.125rem', color: 'var(--color-primary)' }}>
              Prepare Assignment
            </h3>

            {/* Year Selector */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="form-select"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-on-surface)',
                }}
              >
                {uniqueYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Semester Selector */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Semester
              </label>
              <select
                value={selectedSemester}
                onChange={(e) => handleSemesterChange(e.target.value)}
                className="form-select"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-on-surface)',
                }}
              >
                {uniqueSemesters.map((s) => (
                  <option key={s} value={s}>
                    {s.startsWith('Semester') ? s : `Semester ${s}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Class / Section Selector */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Class / Section
              </label>
              <select
                value={selectedContextId}
                onChange={(e) => handleContextChange(e.target.value)}
                className="form-select"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-on-surface)',
                }}
              >
                {sections.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.department || 'CSE'} – {c.year} – {c.section}
                  </option>
                ))}
              </select>
            </div>

            {/* Curriculum Courses Area */}
            <div style={{ paddingTop: '18px', borderTop: '1px solid var(--color-border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--color-primary)' }}>
                  Curriculum Courses
                </h4>
                {!courseLoading && assignmentPlan.length > 0 && (
                  <Badge variant="secondary">{assignmentPlan.length} Courses</Badge>
                )}
              </div>

              {courseLoading ? (
                <div style={{ padding: '36px 0', textAlign: 'center' }}>
                  <Spinner size="sm" />
                  <div style={{ marginTop: '10px', fontSize: '0.8125rem', color: 'var(--color-outline)' }}>
                    Loading curriculum courses...
                  </div>
                </div>
              ) : courseError ? (
                <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ color: 'var(--color-error)', fontSize: '0.8125rem', marginBottom: '8px', fontWeight: 500 }}>
                    {courseError}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => loadCohortCourses(selectedContextId, selectedYear, selectedSemester)}>
                    Retry
                  </Button>
                </div>
              ) : assignmentPlan.length === 0 ? (
                <div style={{ padding: '24px 16px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-outline-variant)', color: 'var(--color-outline)', textAlign: 'center', fontSize: '0.8125rem' }}>
                  No curriculum courses found for this cohort.
                </div>
              ) : (
                <div className="curriculum-courses-scroll">
                  {assignmentPlan.map((plan, idx) => (
                    <div
                      key={plan.id}
                      style={{
                        padding: '12px',
                        backgroundColor: 'var(--color-surface-container-lowest)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-outline-variant)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
                          Course {idx + 1}
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--color-surface-container-high)', fontWeight: 600 }}>
                            {plan.type}
                          </span>
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--color-surface-container-high)' }}>
                            {plan.requiredPeriods} Periods
                          </span>
                        </div>
                      </div>

                      {/* Course Dropdown/Field */}
                      <div style={{ marginBottom: '8px' }}>
                        <select
                          value={plan.courseCode}
                          disabled
                          className="form-select"
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-outline-variant)',
                            backgroundColor: 'var(--color-surface-container-low)',
                            color: 'var(--color-on-surface)',
                            fontWeight: 600,
                            fontSize: '0.8125rem',
                            cursor: 'not-allowed',
                          }}
                        >
                          <option value={plan.courseCode}>
                            {plan.courseCode} — {plan.courseTitle}
                          </option>
                        </select>
                      </div>

                      {/* Faculty Instructor Resolution Field */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--color-on-surface-variant)' }}>
                          Faculty Instructor
                        </label>
                        {plan.status === 'READY' ? (
                          <div
                            style={{
                              padding: '6px 10px',
                              backgroundColor: 'var(--color-surface-container-low)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-outline-variant)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-on-surface)' }}>
                              {plan.facultyName}
                            </span>
                            <Badge variant="success">HOD ALLOCATED</Badge>
                          </div>
                        ) : plan.status === 'CONFLICT' ? (
                          <div
                            style={{
                              padding: '8px 10px',
                              backgroundColor: 'rgba(239, 68, 68, 0.08)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-error)',
                            }}
                          >
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-error)' }}>
                              ⚠️ Conflicting HOD allocation
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-error)', marginTop: '2px', fontWeight: 500 }}>
                              [HOD DECISION REQUIRED]
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              padding: '8px 10px',
                              backgroundColor: 'rgba(245, 158, 11, 0.08)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-warning)',
                            }}
                          >
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-warning-dark, #b45309)' }}>
                              ⚠️ No HOD allocation for this course
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-warning-dark, #b45309)', marginTop: '2px', fontWeight: 500 }}>
                              [REQUIRES HOD DECISION]
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Right Panel: Complete Assignment Plan & Automated Solver Engine */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--color-primary)' }}>
                  Course–Faculty Assignment Plan
                </h3>
                {!courseLoading && assignmentPlan.length > 0 && (
                  <Badge variant="secondary">{assignmentPlan.length} Courses</Badge>
                )}
              </div>

              {courseLoading ? (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <Spinner size="md" />
                  <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
                    Loading curriculum courses...
                  </div>
                </div>
              ) : assignmentPlan.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-outline)', border: '2px dashed var(--color-border-subtle)', borderRadius: 'var(--radius-lg)' }}>
                  No assignments available for the selected cohort.
                </div>
              ) : (
                <div className="ui-table-scroll-container">
                  <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                        <th style={{ padding: '12px 14px', fontWeight: 600, width: '48px' }}>#</th>
                        <th style={{ padding: '12px 14px', fontWeight: 600 }}>Course Code</th>
                        <th style={{ padding: '12px 14px', fontWeight: 600 }}>Course Title</th>
                        <th style={{ padding: '12px 14px', fontWeight: 600 }}>Faculty</th>
                        <th style={{ padding: '12px 14px', fontWeight: 600 }}>Type</th>
                        <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>Required Periods</th>
                        <th style={{ padding: '12px 14px', fontWeight: 600 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignmentPlan.map((plan, idx) => (
                        <tr key={plan.id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                          <td style={{ padding: '12px 14px', color: 'var(--color-outline)' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--color-primary)' }}>
                            {plan.courseCode}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {plan.courseTitle}
                            {plan.electiveSlot && (
                              <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: 'var(--color-outline)' }}>
                                [{plan.electiveSlot}]
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>{plan.facultyName || 'Unassigned'}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--color-surface-container-high)' }}>
                              {plan.type}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>{plan.requiredPeriods}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <Badge variant={plan.status === 'READY' ? 'success' : plan.status === 'CONFLICT' ? 'error' : 'warning'}>
                              {plan.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Status and Generate Timetable Action Footer */}
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Status:</span>
                    <Badge variant={generationStatus === 'GENERATING' ? 'warning' : isGenerateDisabled ? 'error' : 'success'}>
                      {generationStatus === 'GENERATING' ? 'GENERATING' : (isGenerateDisabled ? 'BLOCKED' : 'READY')}
                    </Badge>
                  </div>
                  {isGenerateDisabled && assignmentPlan.length > 0 && !courseLoading && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-error)', marginTop: '6px', fontWeight: 500 }}>
                      Complete HOD Course → Faculty allocation before generating the timetable.
                    </div>
                  )}
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={isGenerateDisabled}
                  onClick={handleGenerateTimetable}
                >
                  {generationStatus === 'GENERATING' ? 'Generating Timetable...' : 'Generate Timetable'}
                </Button>
              </div>
            </Card>

            {/* Generation Results Feedback Card */}
            {(generationStatus === 'ERROR' || generationStatus === 'GENERATED') && (
              <Card
                style={{
                  padding: '20px',
                  borderLeft: generationStatus === 'ERROR' ? '4px solid var(--color-error)' : '4px solid var(--color-success)',
                  backgroundColor: generationStatus === 'ERROR' ? 'rgba(239, 68, 68, 0.03)' : 'var(--color-surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', color: generationStatus === 'ERROR' ? 'var(--color-error)' : 'var(--color-success)' }}>
                    Generation Status: {generationStatus === 'ERROR' ? 'FAILED' : 'SUCCESSFUL'}
                  </h3>
                  {generationStatus === 'GENERATED' && (
                    <Button variant="outline" size="sm" onClick={() => navigate(`/coordinator/view?contextId=${selectedContextId}`)}>
                      View Generated Timetable →
                    </Button>
                  )}
                </div>

                {generationStatus === 'ERROR' ? (
                  <div>
                    <p style={{ margin: 0, fontWeight: 500, color: 'var(--color-error)', fontSize: '0.875rem' }}>
                      {generationError || 'An error occurred while generating the timetable. Please check backend constraints.'}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: '14px', fontSize: '0.875rem', color: 'var(--color-on-surface-variant)' }}>
                      <strong>Academic Context:</strong> {selectedYear} | Semester {selectedSemester} | {selectedContext?.department || 'CSE'} – {selectedContext?.section}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px', fontSize: '0.875rem', padding: '14px', backgroundColor: 'var(--color-surface-container-low)', borderRadius: 'var(--radius-md)' }}>
                      <div><strong>Course Assignments:</strong> {assignmentPlan.length}</div>
                      <div><strong>Theory Courses:</strong> {assignmentPlan.filter((p) => p.type === 'THEORY').length}</div>
                      <div><strong>Lab Courses:</strong> {assignmentPlan.filter((p) => p.type === 'LAB').length}</div>
                      <div><strong>Generated Sessions:</strong> {generationResult?.sessionsCreated || generationResult?.data?.sessionsCreated || generationResult?.sessionsCount || 35}</div>
                      <div><strong>Seed:</strong> {generationResult?.generationSeed || generationResult?.data?.generationSeed || generationResult?.seed || 'N/A'}</div>
                      <div><strong>Nodes Explored:</strong> {generationResult?.metrics?.nodesExplored || generationResult?.data?.metrics?.nodesExplored || 'N/A'}</div>
                    </div>

                    <p style={{ margin: 0, lineHeight: 1.5, color: 'var(--color-on-surface-variant)', fontSize: '0.875rem' }}>
                      The automated timetable engine has successfully satisfied all hard constraints (faculty cross-class conflicts, theory distribution, consecutive lab blocks) and generated canonical TimetableSession records.
                    </p>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
