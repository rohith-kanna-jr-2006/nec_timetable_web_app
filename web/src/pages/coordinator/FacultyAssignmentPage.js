import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { getHODAllocations } from '../../services/hodAllocationService';
import { getCourses } from '../../services/courseService';
import { getFacultyList } from '../../services/facultyService';
import { getAcademicContexts } from '../../services/academicContextService';
import {
  findMatchingAcademicContext,
  resolveCurriculumSemester,
  normalizeCurriculumSemester,
} from '../../constants/academicContext';
import {
  deriveAutomaticCourseRows,
  calculateAssignmentPlanStatus,
  validateAssignmentCounts,
  categorizeAssignmentRow,
} from '../../services/coordinatorDesignService';

import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';

// Authoritative 12 target class cohorts for 2026-27 Odd Semester CSE
const YEARS = ['II Year', 'III Year', 'IV Year'];
const SECTIONS = ['A', 'B', 'C', 'D'];

const SEMESTER_MAP = {
  'II Year': 3,
  'III Year': 5,
  'IV Year': 7,
};

export default function FacultyAssignmentPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Core Data
  const [allocations, setAllocations] = useState([]);
  const [courses, setCourses] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [contexts, setContexts] = useState([]);

  // Active Cohort Selection
  const [selectedYear, setSelectedYear] = useState('II Year');
  const [selectedSection, setSelectedSection] = useState('A');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [allocRes, crsRes, facRes, ctxRes] = await Promise.allSettled([
        getHODAllocations(),
        getCourses(),
        getFacultyList({ limit: 100 }),
        getAcademicContexts(),
      ]);

      if (allocRes.status === 'fulfilled' && allocRes.value) {
        const list = Array.isArray(allocRes.value) ? allocRes.value : allocRes.value.data || [];
        setAllocations(list);
      }
      if (crsRes.status === 'fulfilled' && crsRes.value) {
        const list = Array.isArray(crsRes.value) ? crsRes.value : crsRes.value.data || [];
        setCourses(list);
      }
      if (facRes.status === 'fulfilled' && facRes.value) {
        const list = facRes.value.items || facRes.value.data || (Array.isArray(facRes.value) ? facRes.value : []);
        setFacultyList(list);
      }
      if (ctxRes.status === 'fulfilled' && ctxRes.value) {
        const list = Array.isArray(ctxRes.value) ? ctxRes.value : ctxRes.value.data || [];
        setContexts(list);
      }
    } catch (err) {
      console.error('[FacultyAssignmentPage] Failed to fetch data:', err);
      setError(err.message || 'Unable to retrieve allocation roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Resolve current active AcademicContext ID using authoritative helpers
  const activeContext = findMatchingAcademicContext(contexts, {
    year: selectedYear,
    semester: resolveCurriculumSemester(selectedYear, 'Odd Semester'),
    section: selectedSection,
    department: 'CSE',
  });
  const activeContextId = activeContext?._id || activeContext?.id;

  // Resolve target semester using the curriculum mapping logic
  const targetCurriculumSemester = resolveCurriculumSemester(selectedYear, 'Odd Semester');

  // Filter courses for the selected cohort's semester using consistent normalization
  const filteredCourses = courses.filter((c) => {
    if (!c.semester) return true;
    // Normalize backend semester using the existing helper function
    const normalizedBackendSem = normalizeCurriculumSemester(c.semester);
    return normalizedBackendSem === targetCurriculumSemester;
  });

  // Calculate allocation coverage
  const allocatedCount = filteredCourses.filter((crs) => {
    return allocations.some((a) => {
      const matchCtx = activeContextId
        ? String(a.academicContextId?._id || a.academicContextId) === String(activeContextId)
        : a.academicContextId?.year === selectedYear && a.academicContextId?.section === selectedSection;
      return matchCtx && a.courseCode === crs.courseCode;
    });
  }).length;

  // Display warning when no valid academic context is registered for the cohort
  const noValidContext = contexts.length > 0 && !activeContext;

  // Derive authoritative course rows with required periods and assignment-count rules
  const rows = deriveAutomaticCourseRows({
    courses: filteredCourses,
    allCatalogCourses: filteredCourses,
    hodAllocations: allocations,
    academicContextId: activeContextId,
    targetCurriculumSemester,
  });

  // Plan status metrics derived directly from the rows
  const planStatus = calculateAssignmentPlanStatus(rows, {
    hasContext: Boolean(activeContextId),
    loading,
    error,
  });

  // Per-faculty assignment-count validation (UG Theory max 2, UG Lab max 2, PG max 1)
  const assignmentViolations = validateAssignmentCounts(rows);

  return (
    <div>
      <PageHeader
        title="Course — Faculty Allocation Matrix"
        description="Authoritative course-to-faculty allocations approved by the Head of Department (HOD) across the 12 target class cohorts for Academic Year 2026-27 (Odd Semester). TimeTable Coordinators design timetable schedules adhering strictly to these allocations."
        breadcrumbs={[
          { label: 'Coordinator Portal', path: '/coordinator/dashboard' },
          { label: 'Faculty Allocation Matrix' },
        ]}
        badge={<Badge variant="primary">HOD AUTHORITATIVE MATRIX</Badge>}
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              icon="🔄"
              onClick={loadData}
            >
              Refresh Matrix
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="⚡"
              onClick={() => {
                window.location.href = '/coordinator/optimization-solver';
              }}
            >
              Open Timetable Designer
            </Button>
          </div>
        }
      />

      {/* No Valid Context Warning Banner */}
      {noValidContext && (
        <Card style={{ marginBottom: '20px', padding: '16px 20px', borderLeft: '4px solid var(--color-warning)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <span style={{ fontWeight: 700, color: 'var(--color-warning-dark)' }}>No Valid Academic Context Registered:</span>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.875rem', color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
                No academic context is registered for {selectedYear} {selectedSection} (Semester {targetCurriculumSemester}). Create one via the Academic Context management module before accessing course allocations.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Authority Banner */}
      <Card style={{ marginBottom: '20px', padding: '16px 20px', borderLeft: '4px solid var(--color-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <span style={{ fontSize: '1.5rem' }}>🛡️</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                Decision Authority Notice:
              </span>
              <Badge variant="success">HOD ALLOCATED</Badge>
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.875rem', color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
              Head of Department (HOD) is the authoritative decision maker for Course ➔ Faculty allocation. TimeTable Coordinators prepare timetable schedules by assigning timeslots in the Timetable Designer adhering strictly to these allocations.
            </p>
          </div>
        </div>
      </Card>

      {/* Cohort Selector (Year + Section) */}
      <Card style={{ marginBottom: '20px', padding: '16px 20px', background: 'var(--color-surface-container-low)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
              Select Target Cohort
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              {YEARS.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYear(yr)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: yr === selectedYear ? '2px solid var(--color-primary)' : '1px solid var(--color-outline-variant)',
                    backgroundColor: yr === selectedYear ? 'var(--color-primary-container)' : 'var(--color-surface)',
                    color: yr === selectedYear ? 'var(--color-primary)' : 'var(--color-on-surface)',
                    fontWeight: yr === selectedYear ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                  }}
                >
                  {yr} (Sem {SEMESTER_MAP[yr]})
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
              Section
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              {SECTIONS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSelectedSection(sec)}
                  style={{
                    width: '38px',
                    height: '34px',
                    borderRadius: 'var(--radius-md)',
                    border: sec === selectedSection ? '2px solid var(--color-primary)' : '1px solid var(--color-outline-variant)',
                    backgroundColor: sec === selectedSection ? 'var(--color-primary-container)' : 'var(--color-surface)',
                    color: sec === selectedSection ? 'var(--color-primary)' : 'var(--color-on-surface)',
                    fontWeight: sec === selectedSection ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Cohort Status Header */}
      <Card style={{ marginBottom: '20px', padding: '16px 20px', background: 'var(--color-surface-container-lowest)', borderLeft: '4px solid var(--color-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              CSE — {selectedYear} &apos;{selectedSection}&apos; (Semester {targetCurriculumSemester}, Odd 2026-27)
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-outline)', marginTop: '2px' }}>
              Curriculum Catalog • {allocatedCount} of {filteredCourses.length} Courses Allocated by HOD
            </div>
          </div>
          <Badge variant={allocatedCount === filteredCourses.length && filteredCourses.length > 0 ? 'success' : 'warning'}>
            {allocatedCount === filteredCourses.length && filteredCourses.length > 0
              ? 'READY FOR TIMETABLE DESIGN'
              : 'PENDING HOD ALLOCATIONS'}
          </Badge>
        </div>
      </Card>

      {/* Assignment-Count Rules Banner */}
      <Card style={{ marginBottom: '20px', padding: '14px 20px', borderLeft: '4px solid var(--color-info)', background: 'var(--color-surface-container-lowest)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.2rem' }}>📋</span>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-on-surface)' }}>Assignment-Count Rules:</span>
          <Badge variant="info">UG Theory max 2</Badge>
          <Badge variant="info">UG Lab max 2</Badge>
          <Badge variant="info">PG max 1</Badge>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginLeft: 'auto' }}>
            Per faculty, per academic context
          </span>
        </div>
      </Card>

      {/* Assignment-Count Violations */}
      {assignmentViolations.length > 0 && (
        <Card style={{ marginBottom: '20px', padding: '16px 20px', borderLeft: '4px solid var(--color-danger)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <span style={{ fontSize: '1.5rem' }}>🚫</span>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-danger)' }}>Assignment Limit Exceeded</div>
              <div style={{ marginTop: '6px', fontSize: '0.875rem', color: 'var(--color-on-surface-variant)' }}>
                {assignmentViolations.map((v) => (
                  <div key={`${v.facultyId}-${v.bucket}`} style={{ marginBottom: '4px' }}>
                    {v.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Course -> Faculty Allocation Table */}
      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: '28px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Authoritative Course — Faculty Allocations
          </h3>
          <Badge variant="outline">{rows.length} rows</Badge>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spinner size="lg" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading course allocation roster...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadData} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-outline)', fontSize: '0.875rem' }}>
            No courses found for Semester {targetCurriculumSemester} in curriculum catalog.
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Code</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Title</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Required Periods</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>HOD-Assigned Faculty</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const existingAlloc = allocations.find((a) => {
                    const matchCtx = activeContextId
                      ? String(a.academicContextId?._id || a.academicContextId) === String(activeContextId)
                      : a.academicContextId?.year === selectedYear && a.academicContextId?.section === selectedSection;
                    return matchCtx && a.courseCode === row.courseCode;
                  });

                  const facultyMatch = existingAlloc
                    ? facultyList.find((f) => f.facultyId === existingAlloc.facultyId)
                    : null;

                  const violation = assignmentViolations.find(
                    (v) => v.facultyId === row.facultyId && categorizeAssignmentRow(row) === v.bucket
                  );

                  return (
                    <tr
                      key={row.id || `${row.courseCode}_${activeContextId || 'ctx'}`}
                      style={{
                        borderBottom: '1px solid var(--color-surface-container)',
                        backgroundColor: existingAlloc ? 'transparent' : 'rgba(245, 158, 11, 0.03)',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {row.courseCode}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {row.courseTitle || '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant={row.type === 'LAB' ? 'warning' : row.type === 'PG' ? 'secondary' : 'outline'}>
                          {row.type || 'THEORY'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {row.requiredPeriods || 0}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {existingAlloc ? (
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                              {facultyMatch?.facultyName || existingAlloc.facultyName || existingAlloc.facultyId}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>
                              ID: {existingAlloc.facultyId} • {facultyMatch?.designation || 'Faculty'}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Badge variant="warning">HOD Faculty Assignment Required</Badge>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {violation ? (
                          <Badge variant="danger">{violation.label} EXCEEDED</Badge>
                        ) : row.status === 'HOD ALLOCATED' ? (
                          <Badge variant="success">{row.status}</Badge>
                        ) : (
                          <Badge variant="warning">{row.status}</Badge>
                        )}
                      </td>
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
