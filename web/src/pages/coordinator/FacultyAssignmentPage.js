import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getCourseFacultyHandlers,
  createCourseFacultyHandler,
  deleteCourseFacultyHandler,
} from '../../services/coordinatorService';
import { getHODAllocations } from '../../services/hodAllocationService';
import { getCourses } from '../../services/courseService';
import { getFacultyList } from '../../services/facultyService';
import { getAcademicContexts } from '../../services/academicContextService';

import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import Modal from '../../components/common/Modal';

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
  const [handlers, setHandlers] = useState([]);

  // Active Cohort Selection
  const [selectedYear, setSelectedYear] = useState('II Year');
  const [selectedSection, setSelectedSection] = useState('A');

  // Secondary Note Modal State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [noteForm, setNoteForm] = useState({
    courseCode: '',
    candidateFacultyIds: [],
    preferredFacultyId: '',
    remarks: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [allocRes, crsRes, facRes, ctxRes, handRes] = await Promise.allSettled([
        getHODAllocations(),
        getCourses(),
        getFacultyList({ limit: 100 }),
        getAcademicContexts(),
        getCourseFacultyHandlers(),
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
      if (handRes.status === 'fulfilled' && handRes.value) {
        const list = Array.isArray(handRes.value) ? handRes.value : handRes.value.data || [];
        setHandlers(list);
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

  // Resolve current active AcademicContext ID
  const activeContext = contexts.find(
    (c) => c.year === selectedYear && c.section === selectedSection && c.department === 'CSE'
  );
  const activeContextId = activeContext?._id || activeContext?.id;

  // Filter courses for the selected cohort's semester
  const targetSemester = SEMESTER_MAP[selectedYear] || 3;
  const filteredCourses = courses.filter((c) => {
    if (!c.semester) return true;
    return Number(c.semester) === targetSemester;
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

  const handleOpenAddNote = (courseCode = '') => {
    setNoteForm({
      courseCode: courseCode || (filteredCourses[0]?.courseCode || ''),
      candidateFacultyIds: [],
      preferredFacultyId: '',
      remarks: '',
    });
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteForm.courseCode) return;
    try {
      setSavingNote(true);
      await createCourseFacultyHandler({
        courseCode: noteForm.courseCode.toUpperCase().trim(),
        candidateFacultyIds: noteForm.candidateFacultyIds,
        preferredFacultyId: noteForm.preferredFacultyId || null,
        remarks: noteForm.remarks || null,
      });
      showToast(`Coordinator note for ${noteForm.courseCode} recorded.`, 'success');
      setIsNoteModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to record preference note.', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (courseCode) => {
    if (!window.confirm(`Delete preference note for ${courseCode}?`)) return;
    try {
      await deleteCourseFacultyHandler(courseCode);
      showToast(`Preference note for ${courseCode} removed.`, 'info');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to remove note.', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Course — Faculty Allocation Matrix"
        description="Authoritative course-to-faculty allocations approved by the Head of Department (HOD) across the 12 target class cohorts for Academic Year 2026-27 (Odd Semester). Academic Coordinators design timetable schedules adhering strictly to these allocations."
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
              Head of Department (HOD) is the authoritative decision maker for Course ➔ Faculty allocation. Academic Coordinators prepare timetable schedules by assigning timeslots in the Timetable Designer adhering strictly to these allocations.
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
              CSE — {selectedYear} &apos;{selectedSection}&apos; (Semester {targetSemester}, Odd 2026-27)
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

      {/* Course -> Faculty Allocation Table */}
      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: '28px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Authoritative Course — Faculty Allocations
          </h3>
          <Button
            variant="outline"
            size="sm"
            icon="📝"
            onClick={() => handleOpenAddNote()}
          >
            Add Coordinator Preference Note
          </Button>
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
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Allocation Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Design Readiness</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((crs) => {
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
                        {crs.courseName || crs.title || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <Badge variant="outline">{crs.type || 'THEORY'}</Badge>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>
                            {crs.credits ? `${crs.credits} Credits` : crs.periodsPerWeek ? `${crs.periodsPerWeek} hrs` : ''}
                          </span>
                        </div>
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
                            <Badge variant="warning">[REQUIRES HOD DECISION]</Badge>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>
                              Unassigned
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {existingAlloc ? (
                          <Badge variant="success">
                            {existingAlloc.allocationType || 'THEORY'}
                          </Badge>
                        ) : (
                          <span style={{ color: 'var(--color-outline)', fontSize: '0.8125rem' }}>Pending</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {existingAlloc ? (
                          <Button
                            variant="subtle"
                            size="sm"
                            icon="⚡"
                            onClick={() => {
                              window.location.href = '/coordinator/optimization-solver';
                            }}
                          >
                            Schedule Slot
                          </Button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-warning-dark)', fontWeight: 600 }}>
                            Awaiting HOD
                          </span>
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

      {/* Secondary Section: Coordinator Preference Notes */}
      {handlers.length > 0 && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                Coordinator Course Preference Notes ({handlers.length})
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-outline)' }}>
                Internal notes and instructor recommendations maintained by Academic Coordinators.
              </p>
            </div>
          </div>

          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Code</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Recommended Faculty Pool</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Preferred Instructor</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Remarks</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {handlers.map((h) => (
                  <tr key={h._id || h.courseCode} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {h.courseCode}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {h.candidateFacultyIds?.map((facId) => (
                          <Badge key={facId} variant={facId === h.preferredFacultyId ? 'success' : 'secondary'}>
                            {facId}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {h.preferredFacultyId ? (
                        <Badge variant="success">⭐ {h.preferredFacultyId}</Badge>
                      ) : (
                        <span style={{ color: 'var(--color-outline)' }}>None designated</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>
                      {h.remarks || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteNote(h.courseCode)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Preference Note Modal */}
      {isNoteModalOpen && (
        <Modal
          isOpen={isNoteModalOpen}
          onClose={() => !savingNote && setIsNoteModalOpen(false)}
          title="Add Coordinator Preference Note"
        >
          <form onSubmit={handleSaveNote}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Course
              </label>
              <select
                value={noteForm.courseCode}
                onChange={(e) => setNoteForm({ ...noteForm, courseCode: e.target.value })}
                className="form-select"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
              >
                {courses.map((crs) => (
                  <option key={crs.courseCode} value={crs.courseCode}>
                    {crs.courseCode}: {crs.courseName}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Preferred Faculty (Optional)
              </label>
              <select
                value={noteForm.preferredFacultyId}
                onChange={(e) => {
                  const val = e.target.value;
                  setNoteForm((prev) => ({
                    ...prev,
                    preferredFacultyId: val,
                    candidateFacultyIds: val ? [val] : [],
                  }));
                }}
                className="form-select"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
              >
                <option value="">-- Select Preferred Faculty --</option>
                {facultyList.map((f) => (
                  <option key={f.facultyId} value={f.facultyId}>
                    {f.facultyId}: {f.facultyName}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Remarks / Recommendations
              </label>
              <input
                type="text"
                placeholder="e.g. Recommended instructor due to lab specialization"
                value={noteForm.remarks}
                onChange={(e) => setNoteForm({ ...noteForm, remarks: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsNoteModalOpen(false)}
                disabled={savingNote}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={savingNote}
              >
                {savingNote ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
