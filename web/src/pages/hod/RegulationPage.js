import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import { getCourses } from '../../services/courseService';

export default function RegulationPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getCourses();
      const list = Array.isArray(res) ? res : res?.data || [];
      setCourses(list);
    } catch (err) {
      console.error('[RegulationPage] Failed to fetch courses:', err);
      setError(err.message || 'Unable to connect to course registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      <PageHeader
        title="Academic Regulation Management"
        description="Statutory management of academic curriculum regulations, workload limits, and Principal-mandated rules."
        breadcrumbs={[
          { label: 'HOD Portal', path: '/hod/dashboard' },
          { label: 'Academic Regulation' },
        ]}
        badge={<Badge variant="primary">GOVERNANCE & CURRICULUM</Badge>}
      />

      {/* Backend Blocker Status Banner */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: 'rgba(234, 179, 8, 0.1)',
          border: '1px solid rgba(234, 179, 8, 0.4)',
          borderRadius: '8px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--color-warning)' }}>
          <span>⚠️</span>
          <span>[BLOCKED BY BACKEND] — Regulation Management API Pending</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-on-surface)' }}>
          The backend currently stores regulation as a static string field (<code>regulation: "R22"</code>) on Course records. 
          Dedicated endpoints for <strong>Assigning Regulation</strong> and <strong>Updating Regulation Rules</strong> (<code>POST /api/regulations</code>, <code>PUT /api/regulations/:id</code>) are not yet implemented in the backend. 
          Displaying verified active R22 regulation context from curriculum course master.
        </p>
      </div>

      {/* Active Regulation Context Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px', marginBottom: '24px' }}>
        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase' }}>
            Active Regulation Authority
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
            R22 Regulations
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-outline)', marginTop: '4px' }}>
            National Engineering College (Autonomous) — Anna University Affiliated
          </div>

          <div style={{ borderTop: '1px solid var(--color-surface-container)', marginTop: '16px', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Degree Levels:</span>
              <span style={{ fontWeight: 600 }}>B.E. (UG) & M.E. (PG)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Curriculum Code:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>R22-CSE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Curriculum Duration:</span>
              <span style={{ fontWeight: 600 }}>8 Semesters (4 Academic Years)</span>
            </div>
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase' }}>
            Principal-Defined Workload Rules
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
            16 Periods / Week
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-outline)', marginTop: '4px' }}>
            Statutory standard weekly faculty teaching norm
          </div>

          <div style={{ borderTop: '1px solid var(--color-surface-container)', marginTop: '16px', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Theory Course:</span>
              <span style={{ fontWeight: 600 }}>1 Credit = 1 Contact Hour</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Laboratory Course:</span>
              <span style={{ fontWeight: 600 }}>1 Credit = 2 Contact Hours</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Max Continuous Slots:</span>
              <span style={{ fontWeight: 600 }}>3 Periods (Lab Session)</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Regulation Course Catalog */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-surface-container)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Curriculum Courses Mapped to R22 ({courses.length})
          </h3>
          <Button variant="outline" size="sm" icon="🔄" onClick={loadData}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spinner size="md" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading R22 curriculum courses...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadData} />
          </div>
        ) : courses.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-outline)', fontSize: '0.875rem' }}>
            No courses mapped under R22 regulation in the backend database.
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Code</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Title</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Semester</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>L-T-P</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Credits</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Regulation</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course, idx) => (
                  <tr key={course._id || course.courseCode || idx} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {course.courseCode}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                      {course.courseName || course.title}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {course.semester ? `Semester ${course.semester}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>
                      {course.lecture || course.l || 0}-{course.tutorial || course.t || 0}-{course.practical || course.p || 0}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {course.credits || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant="primary">{course.regulation || 'R22'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
