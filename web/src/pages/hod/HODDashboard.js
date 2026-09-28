import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getFacultyList } from '../../services/facultyService';
import { getWorkloadSummary, getWorkloadDiscrepancies } from '../../services/workloadService';
import { getTimetableVersions } from '../../services/timetableService';
import { getAbsences } from '../../services/absenceService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';

export default function HODDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [facultyCount, setFacultyCount] = useState(27);
  const [workloadSummary, setWorkloadSummary] = useState(null);
  const [discrepancies, setDiscrepancies] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function loadExecutiveData() {
      setLoading(true);
      try {
        const [facRes, wlRes, discRes, versRes, absRes] = await Promise.allSettled([
          getFacultyList({ limit: 100 }),
          getWorkloadSummary(),
          getWorkloadDiscrepancies(),
          getTimetableVersions({ status: 'PENDING_HOD_APPROVAL' }),
          getAbsences({ status: 'PENDING' }),
        ]);

        if (isMounted) {
          if (facRes.status === 'fulfilled' && facRes.value) {
            const list = facRes.value.items || facRes.value.data || (Array.isArray(facRes.value) ? facRes.value : []);
            if (list.length > 0) setFacultyCount(list.length);
          }
          if (wlRes.status === 'fulfilled' && wlRes.value) {
            setWorkloadSummary(wlRes.value);
          }
          if (discRes.status === 'fulfilled' && discRes.value) {
            const dList = Array.isArray(discRes.value) ? discRes.value : discRes.value.data || [];
            setDiscrepancies(dList);
          }
          if (versRes.status === 'fulfilled' && versRes.value) {
            const vList = Array.isArray(versRes.value) ? versRes.value : versRes.value.data || [];
            setPendingApprovals(vList);
          }
          if (absRes.status === 'fulfilled' && absRes.value) {
            const aList = Array.isArray(absRes.value) ? absRes.value : absRes.value.data || [];
            setPendingLeaves(aList);
          }
        }
      } catch (err) {
        console.warn('[HODDashboard] Failed to load executive metrics:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadExecutiveData();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalTeachingHours = workloadSummary?.totalTeachingHours ?? 397;
  const totalResponsibilityHours = workloadSummary?.totalResponsibilityHours ?? 129;
  const totalAllocatedHours = workloadSummary?.totalAllocatedHours ?? (totalTeachingHours + totalResponsibilityHours);

  return (
    <div>
      <PageHeader
        title={`Head of Department Executive Desk`}
        description={`Dr. T. Rajasekaran • Department of Computer Science & Engineering • Executive Governance & Statutory Timetable Ratification`}
        breadcrumbs={[
          { label: 'HOD Portal', path: '/hod/dashboard' },
          { label: 'Executive Dashboard' },
        ]}
        badge={<Badge variant="warning">HOD EXECUTIVE (L1)</Badge>}
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              icon="👥"
              onClick={() => navigate('/hod/faculty')}
            >
              Faculty Directory
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="🛡️"
              onClick={() => navigate('/hod/approval')}
            >
              Ratify Timetable
            </Button>
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
            DEPARTMENT FACULTY
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
            {facultyCount} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Members</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
            CSE Faculty Master Roster
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
            TOTAL ALLOCATED LOAD
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
            {totalAllocatedHours} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>hrs/wk</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
            {totalTeachingHours} Teaching + {totalResponsibilityHours} Responsibilities
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
            PENDING TIMETABLE RATIFICATION
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: pendingApprovals.length > 0 ? 'var(--color-warning)' : 'var(--color-primary)', marginTop: '4px' }}>
            {pendingApprovals.length} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Drafts</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
            {pendingApprovals.length > 0 ? 'Requires statutory review & sign-off' : 'All versions ratified'}
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
            PENDING LEAVE REQUESTS
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: pendingLeaves.length > 0 ? 'var(--color-error)' : 'var(--color-primary)', marginTop: '4px' }}>
            {pendingLeaves.length} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Requests</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
            Awaiting HOD endorsement
          </div>
        </Card>
      </div>

      {/* Operational Sections */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: '20px',
        }}
      >
        {/* Governance Quick Desks */}
        <Card style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Executive Governance Desks
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              type="button"
              onClick={() => navigate('/hod/faculty')}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 10px',
                textAlign: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>👥</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Faculty Directory</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/hod/faculty/add')}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 10px',
                textAlign: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>➕</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Add Faculty</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/hod/context')}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 10px',
                textAlign: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🏛️</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Academic Context</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/hod/faculty-allocation')}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 10px',
                textAlign: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>📝</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Faculty Allocation</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/hod/allocation-review')}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 10px',
                textAlign: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🔎</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Allocation Review</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/hod/timetable-review')}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 10px',
                textAlign: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>📅</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Class Timetables</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/hod/approval')}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 10px',
                textAlign: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🛡️</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Ratification</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/hod/class-advisor')}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 10px',
                textAlign: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🎓</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Class Advisors</span>
            </button>
          </div>
        </Card>

        {/* Timetable Ratification Status Alert */}
        <Card style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Statutory Approval Pipeline
          </h3>

          {pendingApprovals.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✓</div>
              <div style={{ fontWeight: 600 }}>No Timetable Versions Pending Approval</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-outline)', marginTop: '4px' }}>
                All candidate versions submitted by coordinators are currently reviewed.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingApprovals.map((v) => (
                <div
                  key={v._id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-surface-container-low)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-primary)' }}>
                      Version {v.versionLabel || 'v1.0'} • {v.academicYear} ({v.semester})
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                      Cohort: {v.year || 'All Years'} {v.section ? `'${v.section}'` : ''} • Submitted by: {v.generatedBy || 'AC'}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/hod/approval')}
                  >
                    Review
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Pending Leaves Alert */}
          {pendingLeaves.length > 0 && (
            <div style={{ marginTop: '20px', padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-error)' }}>
                    {pendingLeaves.length} Faculty Leave Requests Pending
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                    Review leave requests and dispatch substitutes.
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/hod/faculty-input')}
                >
                  View Leaves
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
