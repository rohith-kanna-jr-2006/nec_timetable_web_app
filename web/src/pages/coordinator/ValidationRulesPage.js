import React from 'react';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';

export default function ValidationRulesPage() {
  const rules = [
    {
      id: 'RULE-01',
      title: 'Statutory Faculty Teaching Norm',
      category: 'Workload Quota',
      severity: 'MANDATORY',
      description: 'Full-time faculty members must be assigned a minimum of 16 teaching contact periods per instructional week (calculated across UG Theory, Labs, PG, and Others).',
      formula: 'UG Theory (3/cr) + Lab (4/cr) + PG (1/cr) + Others >= 16 hrs',
    },
    {
      id: 'RULE-02',
      title: 'Continuous Laboratory Block Constraint',
      category: 'Laboratory Scheduling',
      severity: 'HARD CONSTRAINT',
      description: 'Practical/Laboratory sessions must be allocated as an unbroken 4-period block (e.g. Periods 1–4 or Periods 4–7) to maintain experimental continuity.',
      formula: 'Consecutive periods = 4 within same calendar day',
    },
    {
      id: 'RULE-03',
      title: 'Institutional Break Interval Preservation',
      category: 'Schedule Structure',
      severity: 'MANDATORY',
      description: 'No academic or laboratory session may be scheduled across institutional break intervals: Morning Break (10:40–11:00 AM) and Lunch Break (12:40–01:30 PM).',
      formula: 'Break times reserved exclusively for student and faculty transit',
    },
    {
      id: 'RULE-04',
      title: 'Zero Faculty Double-Booking',
      category: 'Conflict Prevention',
      severity: 'HARD CONSTRAINT',
      description: 'A faculty member cannot be scheduled for more than one instructional session in the same day and period slot across any section or degree program.',
      formula: 'Count(Sessions where Day=d, Period=p, FacultyId=f) <= 1',
    },
    {
      id: 'RULE-05',
      title: 'Classroom & Venue Exclusivity',
      category: 'Venue Management',
      severity: 'HARD CONSTRAINT',
      description: 'A lecture hall or laboratory room cannot accommodate more than one concurrent class section during any period slot.',
      formula: 'Count(Sessions where Day=d, Period=p, Room=r) <= 1',
    },
    {
      id: 'RULE-06',
      title: 'Maximum Daily Teaching Load Limit',
      category: 'Fatigue & Quality',
      severity: 'SOFT CONSTRAINT',
      description: 'Faculty members should not be scheduled for more than 4 lecture contact periods in a single instructional day to preserve instructional delivery quality.',
      formula: 'Count(Lectures where Day=d, FacultyId=f) <= 4 (recommended)',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Validation Rules & Statutory Compliance"
        description="Formal scheduling constraints, weekly period quotas, and institutional laboratory block policies for R2022 Autonomous Regulations."
        breadcrumbs={[
          { label: 'Coordinator Portal', path: '/coordinator/dashboard' },
          { label: 'Validation Rules' },
        ]}
        badge={<Badge variant="primary">R2022 RULES ENGINE</Badge>}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {rules.map((rule) => (
          <Card key={rule.id} style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {rule.id}
                  </span>
                  <Badge variant={rule.severity === 'HARD CONSTRAINT' ? 'danger' : rule.severity === 'MANDATORY' ? 'warning' : 'secondary'}>
                    {rule.severity}
                  </Badge>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-outline)' }}>
                    {rule.category}
                  </span>
                </div>
                <h3 style={{ margin: '8px 0 6px 0', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {rule.title}
                </h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
                  {rule.description}
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: '12px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-surface-container-low)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              Constraint Formula: {rule.formula}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
