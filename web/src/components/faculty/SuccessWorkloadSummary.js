import React from 'react';
import Card from '../common/Card';
import Badge from '../common/Badge';
import Button from '../common/Button';

export default function SuccessWorkloadSummary({
  result,
  onReset,
  onViewList,
}) {
  const faculty = result?.faculty || result || {};
  const calc = result?.workloadCalculation || result?.summary || {};
  const summary = result?.summary || {};
  const teachingHours = calc.calculatedTeachingHours ?? summary.teachingHours ?? 0;
  const responsibilityHours = calc.calculatedResponsibilityHours ?? summary.responsibilityHours ?? 0;
  const totalHours = calc.calculatedTotalHours ?? summary.totalHours ?? 0;
  const status = calc.status ?? summary.status ?? 'MATCHED';
  const facultyId = faculty.facultyId || result?.facultyId || 'AUTO-GENERATED';
  const facultyName = faculty.facultyName || result?.facultyName;
  const designation = faculty.designation || result?.designation;
  const department = faculty.department || result?.department;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Success Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '20px 24px',
          backgroundColor: 'var(--color-success-bg)',
          border: '1px solid var(--color-success-border)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-success-forest)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            flexShrink: 0,
          }}
        >
          ✓
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success-text)', margin: '0 0 4px 0' }}>
            Faculty & Workload Successfully Created
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-success-text)', opacity: 0.9 }}>
            The profile and statutory workload allocation for <strong>{facultyName}</strong> have been authoritatively committed to the database.
          </p>
        </div>
      </div>

      {/* Profile & Authoritative Workload Card */}
      <Card
        title="Authoritative Workload Master Record"
        action={<Badge variant={status === 'MATCHED' ? 'success' : 'warning'}>{status}</Badge>}
        style={{ marginBottom: '24px' }}
      >
        {/* Faculty Identity */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            padding: '16px',
            backgroundColor: 'var(--color-surface-container-low)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
          }}
        >
          <div>
            <div className="text-xs text-muted">FACULTY ID</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
              {facultyId}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">FACULTY NAME</div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-on-surface)' }}>
              {facultyName}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">DESIGNATION</div>
            <div style={{ fontSize: '0.9375rem', color: 'var(--color-on-surface)' }}>
              {designation}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">DEPARTMENT</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-on-surface-variant)' }}>
              {department}
            </div>
          </div>
        </div>

        {/* Backend Authoritative Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-surface-container-lowest)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
            }}
          >
            <div className="text-xs text-muted" style={{ fontWeight: 600 }}>CALCULATED TEACHING</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
              {teachingHours}
            </div>
            <div className="text-xs text-muted">hours / week</div>
          </div>

          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-surface-container-lowest)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
            }}
          >
            <div className="text-xs text-muted" style={{ fontWeight: 600 }}>CALCULATED RESPONSIBILITIES</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-secondary)', marginTop: '4px' }}>
              {responsibilityHours}
            </div>
            <div className="text-xs text-muted">hours / week</div>
          </div>

          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-surface-container-lowest)',
              border: '2px solid var(--color-secondary)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
            }}
          >
            <div className="text-xs text-muted" style={{ fontWeight: 600 }}>AUTHORITATIVE TOTAL</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-secondary-container)', marginTop: '4px' }}>
              {totalHours}
            </div>
            <div className="text-xs text-muted">hours / week</div>
          </div>
        </div>

        {/* Breakdown Accordion / List */}
        {result?.allocations && result.allocations.length > 0 && (
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-on-surface)', marginBottom: '8px' }}>
              Allocations Registered ({result.allocations.length})
            </h4>
            <div
              style={{
                maxHeight: '220px',
                overflowY: 'auto',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Category</th>
                    <th style={{ padding: '8px 12px' }}>Code / Title</th>
                    <th style={{ padding: '8px 12px' }}>Allocation</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {result.allocations.map((a, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <Badge variant={a.allocationType === 'UG_THEORY' ? 'theory' : a.allocationType === 'LAB' ? 'lab' : 'neutral'}>
                          {a.category || a.allocationType}
                        </Badge>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <strong>{a.courseCode ? `${a.courseCode} - ` : ''}</strong>
                        {a.courseName || a.role}
                      </td>
                      <td style={{ padding: '8px 12px' }}>{a.allocation || '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                        {a.hours !== null && a.hours !== undefined ? `${a.hours}h` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation Actions */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <Button variant="outline" size="md" onClick={onReset} icon="➕">
          Add Another Faculty
        </Button>
        <Button variant="primary" size="md" onClick={onViewList} icon="👥">
          Return to Faculty Directory
        </Button>
      </div>
    </div>
  );
}
