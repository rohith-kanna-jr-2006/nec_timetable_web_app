import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getWorkloadByFaculty, getWorkloadAllocations } from '../../services/workloadService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

export default function FacultyWorkloadPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workload, setWorkload] = useState(null);
  const [allocationsData, setAllocationsData] = useState(null);

  const facultyId = user?.facultyId || 'FWL-03';
  const facultyName = user?.name || 'Faculty Member';

  const loadWorkload = async () => {
    try {
      setLoading(true);
      setError(null);
      const [wlRes, allocRes] = await Promise.allSettled([
        getWorkloadByFaculty(facultyId),
        getWorkloadAllocations(facultyId),
      ]);

      if (wlRes.status === 'fulfilled' && wlRes.value) {
        setWorkload(wlRes.value);
      }
      if (allocRes.status === 'fulfilled' && allocRes.value) {
        setAllocationsData(allocRes.value);
      }
    } catch (err) {
      console.error('[FacultyWorkloadPage] Failed to fetch workload:', err);
      setError(err.message || 'Unable to retrieve workload details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkload();
  }, [facultyId]);

  const summary = workload?.summary || allocationsData?.summary || {};
  const teachingHours = summary.teachingHours ?? workload?.calculatedTeachingHours ?? 0;
  const responsibilityHours = summary.responsibilityHours ?? workload?.calculatedResponsibilityHours ?? 0;
  const totalHours = summary.totalHours ?? workload?.calculatedTotalHours ?? (teachingHours + responsibilityHours);

  // Authoritative status from backend
  const status = summary.status || workload?.workloadCalculation?.status || 'MATCHED';

  // Allocation tables
  const teachingLoad = allocationsData?.teachingLoad || workload?.teachingLoad || {};
  const ugTheory = teachingLoad.ugTheory || [];
  const labs = teachingLoad.labs || [];
  const pg = teachingLoad.pg || [];
  const others = teachingLoad.others || [];

  const responsibilities = allocationsData?.responsibilities || workload?.responsibilities || {};
  const allResponsibilities = [
    ...(responsibilities.academic || []),
    ...(responsibilities.administrative || []),
    ...(responsibilities.coordination || []),
    ...(responsibilities.institutional || []),
  ];

  return (
    <div>
      <PageHeader
        title="Faculty Workload & Compliance"
        description={`Authoritative workload allocation audit for ${facultyName} (${facultyId}). Monitored against statutory 16-period norm.`}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Faculty Portal', path: '/faculty/dashboard' },
              { label: 'Workload Compliance' },
            ]}
          />
        }
        badge={
          <Badge variant={status === 'MATCHED' ? 'success' : 'warning'}>
            {status}
          </Badge>
        }
      />

      {loading ? (
        <Card style={{ padding: '60px 0', textAlign: 'center' }}>
          <Spinner size="lg" />
          <div style={{ marginTop: '16px', color: 'var(--color-outline)' }}>
            Retrieving authoritative workload calculations...
          </div>
        </Card>
      ) : error ? (
        <Card style={{ padding: '24px' }}>
          <ErrorState
            title="Failed to load workload"
            message={error}
            onRetry={loadWorkload}
          />
        </Card>
      ) : (
        <>
          {/* Workload Summary Cards */}
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
                TEACHING CONTACT LOAD
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
                {teachingHours} <span style={{ fontSize: '1rem', fontWeight: 500 }}>hrs/wk</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
                UG Theory, Labs, PG & Others
              </div>
            </Card>

            <Card style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
                RESPONSIBILITY LOAD
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
                {responsibilityHours} <span style={{ fontSize: '1rem', fontWeight: 500 }}>hrs/wk</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
                Statutory institutional roles
              </div>
            </Card>

            <Card style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
                TOTAL AUDITED WORKLOAD
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
                {totalHours} <span style={{ fontSize: '1rem', fontWeight: 500 }}>hrs/wk</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
                Backend Authoritative Total
              </div>
            </Card>

            <Card style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
                STATUTORY COMPLIANCE
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '8px' }}>
                <Badge variant={totalHours >= 16 ? 'success' : 'warning'}>
                  {totalHours >= 16 ? 'NORMS SATISFIED (>= 16)' : 'UNDERLOAD (< 16 HRS)'}
                </Badge>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '8px' }}>
                Standard NEC CSE quota: 16 contact hrs
              </div>
            </Card>
          </div>

          {/* Teaching Load Section */}
          <Card style={{ marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                Teaching Load Allocations
              </h3>
            </div>

            {ugTheory.length === 0 && labs.length === 0 && pg.length === 0 && others.length === 0 ? (
              <div style={{ padding: '24px' }}>
                <EmptyState
                  title="No teaching courses allocated"
                  description="No UG theory, laboratory, PG, or specialized courses are currently recorded."
                />
              </div>
            ) : (
              <div className="ui-table-scroll-container">
                <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Category</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Code</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Name</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Section / Class</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Hours/Week</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ugTheory.map((item, idx) => (
                      <tr key={`ug-${idx}`} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                        <td style={{ padding: '12px 16px' }}><Badge variant="primary">UG Theory</Badge></td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.courseCode || '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{item.courseName}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>{item.allocation || `${item.year || ''} ${item.section || ''}`}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{item.hours}</td>
                      </tr>
                    ))}
                    {labs.map((item, idx) => (
                      <tr key={`lab-${idx}`} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                        <td style={{ padding: '12px 16px' }}><Badge variant="warning">Laboratory</Badge></td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.courseCode || '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{item.courseName}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>{item.allocation || `${item.year || ''} ${item.section || ''}`}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{item.hours}</td>
                      </tr>
                    ))}
                    {pg.map((item, idx) => (
                      <tr key={`pg-${idx}`} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                        <td style={{ padding: '12px 16px' }}><Badge variant="secondary">Postgraduate</Badge></td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.courseCode || '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{item.courseName}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>{item.allocation || item.year || 'PG'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{item.hours || 1}</td>
                      </tr>
                    ))}
                    {others.map((item, idx) => (
                      <tr key={`oth-${idx}`} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                        <td style={{ padding: '12px 16px' }}><Badge variant="neutral">Other Teaching</Badge></td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.courseCode || '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{item.courseName}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>{item.allocation || 'Dept Level'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{item.hours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Institutional Responsibilities Section */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                Institutional Responsibilities (Master Roles)
              </h3>
            </div>

            {allResponsibilities.length === 0 ? (
              <div style={{ padding: '24px' }}>
                <EmptyState
                  title="No institutional responsibilities assigned"
                  description="No statutory institutional roles or departmental portfolios are currently assigned."
                />
              </div>
            ) : (
              <div className="ui-table-scroll-container">
                <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Role Title</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Scope / Cohort</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Equivalent Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allResponsibilities.map((item, idx) => (
                      <tr key={`resp-${idx}`} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-primary)' }}>
                          {item.role}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant="secondary">
                            {item.responsibilityType || 'Institutional'}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>
                          {item.allocation || 'Department Level'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                          {item.hours} hrs/wk
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
    </div>
  );
}
