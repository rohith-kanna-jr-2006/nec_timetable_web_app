import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getCourseFacultyHandlers,
  createCourseFacultyHandler,
  updateCourseFacultyHandler,
  deleteCourseFacultyHandler,
} from '../../services/coordinatorService';
import { getCourses } from '../../services/courseService';
import { getFacultyList } from '../../services/facultyService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';

export default function FacultyAssignmentPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [handlers, setHandlers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [facultyList, setFacultyList] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formValidation, setFormValidation] = useState('');

  const [formData, setFormData] = useState({
    courseCode: '',
    candidateFacultyIds: [],
    preferredFacultyId: '',
    remarks: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [handRes, crsRes, facRes] = await Promise.allSettled([
        getCourseFacultyHandlers(),
        getCourses(),
        getFacultyList({ limit: 100 }),
      ]);

      if (handRes.status === 'fulfilled' && handRes.value) {
        const list = Array.isArray(handRes.value) ? handRes.value : handRes.value.data || [];
        setHandlers(list);
      }
      if (crsRes.status === 'fulfilled' && crsRes.value) {
        const list = Array.isArray(crsRes.value) ? crsRes.value : crsRes.value.data || [];
        setCourses(list);
      }
      if (facRes.status === 'fulfilled' && facRes.value) {
        const list = facRes.value.items || facRes.value.data || (Array.isArray(facRes.value) ? facRes.value : []);
        setFacultyList(list);
      }
    } catch (err) {
      console.error('[FacultyAssignmentPage] Failed to fetch:', err);
      setError(err.message || 'Unable to retrieve handler nomination matrix.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({
      courseCode: courses[0]?.courseCode || '',
      candidateFacultyIds: [],
      preferredFacultyId: '',
      remarks: '',
    });
    setFormValidation('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (handler) => {
    setIsEditing(true);
    setFormData({
      courseCode: handler.courseCode,
      candidateFacultyIds: handler.candidateFacultyIds || [],
      preferredFacultyId: handler.preferredFacultyId || '',
      remarks: handler.remarks || '',
    });
    setFormValidation('');
    setIsModalOpen(true);
  };

  const handleToggleCandidate = (facultyId) => {
    setFormData((prev) => {
      const exists = prev.candidateFacultyIds.includes(facultyId);
      const nextList = exists
        ? prev.candidateFacultyIds.filter((id) => id !== facultyId)
        : [...prev.candidateFacultyIds, facultyId];

      const nextPreferred =
        prev.preferredFacultyId === facultyId && exists
          ? ''
          : prev.preferredFacultyId;

      return {
        ...prev,
        candidateFacultyIds: nextList,
        preferredFacultyId: nextPreferred,
      };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.courseCode) {
      setFormValidation('Course code is required.');
      return;
    }
    if (formData.candidateFacultyIds.length === 0) {
      setFormValidation('Please select at least one candidate faculty member.');
      return;
    }

    try {
      setSaving(true);
      setFormValidation('');

      if (isEditing) {
        await updateCourseFacultyHandler(formData.courseCode, {
          candidateFacultyIds: formData.candidateFacultyIds,
          preferredFacultyId: formData.preferredFacultyId || null,
          remarks: formData.remarks || null,
        });
        showToast(`Candidate pool for ${formData.courseCode} updated.`, 'success');
      } else {
        await createCourseFacultyHandler({
          courseCode: formData.courseCode.toUpperCase().trim(),
          candidateFacultyIds: formData.candidateFacultyIds,
          preferredFacultyId: formData.preferredFacultyId || null,
          remarks: formData.remarks || null,
        });
        showToast(`Candidate pool for ${formData.courseCode} registered.`, 'success');
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('[FacultyAssignmentPage] Save failed:', err);
      setFormValidation(err.message || 'Failed to save handler pool.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (courseCode) => {
    if (!window.confirm(`Delete candidate nomination pool for ${courseCode}?`)) return;
    try {
      await deleteCourseFacultyHandler(courseCode);
      showToast(`Handler pool for ${courseCode} removed.`, 'info');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to remove candidate pool.', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Candidate Faculty Pool Nominations"
        description="Academic Coordinator candidate instructor nomination matrix submitted for HOD executive ratification."
        breadcrumbs={[
          { label: 'Coordinator Portal', path: '/coordinator/dashboard' },
          { label: 'Faculty Assignment' },
        ]}
        badge={<Badge variant="secondary">AC NOMINATIONS</Badge>}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon="➕"
            onClick={handleOpenAdd}
          >
            Nominate Faculty Pool
          </Button>
        }
      />

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Course Candidate Pools ({handlers.length})
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spinner size="md" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading candidate handler pools...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadData} />
          </div>
        ) : handlers.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              title="No faculty candidate pools nominated"
              description="Nominate candidate faculty pools for curriculum courses to proceed with timetable scheduling."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  icon="➕"
                  onClick={handleOpenAdd}
                >
                  Create First Pool
                </Button>
              }
            />
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Code</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Candidate Faculty Pool</th>
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
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(h)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(h.courseCode)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Nomination Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => !saving && setIsModalOpen(false)}
          title={isEditing ? `Edit Pool: ${formData.courseCode}` : 'Nominate Faculty Candidate Pool'}
        >
          <form onSubmit={handleSave}>
            {formValidation && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', fontSize: '0.8125rem', marginBottom: '14px' }}>
                {formValidation}
              </div>
            )}

            {!isEditing && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                  Target Curriculum Course
                </label>
                <select
                  value={formData.courseCode}
                  onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
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
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Select Candidate Faculty Pool (Select 1 or more)
              </label>
              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-md)', padding: '8px' }}>
                {facultyList.map((fac) => {
                  const isChecked = formData.candidateFacultyIds.includes(fac.facultyId);
                  return (
                    <label
                      key={fac.facultyId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isChecked ? 'var(--color-surface-container-low)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCandidate(fac.facultyId)}
                      />
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fac.facultyId}</span>
                      <span style={{ fontSize: '0.875rem' }}>{fac.facultyName}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {formData.candidateFacultyIds.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                  Preferred Primary Instructor (Optional)
                </label>
                <select
                  value={formData.preferredFacultyId}
                  onChange={(e) => setFormData({ ...formData, preferredFacultyId: e.target.value })}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
                >
                  <option value="">No specific preference</option>
                  {formData.candidateFacultyIds.map((facId) => {
                    const match = facultyList.find((f) => f.facultyId === facId);
                    return (
                      <option key={facId} value={facId}>
                        {facId}: {match?.facultyName || facId}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Remarks / Recommendations
              </label>
              <input
                type="text"
                placeholder="e.g. Recommended for Section A due to domain expertise in Compilers"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Pool'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
