import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getAvailability, setAvailability, deleteAvailability } from '../../services/availabilityService';
import { WEEK_DAYS } from '../../constants/schedule';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';

export default function FacultyAvailabilityPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [records, setRecords] = useState([]);

  // Modal / Form state for slot preference
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formDay, setFormDay] = useState('MON');
  const [formPeriod, setFormPeriod] = useState('P1');
  const [formStatus, setFormStatus] = useState('UNAVAILABLE');
  const [formReason, setFormReason] = useState('');
  const [formValidation, setFormValidation] = useState('');

  const facultyId = user?.facultyId || 'FWL-03';
  const periods = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];

  const loadAvailability = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAvailability({ facultyId });
      const list = Array.isArray(res) ? res : res?.data || [];
      setRecords(list);
    } catch (err) {
      console.error('[FacultyAvailability] Failed to fetch:', err);
      setError(err.message || 'Unable to retrieve availability data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvailability();
  }, [facultyId]);

  const handleOpenAdd = (day = 'MON', period = 'P1') => {
    setFormDay(day);
    setFormPeriod(period);
    const existing = records.find((r) => r.day === day && r.period === period);
    if (existing) {
      setFormStatus(existing.status || 'UNAVAILABLE');
      setFormReason(existing.reason || '');
    } else {
      setFormStatus('UNAVAILABLE');
      setFormReason('');
    }
    setFormValidation('');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formDay || !formPeriod || !formStatus) {
      setFormValidation('Day, period, and preference status are required.');
      return;
    }

    try {
      setSaving(true);
      setFormValidation('');
      await setAvailability({
        facultyId,
        day: formDay,
        period: formPeriod,
        status: formStatus,
        reason: formReason.trim() || undefined,
      });
      showToast(`Slot preference for ${formDay} ${formPeriod} recorded.`, 'success');
      setIsModalOpen(false);
      await loadAvailability();
    } catch (err) {
      console.error('[FacultyAvailability] Save failed:', err);
      setFormValidation(err.message || 'Failed to record availability.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, day, period) => {
    if (!window.confirm(`Reset preference for ${day} ${period}?`)) return;
    try {
      await deleteAvailability(id);
      showToast(`Slot ${day} ${period} reset to open.`, 'info');
      await loadAvailability();
    } catch (err) {
      showToast(err.message || 'Failed to remove entry.', 'error');
    }
  };

  // Build quick map: day-period -> record
  const recordMap = {};
  records.forEach((r) => {
    recordMap[`${r.day}-${r.period}`] = r;
  });

  return (
    <div>
      <PageHeader
        title="Availability & Slot Preferences"
        description="Declare off-periods, research slots, or preferred instructional timings for automated timetable generation."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Faculty Portal', path: '/faculty/dashboard' },
              { label: 'Availability' },
            ]}
          />
        }
        badge={<Badge variant="primary">SLOT CONSTRAINTS</Badge>}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon="➕"
            onClick={() => handleOpenAdd('MON', 'P1')}
          >
            Add Slot Preference
          </Button>
        }
      />

      {loading ? (
        <Card style={{ padding: '60px 0', textAlign: 'center' }}>
          <Spinner size="lg" />
          <div style={{ marginTop: '16px', color: 'var(--color-outline)' }}>
            Loading slot preferences...
          </div>
        </Card>
      ) : error ? (
        <Card style={{ padding: '24px' }}>
          <ErrorState
            title="Failed to load availability"
            message={error}
            onRetry={loadAvailability}
          />
        </Card>
      ) : (
        <>
          {/* Visual Matrix Grid */}
          <Card style={{ marginBottom: '24px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                Weekly Availability Grid
              </h3>
              <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-success)' }} /> Available
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-secondary)' }} /> Preferred
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-error)' }} /> Unavailable
                </span>
              </div>
            </div>

            <div className="ui-timetable-scroll-container">
              <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface-container-low)', borderBottom: '1px solid var(--color-surface-container)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Day / Period</th>
                    {periods.map((p) => (
                      <th key={p} style={{ padding: '10px 8px', fontWeight: 600 }}>{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {WEEK_DAYS.map((day) => (
                    <tr key={day.id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                      <td style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {day.label}
                      </td>
                      {periods.map((period) => {
                        const rec = recordMap[`${day.id}-${period}`];
                        const isUnavail = rec?.status === 'UNAVAILABLE';
                        const isPref = rec?.status === 'PREFERRED';

                        return (
                          <td
                            key={period}
                            onClick={() => handleOpenAdd(day.id, period)}
                            style={{
                              padding: '8px 4px',
                              cursor: 'pointer',
                              backgroundColor: isUnavail
                                ? 'rgba(239, 68, 68, 0.1)'
                                : isPref
                                ? 'rgba(59, 130, 246, 0.1)'
                                : 'transparent',
                              transition: 'background-color 150ms',
                            }}
                            title={`Click to edit ${day.label} ${period}`}
                          >
                            <div style={{ padding: '6px 4px', borderRadius: 'var(--radius-sm)' }}>
                              {rec ? (
                                <Badge variant={isUnavail ? 'danger' : isPref ? 'secondary' : 'success'}>
                                  {rec.status}
                                </Badge>
                              ) : (
                                <span style={{ color: 'var(--color-outline)', fontSize: '0.75rem' }}>Open</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Declared Restrictions List */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                Declared Restrictions ({records.length})
              </h3>
            </div>

            {records.length === 0 ? (
              <div style={{ padding: '24px' }}>
                <EmptyState
                  title="No slot preferences registered"
                  description="You are currently available for all institutional teaching periods."
                  action={
                    <Button variant="primary" size="sm" onClick={() => handleOpenAdd('MON', 'P1')} icon="➕">
                      Add First Preference
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="ui-table-scroll-container">
                <table style={{ width: '100%', minWidth: '550px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Day</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Period</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Preference Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Reason / Note</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r._id || `${r.day}-${r.period}`} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.day}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>{r.period}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant={r.status === 'UNAVAILABLE' ? 'danger' : r.status === 'PREFERRED' ? 'secondary' : 'success'}>
                            {r.status}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>
                          {r.reason || 'None specified'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(r._id, r.day, r.period)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Edit / Add Slot Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => !saving && setIsModalOpen(false)}
          title="Configure Slot Availability"
        >
          <form onSubmit={handleSave}>
            {formValidation && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', fontSize: '0.8125rem', marginBottom: '14px' }}>
                {formValidation}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                  Day of Week
                </label>
                <select
                  value={formDay}
                  onChange={(e) => setFormDay(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
                >
                  {WEEK_DAYS.map((d) => (
                    <option key={d.id} value={d.id}>{d.label} ({d.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                  Period
                </label>
                <select
                  value={formPeriod}
                  onChange={(e) => setFormPeriod(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
                >
                  {periods.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Availability Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                className="form-select"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
              >
                <option value="AVAILABLE">AVAILABLE (Normal open period)</option>
                <option value="PREFERRED">PREFERRED (Preferred for class)</option>
                <option value="UNAVAILABLE">UNAVAILABLE (Off-period / Busy)</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Reason / Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Research lab engagement or BoS meeting"
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
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
                {saving ? 'Saving...' : 'Save Preference'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
