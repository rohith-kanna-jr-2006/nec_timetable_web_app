import React, { useState, useEffect } from 'react';
import { getCourses } from '../../services/courseService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

export default function CourseSelectionPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [courses, setCourses] = useState([]);
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getCourses();
      const list = Array.isArray(res) ? res : res?.data || [];
      setCourses(list);
    } catch (err) {
      console.error('[CourseSelectionPage] Failed to fetch courses:', err);
      setError(err.message || 'Unable to retrieve curriculum catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const filtered = courses.filter((c) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      c.courseCode?.toLowerCase().includes(q) ||
      c.courseName?.toLowerCase().includes(q);

    const matchSem =
      semesterFilter === 'ALL' ||
      String(c.semester) === String(semesterFilter);

    return matchSearch && matchSem;
  });

  return (
    <div>
      <PageHeader
        title="Curriculum Course Selection (R2022)"
        description="Authoritative curriculum subject catalog for Computer Science & Engineering under R2022 Autonomous Regulations."
        breadcrumbs={[
          { label: 'Coordinator Portal', path: '/coordinator/dashboard' },
          { label: 'Course Selection' },
        ]}
        badge={<Badge variant="primary">R2022 CSE CURRICULUM</Badge>}
        actions={
          <Button variant="outline" size="sm" icon="🔄" onClick={loadCourses}>
            Reload Catalog
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <Card style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '14px' }}>
          <input
            type="text"
            placeholder="Search by course code or subject title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-outline-variant)',
              fontSize: '0.875rem',
            }}
          />

          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-outline-variant)',
              fontSize: '0.875rem',
              background: '#ffffff',
            }}
          >
            <option value="ALL">All Semesters</option>
            <option value="1">Semester 1 (I Year)</option>
            <option value="2">Semester 2 (I Year)</option>
            <option value="3">Semester 3 (II Year)</option>
            <option value="4">Semester 4 (II Year)</option>
            <option value="5">Semester 5 (III Year - Active)</option>
            <option value="6">Semester 6 (III Year)</option>
            <option value="7">Semester 7 (IV Year)</option>
            <option value="8">Semester 8 (IV Year)</option>
          </select>
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Authoritative Courses ({filtered.length})
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spinner size="md" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading curriculum catalog...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadCourses} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              title="No courses found"
              description="No curriculum courses match the active search and semester filter."
            />
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Code</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Title</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Sem</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>L - T - P</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Credits</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((crs) => (
                  <tr key={crs._id || crs.courseCode} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {crs.courseCode}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                      {crs.courseName}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant="secondary">Sem {crs.semester || '5'}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={crs.type === 'LAB' ? 'warning' : 'primary'}>
                        {crs.type || 'THEORY'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                      {crs.lectureHours ?? 3} - {crs.tutorialHours ?? 0} - {crs.practicalHours ?? 0}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                      {crs.credits ?? 3}
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
