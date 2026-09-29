import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getHODAllocations,
  createHODAllocation,
  updateHODAllocation,
  deleteHODAllocation,
} from '../../services/hodAllocationService';
import { getFacultyList } from '../../services/facultyService';
import { getAcademicContexts, createAcademicContext } from '../../services/academicContextService';
import { getCourses } from '../../services/courseService';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import Modal from '../../components/common/Modal';
import Select from '../../components/common/Select';

// Authoritative Year and Semester Structure for R22 CSE
const YEARS = ['II Year', 'III Year', 'IV Year'];

const YEAR_SEMESTER_MAP = {
  'II Year': ['Semester III', 'Semester IV'],
  'III Year': ['Semester V', 'Semester VI'],
  'IV Year': ['Semester VII', 'Semester VIII'],
};

const SECTIONS = ['A', 'B', 'C', 'D'];

export default function HODFacultyAllocationPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [error, setError] = useState(null);

  // Core Data
  const [allocations, setAllocations] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [courses, setCourses] = useState([]);

  // Active Cohort Navigation
  const [selectedYear, setSelectedYear] = useState('II Year');
  const [selectedSemester, setSelectedSemester] = useState('Semester III');
  const [selectedSection, setSelectedSection] = useState('A');

  // Allocation Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCourse, setActiveCourse] = useState(null);
  const [activeExistingAlloc, setActiveExistingAlloc] = useState(null);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [allocationType, setAllocationType] = useState('THEORY');
  const [submitting, setSubmitting] = useState(false);
  const [formValidation, setFormValidation] = useState('');

  // Handle Year change and sync valid semester
  const handleYearChange = (newYear) => {
    setSelectedYear(newYear);
    const validSems = YEAR_SEMESTER_MAP[newYear] || [];
    if (!validSems.includes(selectedSemester)) {
      setSelectedSemester(validSems[0] || 'Semester III');
    }
  };

  // Fetch courses for the selected semester
  const loadCourses = useCallback(async (sem) => {
    try {
      setCoursesLoading(true);
      const crsRes = await getCourses({
        semester: sem,
        limit: 100,
      });
      const list = crsRes?.items || crsRes?.data?.items || crsRes?.courses || crsRes?.data?.courses || crsRes?.data || (Array.isArray(crsRes) ? crsRes : []);
      setCourses(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('[HODFacultyAllocationPage] Failed to fetch courses for', sem, err);
      setCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  // Fetch all base data (allocations, faculty, contexts)
  const loadBaseData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [allocRes, facRes, ctxRes] = await Promise.allSettled([
        getHODAllocations(),
        getFacultyList({ limit: 100 }),
        getAcademicContexts(),
      ]);

      if (allocRes.status === 'fulfilled' && allocRes.value) {
        const list = Array.isArray(allocRes.value) ? allocRes.value : allocRes.value.data || [];
        setAllocations(list);
      }
      if (facRes.status === 'fulfilled' && facRes.value) {
        const list = facRes.value.items || facRes.value.data || (Array.isArray(facRes.value) ? facRes.value : []);
        setFacultyList(list);
        if (list.length > 0 && !selectedFacultyId) {
          setSelectedFacultyId(list[0].facultyId);
        }
      }
      if (ctxRes.status === 'fulfilled' && ctxRes.value) {
        const list = Array.isArray(ctxRes.value) ? ctxRes.value : ctxRes.value.data || [];
        setContexts(list);
      }
    } catch (err) {
      console.error('[HODFacultyAllocationPage] Failed to fetch base data:', err);
      setError(err.message || 'Unable to retrieve allocation roster.');
    } finally {
      setLoading(false);
    }
  }, [selectedFacultyId]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadCourses(selectedSemester);
  }, [selectedSemester, loadCourses]);

  // Determine whether current selected semester is Even or Odd
  const isEvenSemester = ['Semester IV', 'Semester VI', 'Semester VIII'].includes(selectedSemester);
  const expectedAcademicPeriod = isEvenSemester ? 'Even Semester' : 'Odd Semester';

  // Resolve current active AcademicContext ID
  const activeContext = contexts.find(
    (c) =>
      c.year === selectedYear &&
      c.section === selectedSection &&
      c.department === 'CSE' &&
      (isEvenSemester ? /even/i.test(c.semester) : /odd/i.test(c.semester))
  );
  const activeContextId = activeContext?._id || activeContext?.id;

  // Filter courses strictly for selected semester
  const filteredCourses = courses.filter((c) => {
    if (!c.semester) return true;
    const normC = c.semester.replace(/^(semester|sem)\.?\s*/i, '').trim().toUpperCase();
    const normT = selectedSemester.replace(/^(semester|sem)\.?\s*/i, '').trim().toUpperCase();
    return normC === normT;
  });

  const handleOpenAssignModal = (course, existingAllocation = null) => {
    setActiveCourse(course);
    setActiveExistingAlloc(existingAllocation);
    setSelectedFacultyId(existingAllocation?.facultyId || facultyList[0]?.facultyId || '');
    setAllocationType(
      existingAllocation?.allocationType ||
        (course.isLab || course.courseType === 'LAB' || (course.P && course.P >= 3 && course.L === 0)
          ? 'LAB_PRIMARY'
          : 'THEORY')
    );
    setFormValidation('');
    setIsModalOpen(true);
  };

  const handleSaveAllocation = async (e) => {
    e.preventDefault();
    if (!selectedFacultyId) {
      setFormValidation('Please select a faculty member.');
      return;
    }

    try {
      setSubmitting(true);
      setFormValidation('');

      let ctxId = activeContextId;
      if (!ctxId) {
        // Create context on the fly if missing in DB for this period
        const createdCtx = await createAcademicContext({
          academicYear: '2026-27',
          semester: expectedAcademicPeriod,
          department: 'CSE',
          year: selectedYear,
          section: selectedSection,
          program: 'UG',
          status: 'ACTIVE',
        });
        const resolved = createdCtx?.data || createdCtx;
        ctxId = resolved?._id || resolved?.id;
      }

      const facultyMatch = facultyList.find((f) => f.facultyId === selectedFacultyId);

      if (activeExistingAlloc && activeExistingAlloc._id) {
        // Update existing allocation
        await updateHODAllocation(activeExistingAlloc._id, {
          facultyId: selectedFacultyId,
          facultyName: facultyMatch?.facultyName || selectedFacultyId,
          allocationType,
          status: 'APPROVED',
        });
        showToast(
          `Reassigned ${facultyMatch?.facultyName || selectedFacultyId} to ${activeCourse.courseCode} (${selectedYear} - ${selectedSection} - ${selectedSemester}).`,
          'success'
        );
      } else {
        // Create new authoritative allocation
        await createHODAllocation({
          academicContextId: ctxId,
          courseCode: activeCourse.courseCode,
          courseName: activeCourse.courseName || activeCourse.title || '',
          facultyId: selectedFacultyId,
          facultyName: facultyMatch?.facultyName || selectedFacultyId,
          allocationType,
          status: 'APPROVED',
        });
        showToast(
          `Assigned ${facultyMatch?.facultyName || selectedFacultyId} to ${activeCourse.courseCode} (${selectedYear} - ${selectedSection} - ${selectedSemester}).`,
          'success'
        );
      }

      setIsModalOpen(false);
      await loadBaseData();
    } catch (err) {
      console.error('[HODFacultyAllocationPage] Allocation failed:', err);
      setFormValidation(err.message || 'Failed to save course allocation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAllocation = async (allocationId, courseCode) => {
    if (!window.confirm(`Remove faculty allocation for ${courseCode}?`)) return;
    try {
      await deleteHODAllocation(allocationId);
      showToast(`Allocation for ${courseCode} removed.`, 'info');
      await loadBaseData();
    } catch (err) {
      console.error('[HODFacultyAllocationPage] Delete allocation failed:', err);
      showToast(err.message || 'Failed to remove allocation.', 'error');
    }
  };

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <PageHeader
        title="Course → Faculty Allocation"
        description="Statutory HOD authority for binding faculty assignments across all curriculum semesters (Semester III to VIII) and cohorts. R22 Curriculum Master serves as the single source of truth."
        breadcrumbs={[
          { label: 'HOD Portal', path: '/hod/dashboard' },
          { label: 'Course → Faculty Allocation' },
        ]}
        badge={<Badge variant="primary">HOD DECISION AUTHORITY</Badge>}
        actions={
          <Button
            variant="outline"
            size="sm"
            icon="🔄"
            onClick={() => {
              loadBaseData();
              loadCourses(selectedSemester);
            }}
          >
            Refresh
          </Button>
        }
      />

      {/* Cohort Selector (Year + Semester + Section) */}
      <Card
        style={{
          marginBottom: '20px',
          padding: '16px 20px',
          background: 'var(--color-surface-container-low)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* Year Navigation */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--color-outline)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Academic Year
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              {YEARS.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => handleYearChange(yr)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-md)',
                    border:
                      yr === selectedYear
                        ? '2px solid var(--color-primary)'
                        : '1px solid var(--color-outline-variant)',
                    backgroundColor:
                      yr === selectedYear
                        ? 'var(--color-primary-container)'
                        : 'var(--color-surface)',
                    color:
                      yr === selectedYear
                        ? 'var(--color-primary)'
                        : 'var(--color-on-surface)',
                    fontWeight: yr === selectedYear ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          {/* Curriculum Semester Navigation */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--color-outline)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Curriculum Semester
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              {(YEAR_SEMESTER_MAP[selectedYear] || []).map((sem) => (
                <button
                  key={sem}
                  type="button"
                  onClick={() => setSelectedSemester(sem)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-md)',
                    border:
                      sem === selectedSemester
                        ? '2px solid var(--color-primary)'
                        : '1px solid var(--color-outline-variant)',
                    backgroundColor:
                      sem === selectedSemester
                        ? 'var(--color-primary-container)'
                        : 'var(--color-surface)',
                    color:
                      sem === selectedSemester
                        ? 'var(--color-primary)'
                        : 'var(--color-on-surface)',
                    fontWeight: sem === selectedSemester ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {sem}
                </button>
              ))}
            </div>
          </div>

          {/* Section Navigation */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--color-outline)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Section
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              {SECTIONS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSelectedSection(sec)}
                  style={{
                    width: '38px',
                    height: '34px',
                    borderRadius: 'var(--radius-md)',
                    border:
                      sec === selectedSection
                        ? '2px solid var(--color-primary)'
                        : '1px solid var(--color-outline-variant)',
                    backgroundColor:
                      sec === selectedSection
                        ? 'var(--color-primary-container)'
                        : 'var(--color-surface)',
                    color:
                      sec === selectedSection
                        ? 'var(--color-primary)'
                        : 'var(--color-on-surface)',
                    fontWeight: sec === selectedSection ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Cohort Overview Header */}
      <Card
        style={{
          marginBottom: '20px',
          padding: '16px 20px',
          background: 'var(--color-surface-container-lowest)',
          borderLeft: '4px solid var(--color-primary)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '1.125rem',
                fontWeight: 800,
                color: 'var(--color-primary)',
              }}
            >
              CSE — {selectedYear} &apos;{selectedSection}&apos; ({selectedSemester}, 2026-27)
            </div>
            <div
              style={{
                fontSize: '0.8125rem',
                color: 'var(--color-outline)',
                marginTop: '2px',
              }}
            >
              R22 Curriculum Master • {filteredCourses.length} Registered Semester Courses
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Badge variant="primary">{expectedAcademicPeriod}</Badge>
            <Badge variant="secondary">HOD Ratification</Badge>
          </div>
        </div>
      </Card>

      {/* Course -> Faculty Allocation Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading || coursesLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spinner size="lg" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading course allocation roster for {selectedSemester}...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadBaseData} />
          </div>
        ) : filteredCourses.length === 0 ? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: 'var(--color-outline)',
              fontSize: '0.875rem',
            }}
          >
            No courses found for {selectedSemester} in curriculum catalog.
          </div>
        ) : (
          <div className="ui-table-scroll-container" style={{ width: '100%', overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                minWidth: '850px',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-surface-container-low)',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--color-surface-container)',
                  }}
                >
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: '40px' }}>#</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Code</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Title</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type & Credits</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>HOD-Assigned Faculty</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Allocation Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((crs, index) => {
                  // Match allocations for this course in the active context/cohort
                  const matchingAllocs = allocations.filter((a) => {
                    const codeMatches =
                      (a.courseCode || '').toUpperCase().trim() ===
                      (crs.courseCode || '').toUpperCase().trim();
                    if (!codeMatches) return false;
                    if (a.status === 'REJECTED') return false;

                    // Match populated context
                    if (a.academicContext && typeof a.academicContext === 'object') {
                      const ctx = a.academicContext;
                      const matchesYear = ctx.year === selectedYear;
                      const matchesSection = ctx.section === selectedSection;
                      const matchesPeriod = isEvenSemester
                        ? /even/i.test(ctx.semester)
                        : /odd/i.test(ctx.semester);
                      return matchesYear && matchesSection && matchesPeriod;
                    }

                    // Match direct ObjectId
                    if (activeContextId && a.academicContextId) {
                      const aCtxId = a.academicContextId?._id || a.academicContextId;
                      return String(aCtxId) === String(activeContextId);
                    }

                    return false;
                  });

                  const hasConflict = matchingAllocs.length > 1;
                  const existingAlloc = matchingAllocs.length >= 1 ? matchingAllocs[0] : null;

                  const facultyMatch = existingAlloc
                    ? facultyList.find((f) => f.facultyId === existingAlloc.facultyId)
                    : null;

                  const isLabCourse =
                    crs.isLab ||
                    crs.courseType === 'LAB' ||
                    (crs.P && crs.P >= 3 && crs.L === 0);

                  const periodText =
                    crs.contactPeriod && crs.contactPeriod !== '-'
                      ? crs.contactPeriod
                      : crs.totalPeriod !== undefined
                      ? `${crs.totalPeriod} Periods`
                      : '';

                  return (
                    <tr
                      key={crs.courseCode}
                      style={{
                        borderBottom: '1px solid var(--color-surface-container)',
                        backgroundColor: hasConflict
                          ? 'rgba(239, 68, 68, 0.05)'
                          : existingAlloc
                          ? 'transparent'
                          : 'rgba(245, 158, 11, 0.03)',
                      }}
                    >
                      <td style={{ padding: '12px 16px', color: 'var(--color-outline)' }}>
                        {index + 1}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: 'var(--color-primary)',
                        }}
                      >
                        {crs.courseCode}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        <div>{crs.courseName || crs.title}</div>
                        {crs.category && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--color-outline)',
                              fontWeight: 400,
                            }}
                          >
                            Category: {crs.category}
                            {crs.electiveType ? ` (${crs.electiveType})` : ''}
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          color: 'var(--color-on-surface-variant)',
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>
                          {crs.courseType || (isLabCourse ? 'LAB' : 'THEORY')}
                        </span>
                        {periodText ? ` • ${periodText}` : ''}
                        {crs.credits !== undefined ? ` • ${crs.credits} Credits` : ''}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {hasConflict ? (
                          <div>
                            <div
                              style={{
                                color: 'var(--color-error)',
                                fontWeight: 700,
                                fontSize: '0.8125rem',
                              }}
                            >
                              [CONFLICT / HOD DECISION REQUIRED]
                            </div>
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--color-outline)',
                                marginTop: '2px',
                              }}
                            >
                              {matchingAllocs
                                .map((a) => `${a.facultyName || a.facultyId} (${a.facultyId})`)
                                .join(', ')}
                            </div>
                          </div>
                        ) : existingAlloc ? (
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                color: 'var(--color-on-surface)',
                              }}
                            >
                              {facultyMatch?.facultyName ||
                                existingAlloc.facultyName ||
                                existingAlloc.facultyId}
                            </div>
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--color-outline)',
                              }}
                            >
                              ID: {existingAlloc.facultyId} • {existingAlloc.allocationType}
                            </div>
                          </div>
                        ) : (
                          <span
                            style={{
                              color: 'var(--color-warning)',
                              fontWeight: 600,
                              fontSize: '0.8125rem',
                            }}
                          >
                            [REQUIRES HOD DECISION]
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {hasConflict ? (
                          <Badge variant="danger">CONFLICT</Badge>
                        ) : existingAlloc ? (
                          <Badge variant="success">APPROVED</Badge>
                        ) : (
                          <Badge variant="warning">UNALLOCATED</Badge>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <Button
                            variant={hasConflict ? 'danger' : existingAlloc ? 'outline' : 'primary'}
                            size="sm"
                            onClick={() => handleOpenAssignModal(crs, existingAlloc)}
                          >
                            {hasConflict
                              ? 'Resolve Conflict'
                              : existingAlloc
                              ? 'Reassign'
                              : 'Assign Faculty'}
                          </Button>
                          {existingAlloc && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() =>
                                handleDeleteAllocation(existingAlloc._id, crs.courseCode)
                              }
                              title="Delete Allocation"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Allocation Modal */}
      {isModalOpen && activeCourse && (
        <Modal
          isOpen={true}
          onClose={() => !submitting && setIsModalOpen(false)}
          title={`${activeExistingAlloc ? 'Reassign' : 'Assign'} Faculty — ${activeCourse.courseCode}`}
        >
          <form
            onSubmit={handleSaveAllocation}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              fontSize: '0.875rem',
            }}
          >
            {formValidation && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--color-error-container)',
                  color: 'var(--color-on-error-container)',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                }}
              >
                {formValidation}
              </div>
            )}

            <div
              style={{
                padding: '10px 12px',
                background: 'var(--color-surface-container-low)',
                borderRadius: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--color-outline)',
                }}
              >
                TARGET COURSE & COHORT
              </div>
              <div
                style={{
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  marginTop: '2px',
                }}
              >
                {activeCourse.courseCode}: {activeCourse.courseName || activeCourse.title}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-on-surface-variant)',
                  marginTop: '2px',
                }}
              >
                Cohort: {selectedYear} Section &apos;{selectedSection}&apos; • {selectedSemester}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  marginBottom: '6px',
                }}
              >
                Select Faculty Member *
              </label>
              <Select
                value={selectedFacultyId}
                onChange={(e) => setSelectedFacultyId(e.target.value)}
                options={facultyList.map((f) => ({
                  value: f.facultyId,
                  label: `${f.facultyName} (${f.facultyId}) — ${f.designation}`,
                }))}
                required
                disabled={submitting}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  marginBottom: '6px',
                }}
              >
                Allocation Type *
              </label>
              <Select
                value={allocationType}
                onChange={(e) => setAllocationType(e.target.value)}
                options={[
                  { value: 'THEORY', label: 'THEORY — Core Lecture' },
                  { value: 'LAB_PRIMARY', label: 'LAB_PRIMARY — Lead Lab Faculty' },
                  { value: 'LAB_ADDITIONAL', label: 'LAB_ADDITIONAL — Lab Support Faculty' },
                  { value: 'SAS', label: 'SAS — Special Academic Session' },
                  { value: 'OTHERS', label: 'OTHERS — Tutorial / Elective' },
                ]}
                disabled={submitting}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '16px',
              }}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                {submitting
                  ? 'Saving...'
                  : activeExistingAlloc
                  ? 'Update Allocation'
                  : 'Confirm Allocation'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
