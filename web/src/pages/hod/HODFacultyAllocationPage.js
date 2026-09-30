import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getAllocationContext,
  saveCourseAllocation,
} from '../../services/hodAllocationService';
import { getFacultyList } from '../../services/facultyService';
import { getAcademicContexts, createAcademicContext } from '../../services/academicContextService';
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
  const [contextLoading, setContextLoading] = useState(false);
  const [error, setError] = useState(null);

  // Core Data
  const [facultyList, setFacultyList] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [allocationContextData, setAllocationContextData] = useState(null);

  // Active Cohort Navigation
  const [selectedYear, setSelectedYear] = useState('II Year');
  const [selectedSemester, setSelectedSemester] = useState('Semester III');
  const [selectedSection, setSelectedSection] = useState('A');

  // Allocation Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCourse, setActiveCourse] = useState(null);

  // Dynamic slot states
  // LAB
  const [labPrimaryFacultyId, setLabPrimaryFacultyId] = useState('');
  const [labAdditionalFacultyId, setLabAdditionalFacultyId] = useState('');
  const [labOptionalFacultyId, setLabOptionalFacultyId] = useState('');

  // SAS
  const [sasMathsFacultyId, setSasMathsFacultyId] = useState('');
  const [sasEnglishFacultyId, setSasEnglishFacultyId] = useState('');

  // MC_DEPARTMENT
  const [deptFacultyId, setDeptFacultyId] = useState('');

  // MC_OPTIONAL_MAPPING (Induction)
  const [mappingEnabled, setMappingEnabled] = useState(false);
  const [optFacultyId, setOptFacultyId] = useState('');

  // THEORY_SINGLE
  const [theoryFacultyId, setTheoryFacultyId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formValidation, setFormValidation] = useState('');

  // Determine whether current selected semester is Even or Odd
  const isEvenSemester = ['Semester IV', 'Semester VI', 'Semester VIII'].includes(selectedSemester);
  const expectedAcademicPeriod = isEvenSemester ? 'Even Semester' : 'Odd Semester';

  // Resolve current active AcademicContext
  const activeContext = contexts.find(
    (c) =>
      c.year === selectedYear &&
      c.section === selectedSection &&
      c.department === 'CSE' &&
      (isEvenSemester ? /even/i.test(c.semester) : /odd/i.test(c.semester))
  );
  const activeContextId = activeContext?._id || activeContext?.id;

  // Handle Year change and sync valid semester
  const handleYearChange = (newYear) => {
    setSelectedYear(newYear);
    const validSems = YEAR_SEMESTER_MAP[newYear] || [];
    if (!validSems.includes(selectedSemester)) {
      setSelectedSemester(validSems[0] || 'Semester III');
    }
  };

  // Fetch allocation context for an academic context ID
  const loadContextAllocations = useCallback(async (ctxId) => {
    if (!ctxId) {
      setAllocationContextData(null);
      return;
    }
    try {
      setContextLoading(true);
      setError(null);
      const res = await getAllocationContext(ctxId);
      const data = res?.data || res;
      setAllocationContextData(data);
    } catch (err) {
      console.error('[HODFacultyAllocationPage] Failed to fetch context allocations:', err);
      setError(err.message || 'Unable to retrieve cohort allocation roster.');
      setAllocationContextData(null);
    } finally {
      setContextLoading(false);
    }
  }, []);

  // Fetch all base data (faculty, contexts)
  const loadBaseData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [facRes, ctxRes] = await Promise.allSettled([
        getFacultyList({ limit: 150 }),
        getAcademicContexts(),
      ]);

      if (facRes.status === 'fulfilled' && facRes.value) {
        const list = facRes.value.items || facRes.value.data || (Array.isArray(facRes.value) ? facRes.value : []);
        setFacultyList(list);
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
  }, []);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  // When activeContextId changes or contexts update, load cohort allocations
  useEffect(() => {
    if (activeContextId) {
      loadContextAllocations(activeContextId);
    } else {
      setAllocationContextData(null);
    }
  }, [activeContextId, loadContextAllocations]);

  // Helper to ensure context exists
  const getOrCreateActiveContextId = async () => {
    if (activeContextId) return activeContextId;
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
    const newId = resolved?._id || resolved?.id;
    await loadBaseData();
    return newId;
  };

  const handleOpenAssignModal = (course) => {
    setActiveCourse(course);
    setFormValidation('');

    const rule = course.allocationRule;
    const assignments = course.currentFacultyAssignments || [];
    const slots = course.facultySlots || [];

    if (rule === 'LAB_2_TO_3') {
      const primarySlot = slots.find((s) => s.role === 'PRIMARY');
      const addSlot = slots.find((s) => s.role === 'ADDITIONAL');
      const optSlot = slots.find((s) => s.role === 'OPTIONAL');

      const primaryAssign = assignments.find((a) => a.role === 'PRIMARY');
      const addAssign = assignments.find((a) => a.role === 'ADDITIONAL');
      const optAssign = assignments.find((a) => a.role === 'OPTIONAL');

      setLabPrimaryFacultyId(primaryAssign?.facultyId || primarySlot?.faculty?.facultyId || '');
      setLabAdditionalFacultyId(addAssign?.facultyId || addSlot?.faculty?.facultyId || '');
      setLabOptionalFacultyId(optAssign?.facultyId || optSlot?.faculty?.facultyId || '');
    } else if (rule === 'MC_SAS') {
      const mathsAssign = assignments.find((a) => a.role === 'MATHS_BME');
      const engAssign = assignments.find((a) => a.role === 'ENGLISH');
      const mathsSlot = slots.find((s) => s.role === 'MATHS_BME');
      const engSlot = slots.find((s) => s.role === 'ENGLISH');

      setSasMathsFacultyId(mathsAssign?.facultyId || mathsSlot?.faculty?.facultyId || '');
      setSasEnglishFacultyId(engAssign?.facultyId || engSlot?.faculty?.facultyId || '');
    } else if (rule === 'MC_DEPARTMENT') {
      const primaryAssign = assignments.find((a) => a.role === 'PRIMARY');
      const primarySlot = slots.find((s) => s.role === 'PRIMARY');
      setDeptFacultyId(primaryAssign?.facultyId || primarySlot?.faculty?.facultyId || '');
    } else if (rule === 'MC_OPTIONAL_MAPPING') {
      const primaryAssign = assignments.find((a) => a.role === 'PRIMARY');
      setOptFacultyId(primaryAssign?.facultyId || '');
      setMappingEnabled(Boolean(course.timetableMapping?.enabled));
    } else {
      // THEORY_SINGLE
      const primaryAssign = assignments.find((a) => a.role === 'THEORY' || a.role === 'PRIMARY');
      const primarySlot = slots[0];
      setTheoryFacultyId(primaryAssign?.facultyId || primarySlot?.faculty?.facultyId || '');
    }

    setIsModalOpen(true);
  };

  const handleSaveAllocation = async (e) => {
    e.preventDefault();
    if (!activeCourse) return;

    try {
      setSubmitting(true);
      setFormValidation('');

      const ctxId = await getOrCreateActiveContextId();
      if (!ctxId) {
        setFormValidation('Unable to resolve or create academic context.');
        setSubmitting(false);
        return;
      }

      const rule = activeCourse.allocationRule;
      let payload = {};

      if (rule === 'LAB_2_TO_3') {
        if (!labPrimaryFacultyId) {
          if (activeCourse.linkedTheoryCourseCode) {
            setFormValidation(
              `Theory course '${activeCourse.linkedTheoryCourseCode}' must be allocated before allocating linked laboratory course '${activeCourse.courseCode}'.`
            );
          } else {
            setFormValidation('Please select a PRIMARY faculty member.');
          }
          setSubmitting(false);
          return;
        }

        if (!labAdditionalFacultyId) {
          setFormValidation('Please select a mandatory ADDITIONAL faculty member.');
          setSubmitting(false);
          return;
        }

        if (labPrimaryFacultyId === labAdditionalFacultyId) {
          setFormValidation('Primary and Additional faculty must be distinct faculty members.');
          setSubmitting(false);
          return;
        }

        if (
          labOptionalFacultyId &&
          (labOptionalFacultyId === labPrimaryFacultyId || labOptionalFacultyId === labAdditionalFacultyId)
        ) {
          setFormValidation('Optional faculty must be distinct from Primary and Additional instructors.');
          setSubmitting(false);
          return;
        }

        const facultyAssignments = [
          { facultyId: labPrimaryFacultyId, role: 'PRIMARY' },
          { facultyId: labAdditionalFacultyId, role: 'ADDITIONAL' },
        ];
        if (labOptionalFacultyId) {
          facultyAssignments.push({ facultyId: labOptionalFacultyId, role: 'OPTIONAL' });
        }

        payload = { facultyAssignments };
      } else if (rule === 'MC_SAS') {
        if (!sasMathsFacultyId) {
          setFormValidation('Please select a MATHS_BME instructor.');
          setSubmitting(false);
          return;
        }
        if (!sasEnglishFacultyId) {
          setFormValidation('Please select an ENGLISH instructor.');
          setSubmitting(false);
          return;
        }
        if (sasMathsFacultyId === sasEnglishFacultyId) {
          setFormValidation('The same faculty cannot occupy both MATHS_BME and ENGLISH roles.');
          setSubmitting(false);
          return;
        }

        payload = {
          facultyAssignments: [
            { facultyId: sasMathsFacultyId, role: 'MATHS_BME' },
            { facultyId: sasEnglishFacultyId, role: 'ENGLISH' },
          ],
        };
      } else if (rule === 'MC_DEPARTMENT') {
        if (!deptFacultyId) {
          setFormValidation('Please select an active department faculty member.');
          setSubmitting(false);
          return;
        }
        payload = {
          facultyAssignments: [{ facultyId: deptFacultyId, role: 'PRIMARY' }],
        };
      } else if (rule === 'MC_OPTIONAL_MAPPING') {
        const facultyAssignments = optFacultyId ? [{ facultyId: optFacultyId, role: 'PRIMARY' }] : [];
        payload = {
          facultyAssignments,
          timetableMapping: {
            allowed: true,
            required: false,
            enabled: mappingEnabled,
          },
        };
      } else {
        // THEORY_SINGLE
        if (!theoryFacultyId) {
          setFormValidation('Please select a subject faculty member.');
          setSubmitting(false);
          return;
        }
        payload = {
          facultyAssignments: [{ facultyId: theoryFacultyId, role: 'THEORY' }],
          facultyId: theoryFacultyId,
        };
      }

      await saveCourseAllocation(ctxId, activeCourse.courseCode, payload);
      showToast(`Saved faculty allocation for ${activeCourse.courseCode}.`, 'success');
      setIsModalOpen(false);
      await loadContextAllocations(ctxId);
    } catch (err) {
      console.error('[HODFacultyAllocationPage] Save allocation failed:', err);
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to save faculty allocation.';
      setFormValidation(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const courses = allocationContextData?.courses || [];

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <PageHeader
        title="Course → Faculty Allocation"
        description="Statutory HOD authority for binding faculty assignments across all curriculum semesters (Semester III to VIII) and cohorts. Driven authoritatively by backend policy."
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
              if (activeContextId) loadContextAllocations(activeContextId);
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
              R22 Curriculum Master • {courses.length} Registered Semester Courses
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
        {loading || contextLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spinner size="lg" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading course allocation roster for {selectedSemester}...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={() => loadBaseData()} />
          </div>
        ) : courses.length === 0 ? (
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
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Title & Rule</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type & Credits</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>HOD-Assigned Faculty</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Allocation Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {courses.map((crs, index) => {
                  const rule = crs.allocationRule;
                  const assignments = crs.currentFacultyAssignments || [];
                  const status = crs.allocationStatus || 'UNALLOCATED';

                  const isComplete = ['COMPLETE', 'COMPLETE_2', 'COMPLETE_3'].includes(status);
                  const isOptionalNotMapped = status === 'OPTIONAL_NOT_MAPPED';

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
                        backgroundColor: isComplete
                          ? 'transparent'
                          : isOptionalNotMapped
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
                        <div>{crs.courseTitle}</div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                          {crs.category && (
                            <Badge variant="outline" size="sm">
                              {crs.category}
                            </Badge>
                          )}
                          <Badge variant={rule === 'LAB_2_TO_3' ? 'primary' : rule === 'MC_SAS' ? 'secondary' : 'neutral'} size="sm">
                            {rule}
                          </Badge>
                          {crs.linkedTheoryCourseCode && (
                            <Badge variant="outline" size="sm">
                              Linked: {crs.linkedTheoryCourseCode}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          color: 'var(--color-on-surface-variant)',
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>
                          {crs.sessionType || crs.courseType}
                        </span>
                        {periodText ? ` • ${periodText}` : ''}
                        {crs.credits !== undefined ? ` • ${crs.credits} Credits` : ''}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {/* Dynamic Faculty Presentation based on Rule */}
                        {rule === 'LAB_2_TO_3' ? (
                          assignments.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {assignments.map((fa) => (
                                <div key={fa.facultyId} style={{ fontSize: '0.8125rem' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                                    [{fa.role}]
                                  </span>{' '}
                                  {fa.facultyName || fa.facultyId} ({fa.facultyId})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-warning)', fontWeight: 600, fontSize: '0.8125rem' }}>
                              [LAB REQUIRES 2–3 FACULTY]
                            </span>
                          )
                        ) : rule === 'MC_SAS' ? (
                          assignments.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {assignments.map((fa) => (
                                <div key={fa.facultyId} style={{ fontSize: '0.8125rem' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--color-secondary)' }}>
                                    [{fa.role}]
                                  </span>{' '}
                                  {fa.facultyName || fa.facultyId} ({fa.facultyId})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-warning)', fontWeight: 600, fontSize: '0.8125rem' }}>
                              [MATHS_BME & ENGLISH REQUIRED]
                            </span>
                          )
                        ) : rule === 'MC_OPTIONAL_MAPPING' ? (
                          isOptionalNotMapped ? (
                            <span style={{ color: 'var(--color-outline)', fontStyle: 'italic', fontSize: '0.8125rem' }}>
                              Optional (Timetable Mapping Disabled)
                            </span>
                          ) : assignments.length > 0 ? (
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                              {assignments[0].facultyName || assignments[0].facultyId} (Mapped)
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-primary)', fontSize: '0.8125rem' }}>
                              Mapped (No faculty assigned)
                            </span>
                          )
                        ) : assignments.length > 0 ? (
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--color-on-surface)' }}>
                              {assignments[0].facultyName || assignments[0].facultyId}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>
                              ID: {assignments[0].facultyId}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-warning)', fontWeight: 600, fontSize: '0.8125rem' }}>
                            [REQUIRES HOD DECISION]
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {isComplete ? (
                          <Badge variant="success">{status}</Badge>
                        ) : isOptionalNotMapped ? (
                          <Badge variant="secondary">NOT MAPPED</Badge>
                        ) : (
                          <Badge variant="warning">{status}</Badge>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <Button
                          variant={isComplete ? 'outline' : 'primary'}
                          size="sm"
                          onClick={() => handleOpenAssignModal(crs)}
                        >
                          {isComplete ? 'Edit Allocation' : 'Assign Faculty'}
                        </Button>
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
          title={`Faculty Allocation — ${activeCourse.courseCode}`}
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
                {activeCourse.courseCode}: {activeCourse.courseTitle}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-on-surface-variant)',
                  marginTop: '2px',
                }}
              >
                Cohort: {selectedYear} Section &apos;{selectedSection}&apos; • {selectedSemester} • Rule: {activeCourse.allocationRule}
              </div>
            </div>

            {/* Form Fields: LAB_2_TO_3 */}
            {activeCourse.allocationRule === 'LAB_2_TO_3' && (
              <>
                {/* PRIMARY SLOT */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>
                    PRIMARY Faculty * {activeCourse.linkedTheoryCourseCode ? `(Theory-linked to ${activeCourse.linkedTheoryCourseCode})` : ''}
                  </label>
                  {activeCourse.linkedTheoryCourseCode ? (
                    labPrimaryFacultyId ? (
                      <div
                        style={{
                          padding: '10px 12px',
                          background: 'var(--color-surface-container-high)',
                          borderRadius: '6px',
                          border: '1px solid var(--color-outline-variant)',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {facultyList.find((f) => f.facultyId === labPrimaryFacultyId)?.facultyName || labPrimaryFacultyId} ({labPrimaryFacultyId})
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '2px' }}>
                          Authoritatively locked to Theory course ({activeCourse.linkedTheoryCourseCode})
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '10px 12px',
                          background: 'var(--color-warning-container)',
                          color: 'var(--color-on-warning-container)',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                        }}
                      >
                        ⚠️ Linked Theory course ({activeCourse.linkedTheoryCourseCode}) must be allocated before allocating this Laboratory course.
                      </div>
                    )
                  ) : (
                    <Select
                      value={labPrimaryFacultyId}
                      onChange={(e) => setLabPrimaryFacultyId(e.target.value)}
                      options={facultyList.map((f) => ({
                        value: f.facultyId,
                        label: `${f.facultyName} (${f.facultyId}) — ${f.department}`,
                      }))}
                      required
                      disabled={submitting}
                    />
                  )}
                </div>

                {/* ADDITIONAL SLOT */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>
                    ADDITIONAL Faculty * (Mandatory Secondary Lab Faculty)
                  </label>
                  <Select
                    value={labAdditionalFacultyId}
                    onChange={(e) => setLabAdditionalFacultyId(e.target.value)}
                    options={[
                      { value: '', label: '-- Select Additional Faculty --' },
                      ...facultyList
                        .filter((f) => f.facultyId !== labPrimaryFacultyId)
                        .map((f) => ({
                          value: f.facultyId,
                          label: `${f.facultyName} (${f.facultyId}) — ${f.department}`,
                        })),
                    ]}
                    required
                    disabled={submitting}
                  />
                </div>

                {/* OPTIONAL SLOT */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>
                    OPTIONAL Faculty (Tertiary Lab Faculty)
                  </label>
                  <Select
                    value={labOptionalFacultyId}
                    onChange={(e) => setLabOptionalFacultyId(e.target.value)}
                    options={[
                      { value: '', label: 'None (Optional)' },
                      ...facultyList
                        .filter(
                          (f) =>
                            f.facultyId !== labPrimaryFacultyId &&
                            f.facultyId !== labAdditionalFacultyId
                        )
                        .map((f) => ({
                          value: f.facultyId,
                          label: `${f.facultyName} (${f.facultyId}) — ${f.department}`,
                        })),
                    ]}
                    disabled={submitting}
                  />
                </div>
              </>
            )}

            {/* Form Fields: MC_SAS */}
            {activeCourse.allocationRule === 'MC_SAS' && (() => {
              const mathsSlot = (activeCourse.facultySlots || []).find((s) => s.role === 'MATHS_BME');
              const engSlot = (activeCourse.facultySlots || []).find((s) => s.role === 'ENGLISH');
              const mathsFacultyList = mathsSlot?.eligibleFaculty || [];
              const englishFacultyList = engSlot?.eligibleFaculty || [];

              return (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>
                      MATHS_BME Instructor *
                    </label>
                    {contextLoading ? (
                      <div className="text-xs text-muted" style={{ padding: '8px 0' }}>
                        Loading Mathematics faculty...
                      </div>
                    ) : mathsFacultyList.length === 0 ? (
                      <div
                        style={{
                          padding: '10px 12px',
                          background: 'var(--color-error-container, #fee2e2)',
                          color: 'var(--color-error, #991b1b)',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                        }}
                      >
                        ⚠️ No active Mathematics faculty available.
                      </div>
                    ) : (
                      <Select
                        value={sasMathsFacultyId}
                        onChange={(e) => setSasMathsFacultyId(e.target.value)}
                        placeholder="-- Select MATHS_BME Instructor --"
                        options={mathsFacultyList
                          .filter((f) => f.facultyId !== sasEnglishFacultyId)
                          .map((f) => ({
                            value: f.facultyId,
                            label: `${f.facultyName} (${f.facultyId}) — ${f.designation || f.department}`,
                          }))}
                        required
                        disabled={submitting}
                      />
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>
                      ENGLISH Instructor *
                    </label>
                    {contextLoading ? (
                      <div className="text-xs text-muted" style={{ padding: '8px 0' }}>
                        Loading English faculty...
                      </div>
                    ) : englishFacultyList.length === 0 ? (
                      <div
                        style={{
                          padding: '10px 12px',
                          background: 'var(--color-error-container, #fee2e2)',
                          color: 'var(--color-error, #991b1b)',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                        }}
                      >
                        ⚠️ No active English faculty available.
                      </div>
                    ) : (
                      <Select
                        value={sasEnglishFacultyId}
                        onChange={(e) => setSasEnglishFacultyId(e.target.value)}
                        placeholder="-- Select ENGLISH Instructor --"
                        options={englishFacultyList
                          .filter((f) => f.facultyId !== sasMathsFacultyId)
                          .map((f) => ({
                            value: f.facultyId,
                            label: `${f.facultyName} (${f.facultyId}) — ${f.designation || f.department}`,
                          }))}
                        required
                        disabled={submitting}
                      />
                    )}
                  </div>
                </>
              );
            })()}


            {/* Form Fields: MC_DEPARTMENT */}
            {activeCourse.allocationRule === 'MC_DEPARTMENT' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>
                  Department Faculty * (Eligible Cohort Faculty)
                </label>
                <Select
                  value={deptFacultyId}
                  onChange={(e) => setDeptFacultyId(e.target.value)}
                  options={[
                    { value: '', label: '-- Select Department Faculty --' },
                    ...(activeCourse.eligibleFaculty && activeCourse.eligibleFaculty.length > 0
                      ? activeCourse.eligibleFaculty
                      : facultyList
                    ).map((f) => ({
                      value: f.facultyId,
                      label: `${f.facultyName} (${f.facultyId}) — ${f.department}`,
                    })),
                  ]}
                  required
                  disabled={submitting}
                />
              </div>
            )}

            {/* Form Fields: MC_OPTIONAL_MAPPING (Induction) */}
            {activeCourse.allocationRule === 'MC_OPTIONAL_MAPPING' && (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    background: 'var(--color-surface-container)',
                    borderRadius: '6px',
                  }}
                >
                  <input
                    type="checkbox"
                    id="enableMappingCheckbox"
                    checked={mappingEnabled}
                    onChange={(e) => setMappingEnabled(e.target.checked)}
                    disabled={submitting}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label
                    htmlFor="enableMappingCheckbox"
                    style={{ fontWeight: 600, cursor: 'pointer', fontSize: '0.8125rem' }}
                  >
                    Enable Timetable Mapping for Induction
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>
                    Optional Faculty Member
                  </label>
                  <Select
                    value={optFacultyId}
                    onChange={(e) => setOptFacultyId(e.target.value)}
                    options={[
                      { value: '', label: 'None (Optional)' },
                      ...facultyList.map((f) => ({
                        value: f.facultyId,
                        label: `${f.facultyName} (${f.facultyId}) — ${f.department}`,
                      })),
                    ]}
                    disabled={submitting}
                  />
                </div>
              </>
            )}

            {/* Form Fields: THEORY_SINGLE */}
            {activeCourse.allocationRule === 'THEORY_SINGLE' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>
                  Select Subject Faculty Member *
                </label>
                <Select
                  value={theoryFacultyId}
                  onChange={(e) => setTheoryFacultyId(e.target.value)}
                  options={[
                    { value: '', label: '-- Select Faculty Member --' },
                    ...facultyList.map((f) => ({
                      value: f.facultyId,
                      label: `${f.facultyName} (${f.facultyId}) — ${f.department}`,
                    })),
                  ]}
                  required
                  disabled={submitting}
                />
              </div>
            )}

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
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={
                  submitting ||
                  (activeCourse.allocationRule === 'LAB_2_TO_3' &&
                    activeCourse.linkedTheoryCourseCode &&
                    !labPrimaryFacultyId)
                }
              >
                {submitting ? 'Saving...' : 'Save Allocation'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
