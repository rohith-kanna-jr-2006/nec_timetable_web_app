import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getHODAllocations,
  createHODAllocation,
  deleteHODAllocation,
} from '../../services/hodAllocationService';
import { getFacultyList } from '../../services/facultyService';
import { getAcademicContexts } from '../../services/academicContextService';
import { getCourses } from '../../services/courseService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';

export default function HODFacultyAllocationPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allocations, setAllocations] = useState([]);

  // Form reference data
  const [facultyList, setFacultyList] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [courses, setCourses] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formValidation, setFormValidation] = useState('');

  const [formData, setFormData] = useState({
    academicContextId: '',
    facultyId: '',
    courseCode: '',
    courseName: '',
    allocationType: 'THEORY',
  });

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

  const handleOpenModal = () => {
    setFormData({
      academicContextId: contexts[0]?._id || '',
      facultyId: facultyList[0]?.facultyId || '',
      courseCode: courses[0]?.courseCode || '',
      courseName: courses[0]?.courseName || '',
      allocationType: 'THEORY',
    });
    setFormValidation('');
    setIsModalOpen(true);
  };

  const handleCourseChange = (e) => {
    const code = e.target.value;
    const match = courses.find((c) => c.courseCode === code);
    setFormData({
      ...formData,
      courseCode: code,
      courseName: match?.courseName || code,
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.academicContextId || !formData.facultyId || !formData.courseCode) {
      setFormValidation('Cohort, Faculty member, and Course Code are required.');
      return;
    }

    const fac = facultyList.find((f) => f.facultyId === formData.facultyId);

    try {
      setCreating(true);
      setFormValidation('');
      await createHODAllocation({
        academicContextId: formData.academicContextId,
        facultyId: formData.facultyId,
        facultyName: fac?.facultyName || formData.facultyId,
        courseCode: formData.courseCode.toUpperCase().trim(),
        courseName: formData.courseName,
        allocationType: formData.allocationType,
        status: 'APPROVED',
      });
      showToast('Faculty allocation ratified and assigned.', 'success');
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('[HODFacultyAllocationPage] Create failed:', err);
      setFormValidation(err.message || 'Failed to record faculty allocation.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, desc) => {
    if (!window.confirm(`Revoke allocation for ${desc}?`)) return;
    try {
      await deleteHODAllocation(id);
      showToast('Faculty allocation revoked.', 'info');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Could not delete allocation.', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Executive Faculty Allocation"
        description="Ratified institutional course-faculty assignments for CSE academic cohorts."
        breadcrumbs={[
          { label: 'HOD Portal', path: '/hod/dashboard' },
          { label: 'Faculty Allocation' },
        ]}
        badge={<Badge variant="primary">HOD RATIFIED</Badge>}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon="➕"
            onClick={handleOpenModal}
          >
            Assign Faculty Course
          </Button>
        }
      />

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Ratified Allocations ({allocations.length})
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spinner size="md" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading allocations...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadData} />
          </div>
        ) : allocations.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              title="No faculty allocations registered"
              description="No ratified course-to-faculty assignments currently recorded."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  icon="➕"
                  onClick={handleOpenModal}
                >
                  Create First Allocation
                </Button>
              }
            />
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Cohort / Class</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Code</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Title</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Faculty Member</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((alloc) => (
                  <tr key={alloc._id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {alloc.academicContextId?.year ? `${alloc.academicContextId.year} '${alloc.academicContextId.section}'` : 'CSE Cohort'}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                      {alloc.courseCode}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                      {alloc.courseName || alloc.courseCode}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontWeight: 600 }}>{alloc.facultyName || alloc.facultyId}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginLeft: '6px' }}>
                        ({alloc.facultyId})
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={alloc.allocationType === 'LAB' ? 'warning' : 'secondary'}>
                        {alloc.allocationType || 'THEORY'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={alloc.status === 'APPROVED' ? 'success' : 'neutral'}>
                        {alloc.status || 'APPROVED'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(alloc._id, `${alloc.courseCode} (${alloc.facultyId})`)}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Allocation Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => !creating && setIsModalOpen(false)}
          title="Ratify Faculty Course Allocation"
        >
          <form onSubmit={handleCreate}>
            {formValidation && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', fontSize: '0.8125rem', marginBottom: '14px' }}>
                {formValidation}
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Target Cohort (Class & Section)
              </label>
              <select
                value={formData.academicContextId}
                onChange={(e) => setFormData({ ...formData, academicContextId: e.target.value })}
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

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Course Subject
              </label>
              <select
                value={formData.courseCode}
                onChange={handleCourseChange}
                className="form-select"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
              >
                {courses.map((crs) => (
                  <option key={crs.courseCode} value={crs.courseCode}>
                    {crs.courseCode}: {crs.courseName} ({crs.type})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Appointed Faculty Member
              </label>
              <select
                value={formData.facultyId}
                onChange={(e) => setFormData({ ...formData, facultyId: e.target.value })}
                className="form-select"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
              >
                {facultyList.map((f) => (
                  <option key={f.facultyId} value={f.facultyId}>
                    {f.facultyId}: {f.facultyName} ({f.designation})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Allocation Type
              </label>
              <select
                value={formData.allocationType}
                onChange={(e) => setFormData({ ...formData, allocationType: e.target.value })}
                className="form-select"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
              >
                <option value="THEORY">UG Theory (3 Period Block / Week)</option>
                <option value="LAB">Laboratory (4 Period Continuous Block / Week)</option>
                <option value="PG">PG Teaching (1 Period Equivalent)</option>
                <option value="OTHERS">Other Elective / PBL</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsModalOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={creating}
              >
                {creating ? 'Ratifying...' : 'Ratify Allocation'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
