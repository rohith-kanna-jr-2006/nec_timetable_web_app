import React from 'react';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Breadcrumbs from '../../components/layout/Breadcrumbs';

export default function FacultyDashboardPlaceholder() {
  return (
    <div>
      <PageHeader
        title="Faculty Dashboard"
        description="Personal instructional schedule, upcoming contact periods, and weekly workload compliance overview."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Faculty Portal', path: '/faculty/dashboard' },
              { label: 'Dashboard' },
            ]}
          />
        }
        badge={<Badge variant="primary">LEVEL 03 • INSTRUCTIONAL STAFF</Badge>}
        actions={
          <Button variant="outline" size="sm" icon="🔄">
            Refresh Schedule
          </Button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '20px', marginBottom: '24px' }}>
        <Card title="Today's Academic Status" hoverable>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)' }}>3</span>
            <span className="text-muted text-sm">Classes Scheduled</span>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <Badge variant="theory">Theory: 2</Badge>{' '}
            <Badge variant="lab">Lab: 1 Span</Badge>
          </div>
        </Card>

        <Card title="Weekly Workload Compliance" hoverable>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-secondary)' }}>16</span>
            <span className="text-muted text-sm">/ 16 Periods (Norm Met)</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <Badge variant="success">100% Compliant</Badge>
          </div>
        </Card>

        <Card title="Active Academic Context" hoverable>
          <div style={{ fontWeight: 600, color: 'var(--color-primary)', marginTop: 4 }}>
            Odd Semester 2024-25
          </div>
          <p className="text-muted text-sm" style={{ marginTop: 4, wordBreak: 'break-word' }}>
            Autonomous Regulations R2022 • Dept of CSE
          </p>
          <div style={{ marginTop: 8 }}>
            <Badge variant="neutral">Week 11 Active</Badge>
          </div>
        </Card>
      </div>

      <Card title="Institutional Operational Verification">
        <p className="text-muted" style={{ marginBottom: 16, wordBreak: 'break-word' }}>
          This responsive layout adapts across mobile, tablet, laptop, and desktop viewports, with Stitch design tokens and unified AppShell navigation.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Badge variant="success" dot>Responsive AppShell Active</Badge>
          <Badge variant="secondary">Mobile Drawer Ready</Badge>
          <Badge variant="neutral">Tokens Ported</Badge>
        </div>
      </Card>
    </div>
  );
}
