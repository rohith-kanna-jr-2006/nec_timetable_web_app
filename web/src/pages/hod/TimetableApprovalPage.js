import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { getAcademicContexts } from '../../services/academicContextService';
import { getTimetableVersions } from '../../services/timetableService';
import { transitionTimetableVersion } from '../../services/hodAllocationService';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';

export default function TimetableApprovalPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryContextId = searchParams.get('academicContextId');

  const [contexts, setContexts] = useState([]);
  const [selectedContextId, setSelectedContextId] = useState(queryContextId || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [versions, setVersions] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);

  // Accessible Rejection Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingVersionId, setRejectingVersionId] = useState(null);
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [rejectionError, setRejectionError] = useState('');

  // Load available academic cohorts
  useEffect(() => {
    async function initContexts() {
      try {
        const res = await getAcademicContexts();
        const list = Array.isArray(res) ? res : res?.data || [];
        setContexts(list);

        if (list.length > 0) {
          if (queryContextId && list.some((c) => (c._id || c.id) === queryContextId)) {
            setSelectedContextId(queryContextId);
          } else if (!selectedContextId) {
            setSelectedContextId(list[0]._id || list[0].id);
          }
        }
      } catch (err) {
        console.error('[TimetableApprovalPage] Failed to fetch academic contexts:', err);
        setError('Unable to load academic cohorts.');
      }
    }
    initContexts();
  }, [queryContextId]);

  // Load versions scoped strictly by selected academicContextId with race condition prevention
  const loadVersions = useCallback(async (contextId) => {
    const targetCtxId = contextId || selectedContextId;
    if (!targetCtxId) return;

    // Immediately clear previous versions and show loading to prevent cross-context leak
    setVersions([]);
    setLoading(true);
    setError(null);

    try {
      const res = await getTimetableVersions({ academicContextId: targetCtxId });
      const list = Array.isArray(res) ? res : res?.data || [];
      // Guarantee only versions belonging to the target context are preserved
      const scopedList = list.filter((v) => {
        const vCtxId = v.academicContextId?._id || v.academicContextId || v.academicContext;
        return !vCtxId || String(vCtxId) === String(targetCtxId);
      });
      setVersions(scopedList);
    } catch (err) {
      console.error('[TimetableApprovalPage] Failed to fetch versions:', err);
      if (err.status === 409 || err.code === 'TIMETABLE_VERSION_CONTEXT_MISMATCH') {
        setError('Selected timetable version belongs to a different academic cohort.');
      } else {
        setError(err.message || 'Unable to load timetable versions for this cohort.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedContextId]);

  useEffect(() => {
    if (selectedContextId) {
      loadVersions(selectedContextId);
    }
  }, [selectedContextId, loadVersions]);

  const handleContextChange = (newContextId) => {
    setSelectedContextId(newContextId);
    if (newContextId) {
      setSearchParams({ academicContextId: newContextId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const handleOpenRejectModal = (versionId) => {
    setRejectingVersionId(versionId);
    setRejectionRemarks('');
    setRejectionError('');
    setIsRejectModalOpen(true);
  };

  const handleCloseRejectModal = () => {
    setIsRejectModalOpen(false);
    setRejectingVersionId(null);
    setRejectionRemarks('');
    setRejectionError('');
  };

  const handleConfirmRejection = async () => {
    const remarks = rejectionRemarks.trim();
    if (!remarks) {
      setRejectionError('Statutory rejection remarks are required.');
      return;
    }
    if (remarks.length > 255) {
      setRejectionError('Rejection remarks must be 255 characters or fewer.');
      return;
    }

    try {
      setUpdatingId(rejectingVersionId);
      await transitionTimetableVersion(rejectingVersionId, 'REJECTED', remarks);
      showToast('Timetable version was rejected and returned to the TimeTable Coordinator with remarks.', 'success');
      handleCloseRejectModal();
      await loadVersions(selectedContextId);
    } catch (err) {
      console.error('[TimetableApprovalPage] Rejection failed:', err);
      showToast(err.message || 'Failed to reject timetable version.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleTransition = async (versionId, newStatus) => {
    try {
      setUpdatingId(versionId);
      await transitionTimetableVersion(versionId, newStatus);
      showToast(`Timetable version successfully updated to ${newStatus}.`, 'success');
      await loadVersions(selectedContextId);
    } catch (err) {
      console.error('[TimetableApprovalPage] State transition failed:', err);
      if (err.status === 409 || err.code === 'TIMETABLE_VERSION_CONTEXT_MISMATCH') {
        showToast('Operation aborted: Cross-context version mismatch detected.', 'error');
      } else {
        showToast(err.message || `Failed to update timetable status to ${newStatus}.`, 'error');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const activeContext = contexts.find((c) => (c._id || c.id) === selectedContextId);

  return (
    <div>
      <PageHeader
        title="Timetable Approval"
        description="Authoritative review desk for Head of Department to evaluate TimeTable Coordinator generated versions, execute approvals, or issue formal rejections with feedback."
        breadcrumbs={[
          { label: 'HOD Portal', path: '/hod/dashboard' },
          { label: 'Timetable Approval' },
        ]}
        badge={<Badge variant="warning">HOD APPROVAL DESK</Badge>}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="hod-approval-context-select" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                Cohort:
              </label>
              <select
                id="hod-approval-context-select"
                className="form-select form-select-sm"
                value={selectedContextId}
                onChange={(e) => handleContextChange(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-outline-variant)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--color-primary)',
                  background: '#ffffff',
                }}
              >
                {contexts.map((c) => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.department || 'CSE'} - {c.year} &apos;{c.section}&apos; ({c.academicYear || '2026-2027'})
                  </option>
                ))}
              </select>
            </div>
            <Button variant="outline" size="sm" icon="🔄" onClick={() => loadVersions(selectedContextId)}>
              Refresh Versions
            </Button>
          </div>
        }
      />

      {/* Cohort Scoping Banner */}
      <Card style={{ padding: '16px 20px', marginBottom: '20px', backgroundColor: 'var(--color-surface-container-low)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
              Current Cohort Scope
            </div>
            <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
              {activeContext
                ? `${activeContext.department || 'CSE'} — Year ${activeContext.year} / Sem ${activeContext.semester} — Section ${activeContext.section}`
                : 'Select Cohort'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Badge variant="secondary">{versions.length} Version{versions.length === 1 ? '' : 's'} in Cohort</Badge>
            {activeContext && (
              <Badge variant="neutral">Academic Year: {activeContext.academicYear || `${activeContext.academicYearFrom || '2026'}–${activeContext.academicYearTo || '2027'}`}</Badge>
            )}
          </div>
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Timetable Versions & Governance Pipeline
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spinner size="md" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading timetable versions for selected cohort...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={() => loadVersions(selectedContextId)} />
          </div>
        ) : versions.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              title="No timetable versions for this cohort yet"
              description="The TimeTable Coordinator has not submitted any draft timetable versions for this class cohort."
            />
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '750px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Version Label</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Academic Year / Term</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Cohort</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Designed By</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Current Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>HOD Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((ver) => {
                  const isUpdating = updatingId === ver._id;
                  return (
                    <tr key={ver._id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {ver.versionLabel || 'v1.0'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                        {ver.academicYear || `${activeContext?.academicYearFrom || '2026'}–${activeContext?.academicYearTo || '2027'}`} {ver.semester ? `(${ver.semester})` : ''}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {ver.year || activeContext?.year || 'CSE'} {ver.section ? `'${ver.section}'` : activeContext?.section ? `'${activeContext.section}'` : ''}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>
                        {ver.generatedBy || 'TimeTable Coordinator (TC)'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontWeight: 600 }}>
                            {ver.status === 'PUBLISHED' && (
                              <Badge variant="success">✅ Published</Badge>
                            )}
                            {ver.status === 'APPROVED' && (
                              <Badge variant="primary">✔ Approved by HOD</Badge>
                            )}
                            {ver.status === 'PENDING_HOD_APPROVAL' && (
                              <Badge variant="warning">⏳ Pending HOD Approval</Badge>
                            )}
                            {ver.status === 'REJECTED' && (
                              <div>
                                <Badge variant="danger">❌ Rejected</Badge>
                                {ver.rejectionReason && (
                                  <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-error)' }}>
                                    Reason: {ver.rejectionReason}
                                  </div>
                                )}
                              </div>
                            )}
                            {ver.status === 'GENERATED' && (
                              <Badge variant="neutral">📋 Draft Generated</Badge>
                            )}
                            {!['PUBLISHED', 'APPROVED', 'PENDING_HOD_APPROVAL', 'REJECTED', 'GENERATED'].includes(ver.status) && (
                              <Badge variant="neutral">{ver.status}</Badge>
                            )}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {ver.status === 'PENDING_HOD_APPROVAL' && (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={isUpdating}
                                onClick={() => handleTransition(ver._id, 'APPROVED')}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                disabled={isUpdating}
                                onClick={() => handleOpenRejectModal(ver._id)}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {ver.status === 'APPROVED' && (
                            <Button
                              variant="success"
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => handleTransition(ver._id, 'PUBLISHED')}
                            >
                              Publish
                            </Button>
                          )}
                          {ver.status === 'PUBLISHED' && (
                            <Badge variant="success">Active Live</Badge>
                          )}
                          {ver.status === 'REJECTED' && (
                            <span className="text-muted text-xs">Awaiting TC Revision</span>
                          )}
                          {ver.status === 'GENERATED' && (
                            <span className="text-muted text-xs">Draft (Not Submitted)</span>
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

      {/* Accessible Rejection Remarks Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={handleCloseRejectModal}
        title="Reject Timetable Version"
        maxWidth="500px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="outline" size="sm" onClick={handleCloseRejectModal}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={updatingId === rejectingVersionId}
              onClick={handleConfirmRejection}
            >
              Confirm Rejection
            </Button>
          </div>
        }
      >
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-on-surface-variant)', marginBottom: '12px' }}>
            Please provide explicit statutory remarks detailing the scheduling discrepancies or workload corrections required by the TimeTable Coordinator.
          </p>

          <label
            htmlFor="rejection-remarks-textarea"
            className="ui-label"
            style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}
          >
            Statutory Rejection Remarks <span style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <textarea
            id="rejection-remarks-textarea"
            className="ui-input"
            rows={4}
            maxLength={255}
            value={rejectionRemarks}
            onChange={(e) => {
              setRejectionRemarks(e.target.value);
              if (rejectionError) setRejectionError('');
            }}
            placeholder="e.g. Consecutive lab sessions conflict with Department Workload Norms for Period P3."
            style={{ width: '100%', resize: 'vertical' }}
            aria-required="true"
            aria-invalid={Boolean(rejectionError)}
            aria-describedby={rejectionError ? 'rejection-error-msg' : undefined}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            {rejectionError ? (
              <span id="rejection-error-msg" style={{ fontSize: '0.75rem', color: 'var(--color-error)' }}>
                {rejectionError}
              </span>
            ) : <span />}
            <span style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>
              {rejectionRemarks.length}/255 characters
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
