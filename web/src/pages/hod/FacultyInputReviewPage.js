import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { getAbsences, updateAbsenceStatus } from '../../services/absenceService';
import { getAvailability } from '../../services/availabilityService';
import { getFacultyList } from '../../services/facultyService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

export default function FacultyInputReviewPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('LEAVES'); // 'LEAVES' | 'AVAILABILITY'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [absences, setAbsences] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [facultyList, setFacultyList] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [absRes, availRes, facRes] = await Promise.allSettled([
        getAbsences(),
        getAvailability(),
        getFacultyList({ limit: 100 }),
      ]);

      if (absRes.status === 'fulfilled' && absRes.value) {
        const list = Array.isArray(absRes.value) ? absRes.value : absRes.value.data || [];
        setAbsences(list);
      }
      if (availRes.status === 'fulfilled' && availRes.value) {
        const list = Array.isArray(availRes.value) ? availRes.value : availRes.value.data || [];
        setAvailabilities(list);
      }
      if (facRes.status === 'fulfilled' && facRes.value) {
        const list = facRes.value.items || facRes.value.data || (Array.isArray(facRes.value) ? facRes.value : []);
        setFacultyList(list);
      }
    } catch (err) {
      console.error('[FacultyInputReviewPage] Failed to fetch:', err);
      setError(err.message || 'Unable to load faculty inputs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAbsenceStatus = async (id, status) => {
    try {
      await updateAbsenceStatus(id, status);
      showToast(`Leave request ${status.toLowerCase()}.`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to update leave status.', 'error');
    }
  };

  const facultyMap = {};
  facultyList.forEach((f) => {
    facultyMap[f.facultyId] = f;
  });

  return (
    <div>
      <PageHeader
        title="Faculty Preferences & Input Review"
        description="Executive oversight of faculty leave requests, on-duty approvals, and declared slot availability constraints."
        breadcrumbs={[
          { label: 'HOD Portal', path: '/hod/dashboard' },
          { label: 'Faculty Inputs' },
        ]}
        badge={<Badge variant="warning">HOD DECISION DESK</Badge>}
      />

      {/* Tabs */}
      <Card style={{ marginBottom: '20px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('LEAVES')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: activeTab === 'LEAVES' ? 700 : 500,
              backgroundColor: activeTab === 'LEAVES' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'LEAVES' ? '#ffffff' : 'var(--color-on-surface-variant)',
              cursor: 'pointer',
            }}
          >
            Leave Requests ({absences.filter((a) => a.status === 'PENDING').length} Pending)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('AVAILABILITY')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: activeTab === 'AVAILABILITY' ? 700 : 500,
              backgroundColor: activeTab === 'AVAILABILITY' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'AVAILABILITY' ? '#ffffff' : 'var(--color-on-surface-variant)',
              cursor: 'pointer',
            }}
          >
            Slot Availability ({availabilities.length} Constraints)
          </button>
        </div>
      </Card>

      {/* Main Table Content */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spinner size="md" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading faculty input data...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadData} />
          </div>
        ) : activeTab === 'LEAVES' ? (
          <div>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                Leave & Absence Submissions ({absences.length})
              </h3>
            </div>
            {absences.length === 0 ? (
              <div style={{ padding: '32px' }}>
                <EmptyState
                  title="No leave requests"
                  description="No faculty leave or absence applications are currently recorded."
                />
              </div>
            ) : (
              <div className="ui-table-scroll-container">
                <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Faculty Member</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Leave Date</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Reason / Ground</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absences.map((a) => {
                      const fac = facultyMap[a.facultyId];
                      return (
                        <tr key={a._id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{fac?.facultyName || a.facultyId}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>{a.facultyId}</div>
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>
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
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            {a.status === 'PENDING' && (
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleAbsenceStatus(a._id, 'APPROVED')}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleAbsenceStatus(a._id, 'REJECTED')}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                Faculty Slot Constraints & Preferences ({availabilities.length})
              </h3>
            </div>
            {availabilities.length === 0 ? (
              <div style={{ padding: '32px' }}>
                <EmptyState
                  title="No slot preferences declared"
                  description="All faculty members are available for normal scheduling."
                />
              </div>
            ) : (
              <div className="ui-table-scroll-container">
                <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Faculty</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Day</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Period</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Declared Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availabilities.map((av) => {
                      const fac = facultyMap[av.facultyId];
                      return (
                        <tr key={av._id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{fac?.facultyName || av.facultyId}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>{av.facultyId}</div>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{av.day}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>{av.period}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <Badge variant={av.status === 'UNAVAILABLE' ? 'danger' : 'secondary'}>
                              {av.status}
                            </Badge>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>
                            {av.reason || 'None specified'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
