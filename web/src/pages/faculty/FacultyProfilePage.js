import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getCurrentUser } from '../../services/authService';
import { getFacultyById } from '../../services/facultyService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Spinner from '../../components/common/Spinner';

export default function FacultyProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(user);
  const [facultyDetail, setFacultyDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      try {
        setLoading(true);
        const me = await getCurrentUser();
        if (isMounted && me) {
          setProfile(me);
          if (me.facultyId) {
            const detail = await getFacultyById(me.facultyId);
            if (isMounted) setFacultyDetail(detail);
          }
        }
      } catch (err) {
        console.warn('[FacultyProfilePage] Failed to refresh profile:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const facultyId = profile?.facultyId || user?.facultyId || null;
  const name = profile?.name || facultyDetail?.facultyName || user?.name || 'Faculty Member';
  const email = profile?.email || facultyDetail?.email || user?.email || '—';
  const role = profile?.role || user?.role || 'FACULTY';
  const designation = facultyDetail?.designation || 'Associate Professor';
  const department = facultyDetail?.department || 'Department of Computer Science and Engineering';

  return (
    <div>
      <PageHeader
        title="Staff Profile & Institutional Credentials"
        description="Official institutional profile, clearance role, department association, and statutory authentication status."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Faculty Portal', path: '/faculty/dashboard' },
              { label: 'Staff Profile' },
            ]}
          />
        }
        badge={<Badge variant="primary">{role}</Badge>}
      />

      {loading ? (
        <Card style={{ padding: '48px 0', textAlign: 'center' }}>
          <Spinner size="lg" />
          <div style={{ marginTop: '14px', color: 'var(--color-outline)' }}>
            Loading staff profile credentials...
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
          {/* Identity & Department Card */}
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
                  {designation}
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
                <span style={{ fontWeight: 600, textAlign: 'right' }}>{department}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-surface-container)' }}>
                <span style={{ color: 'var(--color-on-surface-variant)', fontWeight: 500 }}>System Role:</span>
                <Badge variant="primary">{role}</Badge>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-surface-container)' }}>
                <span style={{ color: 'var(--color-on-surface-variant)', fontWeight: 500 }}>Account Status:</span>
                <Badge variant="success">Active</Badge>
              </div>
            </div>
          </Card>

          {/* Academic Regulations & Policy Card */}
          <Card style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              Institutional Governance
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.875rem' }}>
              <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-container-low)' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Regulation: R2022 Autonomous</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
                  Governed by Nandha Engineering College Academic Council & CSE Board of Studies.
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-container-low)' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Statutory Teaching Norm</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
                  Standard faculty teaching contact period allocation minimum: 16 periods / week.
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-container-low)' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Working Days & Periods</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
                  Monday through Friday (5 Instructional Working Days, 7 Periods/Day).
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
