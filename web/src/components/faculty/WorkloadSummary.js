import React from 'react';
import Card from '../common/Card';
import Badge from '../common/Badge';

export default function WorkloadSummary({
  teaching = {},
  responsibilities = [],
}) {
  // Live UI Estimated Calculations
  const sumHours = (items = []) => {
    return items.reduce((acc, curr) => {
      const h = Number(curr.hours);
      return acc + (!isNaN(h) && h >= 0 ? h : 0);
    }, 0);
  };

  const ugTheory1Hours = sumHours(teaching.ugTheory1 || []);
  const ugTheory2Hours = sumHours(teaching.ugTheory2 || []);
  const ugTheoryTotal = ugTheory1Hours + ugTheory2Hours;

  const lab1Hours = sumHours(teaching.lab1 || []);
  const lab2Hours = sumHours(teaching.lab2 || []);
  const labTotal = lab1Hours + lab2Hours;

  // PG / Honours / Minor: each course = 1 equivalent hour/week
  const pgCount = (teaching.pg || []).length;
  const pgTotal = pgCount * 1;

  const othersTotal = sumHours(teaching.others || []);

  const totalTeachingHours = ugTheoryTotal + labTotal + pgTotal + othersTotal;
  const totalResponsibilityHours = sumHours(responsibilities || []);
  const estimatedTotalHours = totalTeachingHours + totalResponsibilityHours;

  // Norm status indicator (Standard AICTE / Autonomous norms: 16–22 hours)
  const getNormBadge = (total) => {
    if (total === 0) return <Badge variant="neutral">EMPTY</Badge>;
    if (total < 12) return <Badge variant="warning">UNDERLOAD (&lt;12 hrs)</Badge>;
    if (total <= 22) return <Badge variant="success">OPTIMAL COMPLIANCE (16–22 hrs)</Badge>;
    return <Badge variant="error">HEAVY LOAD (&gt;22 hrs)</Badge>;
  };

  return (
    <Card
      title="7. Workload Summary (Live UI Estimation)"
      action={getNormBadge(estimatedTotalHours)}
      style={{ marginBottom: '24px' }}
    >
      <div style={{ marginBottom: '16px' }}>
        <p className="text-muted text-sm" style={{ margin: 0 }}>
          Live client-side estimation based on departmental allocation norms. The authoritative calculation will be verified and stored by the backend upon submission.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* UG Theory Box */}
        <div
          style={{
            padding: '14px 16px',
            backgroundColor: 'var(--color-surface-container-low)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
              UG Theory (1 & 2)
            </span>
            <Badge variant="theory">{ugTheoryTotal} hrs</Badge>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-outline)' }}>
            UG Theory 1: {ugTheory1Hours}h • UG Theory 2: {ugTheory2Hours}h
          </div>
        </div>

        {/* Labs Box */}
        <div
          style={{
            padding: '14px 16px',
            backgroundColor: 'var(--color-surface-container-low)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
              Laboratories (1 & 2)
            </span>
            <Badge variant="lab">{labTotal} hrs</Badge>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-outline)' }}>
            Lab 1: {lab1Hours}h • Lab 2: {lab2Hours}h
          </div>
        </div>

        {/* PG Box */}
        <div
          style={{
            padding: '14px 16px',
            backgroundColor: 'var(--color-surface-container-low)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
              PG / Honours / Minor
            </span>
            <Badge variant="secondary">{pgTotal} hrs</Badge>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-outline)' }}>
            {pgCount} assigned course{pgCount === 1 ? '' : 's'} × 1h
          </div>
        </div>

        {/* Others Box */}
        <div
          style={{
            padding: '14px 16px',
            backgroundColor: 'var(--color-surface-container-low)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
              Other Academic
            </span>
            <Badge variant="neutral">{othersTotal} hrs</Badge>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-outline)' }}>
            {(teaching.others || []).length} activity row{ (teaching.others || []).length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Summary Totals Table */}
      <div
        style={{
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          backgroundColor: 'var(--color-surface-container-lowest)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '10px 16px',
            borderBottom: '1px solid var(--color-surface-container)',
            fontSize: '0.875rem',
          }}
        >
          <span style={{ color: 'var(--color-on-surface-variant)' }}>Subtotal Teaching Hours:</span>
          <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{totalTeachingHours} hrs/week</span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '10px 16px',
            borderBottom: '1px solid var(--color-surface-container)',
            fontSize: '0.875rem',
          }}
        >
          <span style={{ color: 'var(--color-on-surface-variant)' }}>
            Institutional Responsibilities ({(responsibilities || []).length} assigned):
          </span>
          <span style={{ fontWeight: 600, color: 'var(--color-secondary)' }}>{totalResponsibilityHours} hrs/week</span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor: 'var(--color-surface-container-high)',
            fontSize: '1rem',
            fontWeight: 700,
          }}
        >
          <span style={{ color: 'var(--color-primary)' }}>Estimated Total Weekly Load:</span>
          <span style={{ color: 'var(--color-primary)', fontSize: '1.125rem' }}>
            {estimatedTotalHours} hours/week
          </span>
        </div>
      </div>
    </Card>
  );
}
