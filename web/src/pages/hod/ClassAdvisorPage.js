import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getClassAdvisors,
  assignClassAdvisor,
  deactivateClassAdvisor,
} from '../../services/hodAllocationService';
import { getAcademicContexts } from '../../services/academicContextService';
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

export default function ClassAdvisorPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [advisors, setAdvisors] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [facultyList, setFacultyList] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedContextId, setSelectedContextId] = useState('');
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [formValidation, setFormValidation] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [advRes, ctxRes, facRes] = await Promise.allSettled([
        getClassAdvisors(),
        getAcademicContexts(),
        getFacultyList({ limit: 100 }),
      ]);

      if (advRes.status === 'fulfilled' && advRes.value) {
        const list = Array.isArray(advRes.value) ? advRes.value : advRes.value.data || [];
        setAdvisors(list);
      }
      if (ctxRes.status === 'fulfilled' && ctxRes.value) {
        const list = Array.isArray(ctxRes.value) ? ctxRes.value : ctxRes.value.data || [];
        setContexts(list);
        if (list.length > 0 && !selectedContextId) setSelectedContextId(list[0]._id);
      }
      if (facRes.status === 'fulfilled' && facRes.value) {
        const list = facRes.value.items || facRes.value.data || (Array.isArray(facRes.value) ? facRes.value : []);
        setFacultyList(list);
        if (list.length > 0 && !selectedFacultyId) setSelectedFacultyId(list[0].facultyId);
      }
    } catch (err) {
      console.error('[ClassAdvisorPage] Failed to fetch data:', err);
      setError(err.message || 'Unable to retrieve Class Advisor roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedContextId || !selectedFacultyId) {
      setFormValidation('Both cohort and faculty member are required.');
      return;
    }

    try {
      setAssigning(true);
      setFormValidation('');
      await assignClassAdvisor({
        academicContextId: selectedContextId,
        facultyId: selectedFacultyId,
      });
      showToast('Class Advisor appointed successfully.', 'success');
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('[ClassAdvisorPage] Assignment failed:', err);
      setFormValidation(err.message || 'Failed to appoint Class Advisor.');
    } finally {
      setAssigning(false);
    }
  };

  const handleDeactivate = async (id, name) => {
    if (!window.confirm(`Deactivate Class Advisor appointment for ${name}?`)) return;
    try {
      await deactivateClassAdvisor(id);
      showToast('Class Advisor assignment deactivated.', 'info');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to deactivate assignment.', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Class Advisor Appointments"
        description="Sole statutory appointing authority for departmental Class Advisors across CSE cohorts."
        breadcrumbs={[
          { label: 'HOD Portal', path: '/hod/dashboard' },
          { label: 'Class Advisors' },
        ]}
        badge={<Badge variant="warning">HOD EXCLUSIVE APPOINTMENT</Badge>}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon="🎓"
            onClick={() => {
              setFormValidation('');
              setIsModalOpen(true);
            }}
          >
            Appoint Class Advisor
          </Button>
        }
      />

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Designated Class Advisors ({advisors.length})
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spinner size="md" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading Class Advisors...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadData} />
          </div>
        ) : advisors.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              title="No Class Advisors appointed"
              description="No faculty members have been designated as Class Advisors for current cohorts."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  icon="🎓"
                  onClick={() => setIsModalOpen(true)}
                >
                  Appoint First Advisor
                </Button>
              }
            />
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Cohort Class</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Appointed Faculty</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Faculty ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Appointed By</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {advisors.map((adv) => {
                  const fac = facultyList.find((f) => f.facultyId === adv.facultyId);
                  return (
                    <tr key={adv._id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {adv.academicContextId?.year ? `${adv.academicContextId.year} '${adv.academicContextId.section}'` : 'CSE'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                        {fac?.facultyName || adv.facultyId}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>
                        {adv.facultyId}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>
                        {adv.assignedBy || 'HOD'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant={adv.status === 'ACTIVE' ? 'success' : 'neutral'}>
                          {adv.status || 'ACTIVE'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {adv.status === 'ACTIVE' && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeactivate(adv._id, fac?.facultyName || adv.facultyId)}
                          >
                            Deactivate
                          </Button>
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

      {/* Appointment Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => !assigning && setIsModalOpen(false)}
          title="Appoint Class Advisor"
        >
          <form onSubmit={handleAssign}>
            {formValidation && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', fontSize: '0.8125rem', marginBottom: '14px' }}>
                {formValidation}
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Academic Cohort (Class & Section)
              </label>
              <select
                value={selectedContextId}
                onChange={(e) => setSelectedContextId(e.target.value)}
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

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Faculty Member
              </label>
              <select
                value={selectedFacultyId}
                onChange={(e) => setSelectedFacultyId(e.target.value)}
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsModalOpen(false)}
                disabled={assigning}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={assigning}
              >
                {assigning ? 'Appointing...' : 'Confirm Appointment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
