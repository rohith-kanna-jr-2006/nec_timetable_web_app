import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCourses } from '../../services/courseService';
import { getCourseFacultyHandlers } from '../../services/coordinatorService';
import { getTimetableVersions } from '../../services/timetableService';
import { getAcademicContexts } from '../../services/academicContextService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';

export default function CoordinatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [coursesCount, setCoursesCount] = useState(0);
  const [handlersCount, setHandlersCount] = useState(0);
  const [activeContextsCount, setActiveContextsCount] = useState(0);
  const [latestVersion, setLatestVersion] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      setLoading(true);
      try {
        const [crsRes, handRes, ctxRes, versRes] = await Promise.allSettled([
          getCourses(),
          getCourseFacultyHandlers(),
          getAcademicContexts(),
          getTimetableVersions(),
        ]);

        if (isMounted) {
          if (crsRes.status === 'fulfilled' && crsRes.value) {
            const list = Array.isArray(crsRes.value) ? crsRes.value : crsRes.value.data || [];
            setCoursesCount(list.length);
          }
          if (handRes.status === 'fulfilled' && handRes.value) {
            const list = Array.isArray(handRes.value) ? handRes.value : handRes.value.data || [];
            setHandlersCount(list.length);
          }
          if (ctxRes.status === 'fulfilled' && ctxRes.value) {
            const list = Array.isArray(ctxRes.value) ? ctxRes.value : ctxRes.value.data || [];
            setActiveContextsCount(list.length);
          }
          if (versRes.status === 'fulfilled' && versRes.value) {
            const list = Array.isArray(versRes.value) ? versRes.value : versRes.value.data || [];
            if (list.length > 0) setLatestVersion(list[0]);
          }
        }
      } catch (err) {
        console.warn('[CoordinatorDashboard] Failed to load dashboard metrics:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Academic Coordinator Operational Desk"
        description="Curriculum subject mapping, candidate faculty pool nominations, and automated timetable scheduling suite."
        breadcrumbs={[
          { label: 'Coordinator Portal', path: '/coordinator/dashboard' },
          { label: 'Operational Desk' },
        ]}
        badge={<Badge variant="secondary">ACADEMIC COORD (L2)</Badge>}
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              icon="📚"
              onClick={() => navigate('/coordinator/course-selection')}
            >
              Course Selection
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="⚡"
              onClick={() => navigate('/coordinator/optimization')}
            >
              Solver Studio
            </Button>
          </div>
        }
      />

      {/* KPI Overview Row */}
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
            CURRICULUM COURSES
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
            {coursesCount} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Subjects</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
            R2022 CSE Master Catalog
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
            FACULTY CANDIDATE POOLS
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
            {handlersCount} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Pools</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
            Course-to-instructor nominations
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
            ACTIVE COHORTS
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
            {activeContextsCount} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Classes</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px' }}>
            Odd Semester 2024-25 Sections
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
            ACTIVE DRAFT STATUS
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '8px' }}>
            <Badge
              variant={
                latestVersion?.status === 'PUBLISHED'
                  ? 'success'
                  : latestVersion?.status === 'PENDING_HOD_APPROVAL'
                  ? 'warning'
                  : 'secondary'
              }
            >
              {latestVersion ? `${latestVersion.versionLabel || 'v1.0'} (${latestVersion.status})` : 'NO ACTIVE DRAFT'}
            </Badge>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '8px' }}>
            Latest timetable draft
          </div>
        </Card>
      </div>

      {/* Operations Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: '20px',
        }}
      >
        <Card style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Operational Workflow Desks
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              type="button"
              onClick={() => navigate('/coordinator/context')}
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
              onClick={() => navigate('/coordinator/course-selection')}
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
              <span style={{ fontSize: '1.5rem' }}>📚</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Course Selection</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/coordinator/faculty-assignment')}
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
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Faculty Pools</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/coordinator/conflict')}
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
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Conflict Detection</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/coordinator/validation')}
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
              <span style={{ fontSize: '1.5rem' }}>✓</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Validation Rules</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/coordinator/optimization')}
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
              <span style={{ fontSize: '1.5rem' }}>⚡</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Solver Studio</span>
            </button>
          </div>
        </Card>

        {/* Timetable Generation Stepper Overview */}
        <Card style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Timetable Construction Lifecycle
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Badge variant="success">Step 1</Badge>
              <span style={{ fontWeight: 600 }}>Establish Academic Context</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>R2022, 2024-25 Odd</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Badge variant="success">Step 2</Badge>
              <span style={{ fontWeight: 600 }}>Verify Curriculum Subject List</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>Theory & Lab Courses</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Badge variant="success">Step 3</Badge>
              <span style={{ fontWeight: 600 }}>Nominate Candidate Faculty Pools</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>AC Recommendations</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Badge variant="secondary">Step 4</Badge>
              <span style={{ fontWeight: 600 }}>Schedule Draft Sessions & Audit Conflicts</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>P1–P7, Continuous Labs</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Badge variant="warning">Step 5</Badge>
              <span style={{ fontWeight: 600 }}>Submit Candidate Version to HOD</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>Statutory Ratification</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
