import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import Input from '../../components/common/Input';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import { getAbsences } from '../../services/absenceService';
import { getFacultyList } from '../../services/facultyService';
import {
  getSubstitutes,
  assignSubstitute,
  updateSubstituteStatus,
} from '../../services/substituteService';
import { PERIOD_TIMINGS, WEEK_DAYS } from '../../constants/schedule';

export default function FreeTimetableMappingPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [absences, setAbsences] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [substitutes, setSubstitutes] = useState([]);

  // Modal / Mapping form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mappingSubmitting, setMappingSubmitting] = useState(false);
  const [mappingError, setMappingError] = useState('');

  const [formData, setFormData] = useState({
    absenceId: '',
    originalFacultyId: '',
    substituteFacultyId: '',
    date: new Date().toISOString().split('T')[0],
    period: 'P1',
    timetableSessionId: '',
  });

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [absRes, facRes, subRes] = await Promise.allSettled([
        getAbsences(),
        getFacultyList({ limit: 100 }),
        getSubstitutes(),
      ]);

      if (absRes.status === 'fulfilled' && absRes.value) {
        const list = Array.isArray(absRes.value) ? absRes.value : absRes.value.data || [];
        setAbsences(list);
      }
      if (facRes.status === 'fulfilled' && facRes.value) {
        const list = facRes.value.items || facRes.value.data || (Array.isArray(facRes.value) ? facRes.value : []);
        setFacultyList(list);
      }
      if (subRes.status === 'fulfilled' && subRes.value) {
        const list = Array.isArray(subRes.value) ? subRes.value : subRes.value.data || [];
        setSubstitutes(list);
      }
    } catch (err) {
      console.error('[FreeTimetableMappingPage] Failed to fetch data:', err);
      setError(err.message || 'Unable to connect to timetable mapping services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleOpenMappingModal = (absence = null) => {
    if (absence) {
      setFormData({
        absenceId: absence._id || '',
        originalFacultyId: absence.facultyId || '',
        substituteFacultyId: '',
        date: absence.startDate ? absence.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
        period: 'P1',
        timetableSessionId: '',
      });
    } else {
      setFormData({
        absenceId: absences.length > 0 ? absences[0]._id : '',
        originalFacultyId: absences.length > 0 ? absences[0].facultyId : '',
        substituteFacultyId: '',
        date: new Date().toISOString().split('T')[0],
        period: 'P1',
        timetableSessionId: '',
      });
    }
    setMappingError('');
    setIsModalOpen(true);
  };

  const handleAbsenceSelectChange = (absenceId) => {
    const found = absences.find((a) => a._id === absenceId);
    setFormData((prev) => ({
      ...prev,
      absenceId,
      originalFacultyId: found ? found.facultyId : prev.originalFacultyId,
      date: found && found.startDate ? found.startDate.split('T')[0] : prev.date,
    }));
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!formData.substituteFacultyId) {
      setMappingError('Please select an available substitute faculty member.');
      return;
    }
    if (formData.substituteFacultyId === formData.originalFacultyId) {
      setMappingError('Substitute faculty cannot be the same as the absent faculty member.');
      return;
    }

    try {
      setMappingSubmitting(true);
      setMappingError('');
      await assignSubstitute({
        absenceId: formData.absenceId || undefined,
        originalFacultyId: formData.originalFacultyId,
        substituteFacultyId: formData.substituteFacultyId,
        date: formData.date,
        period: formData.period,
      });
      showToast('Substitute teacher mapped successfully.', 'success');
      setIsModalOpen(false);
      await loadAllData();
    } catch (err) {
      console.error('[FreeTimetableMappingPage] Assignment failed:', err);
      setMappingError(err.message || 'Failed to assign substitute.');
    } finally {
      setMappingSubmitting(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await updateSubstituteStatus(id, status);
      showToast(`Mapping marked as ${status}.`, 'success');
      await loadAllData();
    } catch (err) {
      console.error('[FreeTimetableMappingPage] Status change failed:', err);
      showToast(err.message || 'Failed to update mapping status.', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Free Timetable & Substitute Mapping"
        description="Coordinator operational desk for identifying available faculty slots, mapping coverage for faculty absences, and allocating free resources."
        breadcrumbs={[
          { label: 'Coordinator Portal', path: '/coordinator/dashboard' },
          { label: 'Free Timetable Mapping' },
        ]}
        badge={<Badge variant="secondary">AC OPERATIONAL DESK</Badge>}
        actions={
          <Button
            variant="primary"
            size="md"
            icon="➕"
            onClick={() => handleOpenMappingModal()}
          >
            New Substitute Mapping
          </Button>
        }
      />

      {/* Workflow Concept Guide */}
      <Card style={{ marginBottom: '24px', padding: '16px 20px', background: 'var(--color-surface-container-low)' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', marginBottom: '8px' }}>
          Mapping Workflow Concept
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.875rem' }}>
          <span style={{ padding: '4px 10px', background: 'var(--color-surface-container)', borderRadius: '4px', fontWeight: 600 }}>
            1. Faculty Absence / Leave
          </span>
          <span>➔</span>
          <span style={{ padding: '4px 10px', background: 'var(--color-surface-container)', borderRadius: '4px', fontWeight: 600 }}>
            2. Available Faculty & Time Slot
          </span>
          <span>➔</span>
          <span style={{ padding: '4px 10px', background: 'var(--color-surface-container)', borderRadius: '4px', fontWeight: 600 }}>
            3. Substitute Mapping Assignment
          </span>
        </div>
      </Card>

      {/* Faculty Absences Requiring Coverage */}
      <Card style={{ marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-surface-container)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Active Faculty Absences & Leave ({absences.length})
          </h3>
          <Button variant="outline" size="sm" icon="🔄" onClick={loadAllData}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <Spinner size="md" />
            <div style={{ marginTop: '10px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading faculty absences...
            </div>
          </div>
        ) : absences.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-outline)', fontSize: '0.875rem' }}>
            No active faculty leave or absences currently reported.
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Absent Faculty</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Leave Period</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Leave Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Reason</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Coverage Action</th>
                </tr>
              </thead>
              <tbody>
                {absences.map((abs) => (
                  <tr key={abs._id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {abs.facultyName || abs.facultyId}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {abs.startDate ? abs.startDate.split('T')[0] : '—'} to {abs.endDate ? abs.endDate.split('T')[0] : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant="warning">{abs.absenceType || 'LEAVE'}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>
                      {abs.reason || 'Not specified'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenMappingModal(abs)}
                        icon="🔄"
                      >
                        Map Substitute
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Substitute Mappings Registry */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-surface-container)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Substitute & Free-Slot Mapping Allocations ({substitutes.length})
          </h3>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <Spinner size="md" />
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadAllData} />
          </div>
        ) : substitutes.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              title="No substitute allocations recorded"
              description="Click 'New Substitute Mapping' above to map an available faculty member to cover a slot."
            />
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date & Period</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Original Faculty</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Assigned Substitute</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Mapping Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {substitutes.map((sub) => (
                  <tr key={sub._id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>
                      <strong>{sub.date ? sub.date.split('T')[0] : '—'}</strong> ({sub.period})
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-error)' }}>
                      {sub.originalFacultyId}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-primary)' }}>
                      {sub.substituteFacultyId}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge
                        variant={
                          sub.status === 'ACCEPTED'
                            ? 'success'
                            : sub.status === 'REJECTED' || sub.status === 'CANCELLED'
                            ? 'neutral'
                            : 'warning'
                        }
                      >
                        {sub.status || 'PENDING'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {sub.status === 'PENDING' && (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleStatusChange(sub._id, 'ACCEPTED')}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleStatusChange(sub._id, 'CANCELLED')}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Substitute Mapping Modal */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => !mappingSubmitting && setIsModalOpen(false)}
          title="Assign Substitute / Free Timetable Mapping"
        >
          <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.875rem' }}>
            {mappingError && (
              <div style={{ padding: '8px 12px', background: 'var(--color-error-container)', color: 'var(--color-on-error-container)', borderRadius: '6px', fontSize: '0.8125rem' }}>
                {mappingError}
              </div>
            )}

            {/* Step 1: Select Absent Faculty */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                Original Absent Faculty *
              </label>
              <Select
                value={formData.originalFacultyId}
                onChange={(e) => setFormData({ ...formData, originalFacultyId: e.target.value })}
                options={facultyList.map((f) => ({
                  value: f.facultyId,
                  label: `${f.facultyName} (${f.facultyId})`,
                }))}
                required
                disabled={mappingSubmitting}
              />
            </div>

            {/* Step 2: Target Date and Period */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                  Target Date *
                </label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  disabled={mappingSubmitting}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                  Target Period Slot *
                </label>
                <Select
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  options={PERIOD_TIMINGS.map((p) => ({
                    value: p.period,
                    label: `${p.period} (${p.timing})`,
                  }))}
                  required
                  disabled={mappingSubmitting}
                />
              </div>
            </div>

            {/* Step 3: Select Available Substitute Faculty */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                Available Substitute Faculty *
              </label>
              <Select
                value={formData.substituteFacultyId}
                onChange={(e) => setFormData({ ...formData, substituteFacultyId: e.target.value })}
                options={[
                  { value: '', label: '-- Choose Available Faculty --' },
                  ...facultyList
                    .filter((f) => f.facultyId !== formData.originalFacultyId)
                    .map((f) => ({
                      value: f.facultyId,
                      label: `${f.facultyName} (${f.facultyId}) — ${f.designation}`,
                    })),
                ]}
                required
                disabled={mappingSubmitting}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={mappingSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={mappingSubmitting}
              >
                {mappingSubmitting ? 'Mapping...' : 'Confirm Mapping'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
