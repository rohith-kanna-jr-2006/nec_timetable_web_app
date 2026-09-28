import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getCurrentUser } from '../../services/authService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Spinner from '../../components/common/Spinner';

export default function HODProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(user);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      try {
        setLoading(true);
        const me = await getCurrentUser();
        if (isMounted && me) setProfile(me);
      } catch (err) {
        console.warn('[HODProfilePage] Failed to fetch:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const name = profile?.name || 'Dr. T. Rajasekaran';
  const email = profile?.email || 'hod@nec.edu.in';
  const facultyId = profile?.facultyId || 'FWL-01';

  return (
    <div>
      <PageHeader
        title="Head of Department Profile & Credentials"
        description="Official executive credentials, department governance authority, and clearance credentials."
        breadcrumbs={[
          { label: 'HOD Portal', path: '/hod/dashboard' },
          { label: 'Executive Profile' },
        ]}
        badge={<Badge variant="warning">HOD EXECUTIVE (L1)</Badge>}
      />

      {loading ? (
        <Card style={{ padding: '48px 0', textAlign: 'center' }}>
          <Spinner size="lg" />
          <div style={{ marginTop: '14px', color: 'var(--color-outline)' }}>
            Loading executive credentials...
          </div>
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: '24px',
          }}
        >
          <Card style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {name}
                </h3>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                  Professor & Head of Department
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-surface-container)' }}>
                <span style={{ color: 'var(--color-on-surface-variant)', fontWeight: 500 }}>Faculty Identifier:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>{facultyId}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-surface-container)' }}>
                <span style={{ color: 'var(--color-on-surface-variant)', fontWeight: 500 }}>Official Email:</span>
                <span style={{ fontWeight: 600 }}>{email}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-surface-container)' }}>
                <span style={{ color: 'var(--color-on-surface-variant)', fontWeight: 500 }}>Department:</span>
                <span style={{ fontWeight: 600, textAlign: 'right' }}>Department of Computer Science and Engineering</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-surface-container)' }}>
                <span style={{ color: 'var(--color-on-surface-variant)', fontWeight: 500 }}>Governance Authority:</span>
                <Badge variant="warning">Executive Level 1 (HOD)</Badge>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-surface-container)' }}>
                <span style={{ color: 'var(--color-on-surface-variant)', fontWeight: 500 }}>Statutory Ratification Power:</span>
                <Badge variant="success">Active</Badge>
              </div>
            </div>
          </Card>

          <Card style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              Statutory Department Secretariat
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.875rem' }}>
              <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-container-low)' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Secretariat Cabin</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
                  CSE Department Head Secretariat, Main Academic Block, Nandha Engineering College.
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-container-low)' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Appointing Authority</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
                  Sole authority for Course-Faculty Allocations, Class Advisor appointments, and Timetable State Ratification.
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
