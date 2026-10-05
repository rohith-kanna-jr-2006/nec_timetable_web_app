import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import Modal from '../../components/common/Modal';
import {
  getFacultyList,
  getFacultyById,
  updateFaculty,
  deleteFaculty,
} from '../../services/facultyService';
import { FACULTY_DESIGNATIONS } from '../../constants/responsibilityMaster';

export default function FacultyListPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');

  // View Details Modal State
  const [viewingFaculty, setViewingFaculty] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Edit Faculty Modal State
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [editFormData, setEditFormData] = useState({ facultyName: '', designation: '', dob: '', email: '', phone: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete Confirmation State
  const [deletingFaculty, setDeletingFaculty] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const loadFaculty = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getFacultyList({
        department: 'Department of Computer Science and Engineering',
        limit: 100,
      });
      const list = Array.isArray(res)
        ? res
        : res?.items || res?.data?.items || res?.data || res?.faculty || [];
      setFacultyList(list);
    } catch (err) {
      console.error('[FacultyListPage] Failed to load live faculty directory:', err);
      setError(err.message || 'Unable to connect to faculty directory service.');
      setFacultyList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFaculty();
  }, []);

  const handleOpenView = async (faculty) => {
    try {
      setViewLoading(true);
      setViewingFaculty(faculty);
      if (faculty.facultyId) {
        const detail = await getFacultyById(faculty.facultyId);
        if (detail) setViewingFaculty(detail);
      }
    } catch (err) {
      console.warn('[FacultyListPage] Could not fetch detailed profile, using row data:', err);
    } finally {
      setViewLoading(false);
    }
  };

  const handleOpenEdit = (faculty) => {
    setEditingFaculty(faculty);
    setEditFormData({
      facultyName: faculty.facultyName || '',
      designation: faculty.designation || FACULTY_DESIGNATIONS[0],
      dob: faculty.dob || '',
      email: faculty.email || '',
      phone: faculty.phone || '',
    });
    setEditError('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editFormData.facultyName.trim()) {
      setEditError('Faculty name is required.');
      return;
    }

    try {
      setEditSubmitting(true);
      setEditError('');
      await updateFaculty(editingFaculty.facultyId, {
        facultyName: editFormData.facultyName.trim(),
        designation: editFormData.designation,
        dob: editFormData.dob || undefined,
        email: editFormData.email.trim() || undefined,
        phone: editFormData.phone.trim() || undefined,
      });
      showToast('Faculty profile updated successfully.', 'success');
      setEditingFaculty(null);
      await loadFaculty();
    } catch (err) {
      console.error('[FacultyListPage] Update failed:', err);
      setEditError(err.message || 'Failed to update faculty profile.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingFaculty) return;
    try {
      setDeleteSubmitting(true);
      await deleteFaculty(deletingFaculty.facultyId);
      showToast(`Faculty '${deletingFaculty.facultyName}' deleted successfully.`, 'success');
      setDeletingFaculty(null);
      await loadFaculty();
    } catch (err) {
      console.error('[FacultyListPage] Delete failed:', err);
      showToast(err.message || 'Failed to delete faculty member.', 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const filtered = facultyList.filter((f) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      (f.facultyName && f.facultyName.toLowerCase().includes(q)) ||
      (f.facultyId && f.facultyId.toLowerCase().includes(q));

    const matchDesig = !designationFilter || f.designation === designationFilter;

    return matchSearch && matchDesig;
  });

  return (
    <div>
      <PageHeader
        title="Faculty Management"
        description="Authoritative HOD faculty directory: add, view, edit, and delete Computer Science & Engineering faculty members."
        breadcrumbs={[
          { label: 'HOD Portal', path: '/hod/dashboard' },
          { label: 'Faculty Management' },
        ]}
        badge={<Badge variant="primary">CSE DEPARTMENT</Badge>}
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/hod/faculty/add')}
            icon="➕"
          >
            Add New Faculty
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <Card style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '14px' }}>
          <Input
            placeholder="Search by faculty name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon="🔎"
            style={{ height: '38px' }}
          />

          <Select
            value={designationFilter}
            onChange={(e) => setDesignationFilter(e.target.value)}
            options={FACULTY_DESIGNATIONS.map((d) => ({ value: d, label: d }))}
            placeholder="All Designations"
            style={{ height: '38px' }}
          />
        </div>
      </Card>

      {/* Faculty Table Card */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
            <Spinner size="lg" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading faculty directory...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState
              title="Unable to load faculty directory"
              message={error}
              onRetry={loadFaculty}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '24px' }}>
            <EmptyState
              title="No faculty members found"
              description={search || designationFilter ? 'No faculty members match your filter criteria.' : 'No faculty records currently registered.'}
              action={
                <Button variant="primary" size="sm" onClick={() => navigate('/hod/faculty/add')} icon="➕">
                  Add First Faculty
                </Button>
              }
            />
          </div>
        ) : (
          <div>
            <div style={{ padding: '8px 14px', fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', background: 'var(--color-surface-container-low)', borderBottom: '1px solid var(--color-surface-container)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>↔️</span>
              <span>Scroll horizontally to view all faculty records and actions</span>
            </div>
            <div className="ui-table-scroll-container">
              <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Faculty ID</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Faculty Name</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Designation</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Weekly Load</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Workload Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((faculty, idx) => (
                    <tr
                      key={faculty.facultyId || idx}
                      style={{
                        borderBottom: '1px solid var(--color-surface-container)',
                        transition: 'background-color 150ms',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {faculty.facultyId}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                        {faculty.facultyName}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>
                        {faculty.designation}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {faculty.calculatedTotalHours ? `${faculty.calculatedTotalHours} hrs` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant={faculty.status === 'MATCHED' ? 'success' : faculty.status === 'REVIEW REQUIRED' ? 'warning' : 'neutral'}>
                          {faculty.status || 'ACTIVE'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenView(faculty)}
                            title="View Faculty Details"
                          >
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(faculty)}
                            title="Edit Faculty Details"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setDeletingFaculty(faculty)}
                            title="Delete Faculty Member"
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
          </div>
        )}
      </Card>

      {/* View Faculty Details Modal */}
      {viewingFaculty && (
        <Modal
          isOpen={true}
          onClose={() => setViewingFaculty(null)}
          title={`Faculty Details — ${viewingFaculty.facultyName}`}
        >
          {viewLoading ? (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <Spinner size="md" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.875rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>FACULTY ID</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: '2px' }}>{viewingFaculty.facultyId}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>DESIGNATION</div>
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>{viewingFaculty.designation}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>DEPARTMENT</div>
                  <div style={{ marginTop: '2px' }}>{viewingFaculty.department || 'Computer Science and Engineering'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>WORKLOAD TOTAL</div>
                  <div style={{ fontWeight: 700, marginTop: '2px', color: 'var(--color-primary)' }}>
                    {viewingFaculty.calculatedTotalHours ? `${viewingFaculty.calculatedTotalHours} Hours / Week` : 'Not Calculated'}
                  </div>
                </div>
              </div>

              {viewingFaculty.roles && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', fontWeight: 600, marginBottom: '6px' }}>SYSTEM ROLES</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {viewingFaculty.roles.map((r, i) => (
                      <Badge key={i} variant="primary">{r}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <Button variant="outline" size="sm" onClick={() => setViewingFaculty(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Edit Faculty Modal */}
      {editingFaculty && (
        <Modal
          isOpen={true}
          onClose={() => !editSubmitting && setEditingFaculty(null)}
          title={`Edit Faculty — ${editingFaculty.facultyId}`}
        >
          <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {editError && (
              <div style={{ padding: '8px 12px', background: 'var(--color-error-container)', color: 'var(--color-on-error-container)', borderRadius: '6px', fontSize: '0.8125rem' }}>
                {editError}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                Faculty Name *
              </label>
              <Input
                value={editFormData.facultyName}
                onChange={(e) => setEditFormData({ ...editFormData, facultyName: e.target.value })}
                required
                disabled={editSubmitting}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                Designation *
              </label>
              <Select
                value={editFormData.designation}
                onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                options={FACULTY_DESIGNATIONS.map((d) => ({ value: d, label: d }))}
                disabled={editSubmitting}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                  Date of Birth
                </label>
                <Input
                  type="date"
                  value={editFormData.dob}
                  onChange={(e) => setEditFormData({ ...editFormData, dob: e.target.value })}
                  disabled={editSubmitting}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                  Phone Number
                </label>
                <Input
                  type="tel"
                  placeholder="e.g., 9876543210"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  disabled={editSubmitting}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                Email Address
              </label>
              <Input
                type="email"
                placeholder="e.g., name@nec.edu.in"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                disabled={editSubmitting}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingFaculty(null)}
                disabled={editSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={editSubmitting}
              >
                {editSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Faculty Confirmation Dialog */}
      {deletingFaculty && (
        <Modal
          isOpen={true}
          onClose={() => !deleteSubmitting && setDeletingFaculty(null)}
          title="Confirm Delete Faculty"
        >
          <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, color: 'var(--color-on-surface)' }}>
              Are you sure you want to delete faculty member <strong>{deletingFaculty.facultyName}</strong> ({deletingFaculty.facultyId})?
            </p>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-error)' }}>
              Warning: Deleting a faculty member removes their identity and teaching assignments. This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingFaculty(null)}
                disabled={deleteSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={deleteSubmitting}
              >
                {deleteSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
