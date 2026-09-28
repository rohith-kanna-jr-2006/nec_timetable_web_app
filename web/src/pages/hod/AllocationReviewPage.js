import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getHODAllocations,
  updateHODAllocationStatus,
} from '../../services/hodAllocationService';
import { getCourseFacultyHandlers } from '../../services/coordinatorService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

export default function AllocationReviewPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [handlers, setHandlers] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [allocRes, handRes] = await Promise.allSettled([
        getHODAllocations(),
        getCourseFacultyHandlers(),
      ]);

      if (allocRes.status === 'fulfilled' && allocRes.value) {
        const list = Array.isArray(allocRes.value) ? allocRes.value : allocRes.value.data || [];
        setAllocations(list);
      }
      if (handRes.status === 'fulfilled' && handRes.value) {
        const list = Array.isArray(handRes.value) ? handRes.value : handRes.value.data || [];
        setHandlers(list);
      }
    } catch (err) {
      console.error('[AllocationReviewPage] Failed to fetch data:', err);
      setError(err.message || 'Unable to load allocation review data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
    const reason =
      newStatus === 'REJECTED'
        ? window.prompt('Specify statutory reason for rejection:')
        : null;

    if (newStatus === 'REJECTED' && reason === null) return;

    try {
      await updateHODAllocationStatus(id, newStatus, reason);
      showToast(`Allocation marked as ${newStatus}.`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to update status.', 'error');
    }
  };

  const handlerMap = {};
  handlers.forEach((h) => {
    handlerMap[h.courseCode] = h;
  });

  return (
    <div>
      <PageHeader
        title="Allocation Review & Nomination Audit"
        description="Side-by-side audit of Academic Coordinator recommended candidate pools against final HOD faculty allocations."
        breadcrumbs={[
          { label: 'HOD Portal', path: '/hod/dashboard' },
          { label: 'Allocation Review' },
        ]}
        badge={<Badge variant="warning">EXECUTIVE AUDIT</Badge>}
      />

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Course Nominations & Ratification Audit ({allocations.length})
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spinner size="md" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading audit matrix...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadData} />
          </div>
        ) : allocations.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              title="No allocations awaiting review"
              description="All course-faculty assignments are currently ratified or no coordinator drafts are submitted."
            />
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '750px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Cohort</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>AC Nominated Pool</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Assigned Faculty</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((alloc) => {
                  const pool = handlerMap[alloc.courseCode];
                  return (
                    <tr key={alloc._id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                          {alloc.courseCode}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-on-surface-variant)' }}>
                          {alloc.courseName}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                        {alloc.academicContextId?.year ? `${alloc.academicContextId.year} '${alloc.academicContextId.section}'` : 'CSE'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {pool && pool.candidateFacultyIds?.length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {pool.candidateFacultyIds.map((cId) => (
                              <Badge key={cId} variant={cId === alloc.facultyId ? 'success' : 'neutral'}>
                                {cId}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-outline)', fontSize: '0.8125rem' }}>No AC pool</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{alloc.facultyName || alloc.facultyId}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>ID: {alloc.facultyId}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge
                          variant={
                            alloc.status === 'APPROVED'
                              ? 'success'
                              : alloc.status === 'REJECTED'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {alloc.status || 'DRAFT'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {alloc.status !== 'APPROVED' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleUpdateStatus(alloc._id, 'APPROVED')}
                            >
                              Approve
                            </Button>
                          )}
                          {alloc.status !== 'REJECTED' && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleUpdateStatus(alloc._id, 'REJECTED')}
                            >
                              Reject
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
