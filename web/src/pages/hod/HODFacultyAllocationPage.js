import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getHODAllocations,
  createHODAllocation,
  deleteHODAllocation,
} from '../../services/hodAllocationService';
import { getFacultyList } from '../../services/facultyService';
import { getAcademicContexts, createAcademicContext } from '../../services/academicContextService';
import { getCourses } from '../../services/courseService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import Modal from '../../components/common/Modal';
import Select from '../../components/common/Select';

// Authoritative 12 target class cohorts for 2026-27 Odd Semester CSE
const YEARS = ['II Year', 'III Year', 'IV Year'];
const SECTIONS = ['A', 'B', 'C', 'D'];

const SEMESTER_MAP = {
  'II Year': 3,
  'III Year': 5,
  'IV Year': 7,
};

export default function HODFacultyAllocationPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Core Data
  const [allocations, setAllocations] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [courses, setCourses] = useState([]);

  // Active Cohort Selection
  const [selectedYear, setSelectedYear] = useState('II Year');
  const [selectedSection, setSelectedSection] = useState('A');

  // Allocation Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCourse, setActiveCourse] = useState(null);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [allocationType, setAllocationType] = useState('THEORY');
  const [submitting, setSubmitting] = useState(false);
  const [formValidation, setFormValidation] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [allocRes, facRes, ctxRes, crsRes] = await Promise.allSettled([
        getHODAllocations(),
        getFacultyList({ limit: 100 }),
        getAcademicContexts(),
        getCourses(),
      ]);

      if (allocRes.status === 'fulfilled' && allocRes.value) {
        const list = Array.isArray(allocRes.value) ? allocRes.value : allocRes.value.data || [];
        setAllocations(list);
      }
      if (facRes.status === 'fulfilled' && facRes.value) {
        const list = facRes.value.items || facRes.value.data || (Array.isArray(facRes.value) ? facRes.value : []);
        setFacultyList(list);
        if (list.length > 0 && !selectedFacultyId) setSelectedFacultyId(list[0].facultyId);
      }
      if (ctxRes.status === 'fulfilled' && ctxRes.value) {
        const list = Array.isArray(ctxRes.value) ? ctxRes.value : ctxRes.value.data || [];
        setContexts(list);
      }
      if (crsRes.status === 'fulfilled' && crsRes.value) {
        const list = Array.isArray(crsRes.value) ? crsRes.value : crsRes.value.data || [];
        setCourses(list);
      }
    } catch (err) {
      console.error('[HODFacultyAllocationPage] Failed to fetch:', err);
      setError(err.message || 'Unable to retrieve allocation roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Resolve current active AcademicContext ID
  const activeContext = contexts.find(
    (c) => c.year === selectedYear && c.section === selectedSection && c.department === 'CSE'
  );
  const activeContextId = activeContext?._id || activeContext?.id;

  // Filter courses for the selected year's semester (e.g. Sem 3 for II Year, Sem 5 for III Year, Sem 7 for IV Year)
  const targetSemester = SEMESTER_MAP[selectedYear] || 3;
  const filteredCourses = courses.filter((c) => {
    if (!c.semester) return true;
    return Number(c.semester) === targetSemester;
  });

  const handleOpenAssignModal = (course, existingAllocation = null) => {
    setActiveCourse(course);
    setSelectedFacultyId(existingAllocation?.facultyId || facultyList[0]?.facultyId || '');
    setAllocationType(existingAllocation?.allocationType || (course.type === 'LAB' || (course.practical && course.practical > 0) ? 'LAB_PRIMARY' : 'THEORY'));
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
        // Create context on the fly if missing in DB
        const createdCtx = await createAcademicContext({
          academicYear: '2026-27',
          semester: 'Odd Semester',
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

      await createHODAllocation({
        academicContextId: ctxId,
        courseCode: activeCourse.courseCode,
        courseName: activeCourse.courseName || activeCourse.title || '',
        facultyId: selectedFacultyId,
        facultyName: facultyMatch?.facultyName || selectedFacultyId,
        allocationType,
        status: 'APPROVED', // Authoritative HOD decision
      });

      showToast(`Assigned ${facultyMatch?.facultyName || selectedFacultyId} to ${activeCourse.courseCode} (${selectedYear} - ${selectedSection}).`, 'success');
      setIsModalOpen(false);
      await loadData();
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
      await loadData();
    } catch (err) {
      console.error('[HODFacultyAllocationPage] Delete allocation failed:', err);
      showToast(err.message || 'Failed to remove allocation.', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Course → Faculty Allocation"
        description="Statutory HOD authority for ratifying course assignments to faculty across all 12 class cohorts. Workload master data serves as reference only; HOD makes the binding decision."
        breadcrumbs={[
          { label: 'HOD Portal', path: '/hod/dashboard' },
          { label: 'Course → Faculty Allocation' },
        ]}
        badge={<Badge variant="primary">HOD DECISION AUTHORITY</Badge>}
        actions={
          <Button variant="outline" size="sm" icon="🔄" onClick={loadData}>
            Refresh
          </Button>
        }
      />

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

      {/* Cohort Allocation Overview Header */}
      <Card style={{ marginBottom: '20px', padding: '16px 20px', background: 'var(--color-surface-container-lowest)', borderLeft: '4px solid var(--color-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              CSE — {selectedYear} &apos;{selectedSection}&apos; (Semester {targetSemester}, Odd 2026-27)
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-outline)', marginTop: '2px' }}>
              R22 Curriculum Master • {filteredCourses.length} Registered Semester Courses
            </div>
          </div>
          <Badge variant="secondary">HOD Ratification</Badge>
        </div>
      </Card>

      {/* Course -> Faculty Allocation Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
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
        ) : filteredCourses.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-outline)', fontSize: '0.875rem' }}>
            No courses found for Semester {targetSemester} in curriculum catalog.
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Code</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Title</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type & Credits</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>HOD-Assigned Faculty</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Allocation Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((crs) => {
                  // Find existing allocation for this course in this active context
                  const existingAlloc = allocations.find((a) => {
                    const matchCtx = activeContextId
                      ? String(a.academicContextId?._id || a.academicContextId) === String(activeContextId)
                      : a.academicContextId?.year === selectedYear && a.academicContextId?.section === selectedSection;
                    return matchCtx && a.courseCode === crs.courseCode;
                  });

                  const facultyMatch = existingAlloc
                    ? facultyList.find((f) => f.facultyId === existingAlloc.facultyId)
                    : null;

                  return (
                    <tr
                      key={crs.courseCode}
                      style={{
                        borderBottom: '1px solid var(--color-surface-container)',
                        backgroundColor: existingAlloc ? 'transparent' : 'rgba(245, 158, 11, 0.03)',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {crs.courseCode}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {crs.courseName || crs.title}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>
                        <span style={{ fontWeight: 500 }}>{crs.type || (crs.practical ? 'LAB' : 'THEORY')}</span>
                        {crs.credits ? ` • ${crs.credits} Credits` : ''}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {existingAlloc ? (
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--color-on-surface)' }}>
                              {facultyMatch?.facultyName || existingAlloc.facultyName || existingAlloc.facultyId}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>
                              ID: {existingAlloc.facultyId} • {existingAlloc.allocationType}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-warning)', fontWeight: 600, fontSize: '0.8125rem' }}>
                            [REQUIRES HOD DECISION]
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {existingAlloc ? (
                          <Badge variant="success">APPROVED</Badge>
                        ) : (
                          <Badge variant="warning">UNALLOCATED</Badge>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <Button
                            variant={existingAlloc ? 'outline' : 'primary'}
                            size="sm"
                            onClick={() => handleOpenAssignModal(crs, existingAlloc)}
                          >
                            {existingAlloc ? 'Reassign' : 'Assign Faculty'}
                          </Button>
                          {existingAlloc && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteAllocation(existingAlloc._id, crs.courseCode)}
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
          title={`Assign Faculty — ${activeCourse.courseCode}`}
        >
          <form onSubmit={handleSaveAllocation} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.875rem' }}>
            {formValidation && (
              <div style={{ padding: '8px 12px', background: 'var(--color-error-container)', color: 'var(--color-on-error-container)', borderRadius: '6px', fontSize: '0.8125rem' }}>
                {formValidation}
              </div>
            )}

            <div style={{ padding: '10px 12px', background: 'var(--color-surface-container-low)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-outline)' }}>TARGET COURSE & COHORT</div>
              <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
                {activeCourse.courseCode}: {activeCourse.courseName || activeCourse.title}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                Cohort: {selectedYear} Section &apos;{selectedSection}&apos; • Odd Semester 2026-27
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>
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
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
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
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Confirm Allocation'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
