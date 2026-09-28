import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getAcademicContexts,
  createAcademicContext,
  deleteAcademicContext,
} from '../../services/academicContextService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';

export default function AcademicContextPage({ portalType = 'HOD' }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contexts, setContexts] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formValidation, setFormValidation] = useState('');

  const [formData, setFormData] = useState({
    academicYear: '2024-2025',
    semester: 'ODD',
    department: 'CSE',
    year: 'III Year',
    section: 'A',
    program: 'UG',
    status: 'ACTIVE',
  });

  const loadContexts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAcademicContexts();
      const list = Array.isArray(res) ? res : res?.data || [];
      setContexts(list);
    } catch (err) {
      console.error('[AcademicContextPage] Failed to fetch:', err);
      setError(err.message || 'Unable to load academic contexts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContexts();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.academicYear || !formData.semester || !formData.year || !formData.section) {
      setFormValidation('All academic context fields are required.');
      return;
    }

    try {
      setCreating(true);
      setFormValidation('');
      await createAcademicContext({
        academicYear: formData.academicYear.trim(),
        semester: formData.semester.trim(),
        department: formData.department.trim(),
        year: formData.year.trim(),
        section: formData.section.toUpperCase().trim(),
        program: formData.program,
        status: formData.status,
      });
      showToast('Academic context registered successfully.', 'success');
      setIsModalOpen(false);
      await loadContexts();
    } catch (err) {
      console.error('[AcademicContextPage] Create failed:', err);
      setFormValidation(err.message || 'Failed to create academic context.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, label) => {
    if (!window.confirm(`Are you sure you want to delete context ${label}?`)) return;
    try {
      await deleteAcademicContext(id);
      showToast('Academic context removed.', 'info');
      await loadContexts();
    } catch (err) {
      showToast(err.message || 'Could not delete context.', 'error');
    }
  };

  const basePath = portalType === 'HOD' ? '/hod' : '/coordinator';

  return (
    <div>
      <PageHeader
        title="Departmental Academic Contexts"
        description="Statutory regulation, academic year, semester, and cohort sections for Computer Science & Engineering."
        breadcrumbs={[
          { label: `${portalType} Portal`, path: `${basePath}/dashboard` },
          { label: 'Academic Context' },
        ]}
        badge={<Badge variant="primary">R2022 CURRICULUM</Badge>}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon="➕"
            onClick={() => {
              setFormValidation('');
              setIsModalOpen(true);
            }}
          >
            Add Academic Context
          </Button>
        }
      />

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Configured Academic Cohorts ({contexts.length})
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spinner size="md" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading academic contexts...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadContexts} />
          </div>
        ) : contexts.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              title="No academic contexts registered"
              description="No classes or sections are configured for the active academic term."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  icon="➕"
                  onClick={() => setIsModalOpen(true)}
                >
                  Create First Context
                </Button>
              }
            />
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Academic Year</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Semester</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Department</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Cohort Year</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Section</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contexts.map((ctx) => (
                  <tr key={ctx._id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{ctx.academicYear}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant="secondary">{ctx.semester}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{ctx.department}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-primary)' }}>
                      {ctx.year}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      &apos;{ctx.section}&apos;
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={ctx.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {ctx.status || 'ACTIVE'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(ctx._id, `${ctx.year} '${ctx.section}'`)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Context Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => !creating && setIsModalOpen(false)}
          title="Create Academic Context"
        >
          <form onSubmit={handleCreate}>
            {formValidation && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', fontSize: '0.8125rem', marginBottom: '14px' }}>
                {formValidation}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                  Academic Year
                </label>
                <select
                  value={formData.academicYear}
                  onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
                >
                  <option value="2024-2025">2024-2025</option>
                  <option value="2025-2026">2025-2026</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                  Semester
                </label>
                <select
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
                >
                  <option value="ODD">ODD SEMESTER</option>
                  <option value="EVEN">EVEN SEMESTER</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                  Cohort Year
                </label>
                <select
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
                >
                  <option value="I Year">I Year</option>
                  <option value="II Year">II Year</option>
                  <option value="III Year">III Year</option>
                  <option value="IV Year">IV Year</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                  Section
                </label>
                <select
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
                >
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
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
                {creating ? 'Creating...' : 'Create Context'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
