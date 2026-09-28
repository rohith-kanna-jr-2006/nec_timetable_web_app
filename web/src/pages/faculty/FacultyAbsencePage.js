import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getAbsences, reportAbsence } from '../../services/absenceService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

export default function FacultyAbsencePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [absences, setAbsences] = useState([]);

  // Form state
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');

  const facultyId = user?.facultyId || 'FWL-03';

  const loadAbsences = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAbsences({ facultyId });
      const list = Array.isArray(res) ? res : res?.data || [];
      setAbsences(list);
    } catch (err) {
      console.error('[FacultyAbsencePage] Failed to fetch absences:', err);
      setError(err.message || 'Unable to retrieve absence records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAbsences();
  }, [facultyId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date) {
      setFormError('Please select a date for your absence.');
      return;
    }
    if (!reason.trim()) {
      setFormError('Please provide a reason for your absence.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      await reportAbsence({
        facultyId,
        date,
        reason: reason.trim(),
      });
      showToast('Leave request submitted successfully for HOD review.', 'success');
      setDate('');
      setReason('');
      await loadAbsences();
    } catch (err) {
      console.error('[FacultyAbsencePage] Failed to report leave:', err);
      setFormError(err.message || 'Failed to submit absence request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Absence & Leave Management"
        description="Submit planned academic leave or emergency absence for HOD approval and substitute dispatch."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Faculty Portal', path: '/faculty/dashboard' },
              { label: 'Absence & Leave' },
            ]}
          />
        }
        badge={<Badge variant="primary">LEAVE WORKFLOW</Badge>}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: '24px',
        }}
      >
        {/* Absence Reporting Form */}
        <Card style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Report New Absence / Leave
          </h3>

          {formError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--color-error)',
                fontSize: '0.8125rem',
                marginBottom: '16px',
              }}
            >
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Leave Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-outline-variant)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Reason for Leave / On-Duty
              </label>
              <textarea
                rows={3}
                placeholder="Specify nature of leave (e.g. FDP attendance, Medical, External Viva examiner, BoS meeting)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-outline-variant)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting}
              style={{ width: '100%' }}
            >
              {submitting ? 'Submitting Leave...' : 'Submit Leave Request'}
            </Button>
          </form>
        </Card>

        {/* Existing Absences Table */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              Absence History & Status ({absences.length})
            </h3>
          </div>

          {loading ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <Spinner size="md" />
              <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
                Loading absence logs...
              </div>
            </div>
          ) : error ? (
            <div style={{ padding: '24px' }}>
              <ErrorState message={error} onRetry={loadAbsences} />
            </div>
          ) : absences.length === 0 ? (
            <div style={{ padding: '24px' }}>
              <EmptyState
                title="No absence records"
                description="You have no pending or past leave entries recorded."
              />
            </div>
          ) : (
            <div className="ui-table-scroll-container">
              <table style={{ width: '100%', minWidth: '480px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Reason</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {absences.map((a, idx) => (
                    <tr key={a._id || idx} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {a.date ? new Date(a.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{a.reason}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge
                          variant={
                            a.status === 'APPROVED'
                              ? 'success'
                              : a.status === 'REJECTED'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {a.status || 'PENDING'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
