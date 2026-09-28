import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Breadcrumbs from '../../components/layout/Breadcrumbs';

export default function HODDashboardPlaceholder() {
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Head of Department Executive Console"
        description="Departmental faculty allocation governance, institutional responsibilities, class advisor designations, and timetable ratification."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'HOD Portal', path: '/hod/dashboard' },
              { label: 'Executive Console' },
            ]}
          />
        }
        badge={<Badge variant="warning">LEVEL 01 • STATUTORY EXECUTIVE</Badge>}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" icon="👥" onClick={() => navigate('/hod/faculty')}>
              Faculty Directory
            </Button>
            <Button variant="primary" size="sm" icon="➕" onClick={() => navigate('/hod/faculty/add')}>
              Add New Faculty
            </Button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '20px', marginBottom: '24px' }}>
        <Card
          title="Department Faculty Roster"
          hoverable
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/hod/faculty')}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)' }}>28</span>
            <span className="text-muted text-sm">CSE Faculty Members</span>
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <Badge variant="success">All Workloads Verified</Badge>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)' }}>View Roster →</span>
          </div>
        </Card>

        <Card title="Statutory Timetable Status" hoverable>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-warning-amber)' }}>
              PENDING APPROVAL
            </span>
          </div>
          <p className="text-muted text-sm" style={{ marginTop: 6, wordBreak: 'break-word' }}>
            v1.0 Candidate submitted by AC Manikandan
          </p>
          <div style={{ marginTop: 8 }}>
            <Badge variant="warning">Awaiting HOD Signature</Badge>
          </div>
        </Card>

        <Card title="Institutional Responsibilities" hoverable>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-secondary)' }}>3</span>
            <span className="text-muted text-sm">Statutory Periods</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <Badge variant="neutral">HOD • AC • Proctor</Badge>
          </div>
        </Card>
      </div>

      <Card title="Statutory Executive Authority">
        <p className="text-muted" style={{ marginBottom: 16, wordBreak: 'break-word' }}>
          Under Autonomous Regulations R2022, only the Head of Department holds binding authority to designate Class Advisors, approve candidate allocations, and ratify timetable versions from <code>PENDING_HOD_APPROVAL</code> to <code>APPROVED</code> or <code>PUBLISHED</code>.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Badge variant="warning" dot>HOD Authority Model Active</Badge>
          <Badge variant="neutral">State Machine Backend Enforced</Badge>
        </div>
      </Card>
    </div>
  );
}
