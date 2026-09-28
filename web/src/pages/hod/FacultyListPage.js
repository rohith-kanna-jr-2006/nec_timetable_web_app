import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { getFacultyList } from '../../services/facultyService';
import { FACULTY_DESIGNATIONS } from '../../constants/responsibilityMaster';

export default function FacultyListPage() {
  const navigate = useNavigate();
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');

  const loadFaculty = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getFacultyList({
        department: 'Department of Computer Science and Engineering',
        limit: 100,
      });
      const list = Array.isArray(res)
        ? res
        : res?.items || res?.data?.items || res?.data || res?.faculty || [];
      setFacultyList(list);
    } catch (err) {
      console.error('[FacultyListPage] Failed to load live faculty directory:', err);
      setError(err.message || 'Unable to connect to faculty directory service.');
      setFacultyList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFaculty();
  }, []);

  const filtered = facultyList.filter((f) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      (f.facultyName && f.facultyName.toLowerCase().includes(q)) ||
      (f.facultyId && f.facultyId.toLowerCase().includes(q));

    const matchDesig = !designationFilter || f.designation === designationFilter;

    return matchSearch && matchDesig;
  });

  return (
    <div>
      <PageHeader
        title="Department Faculty Directory"
        description="Comprehensive roster of Computer Science & Engineering faculty, statutory designations, and workload allocation status."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'HOD Portal', path: '/hod/dashboard' },
              { label: 'Faculty Directory' },
            ]}
          />
        }
        badge={<Badge variant="primary">CSE DEPARTMENT</Badge>}
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/hod/faculty/add')}
            icon="➕"
          >
            Add New Faculty
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <Card style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '14px' }}>
          <Input
            placeholder="Search by faculty name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon="🔎"
            style={{ height: '38px' }}
          />

          <Select
            value={designationFilter}
            onChange={(e) => setDesignationFilter(e.target.value)}
            options={FACULTY_DESIGNATIONS.map((d) => ({ value: d, label: d }))}
            placeholder="All Designations"
            style={{ height: '38px' }}
          />
        </div>
      </Card>

      {/* Faculty Table Card */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
            <Spinner size="lg" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading faculty directory...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState
              title="Unable to load faculty directory"
              message={error}
              onRetry={loadFaculty}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '24px' }}>
            <EmptyState
              title="No faculty members found"
              description={search || designationFilter ? 'No faculty members match your filter criteria.' : 'No faculty records currently registered.'}
              action={
                <Button variant="primary" size="sm" onClick={() => navigate('/hod/faculty/add')} icon="➕">
                  Add First Faculty
                </Button>
              }
            />
          </div>
        ) : (
          <div>
            <div style={{ padding: '8px 14px', fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', background: 'var(--color-surface-container-low)', borderBottom: '1px solid var(--color-surface-container)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>↔️</span>
              <span>Scroll horizontally to view all faculty records</span>
            </div>
            <div className="ui-table-scroll-container">
              <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Faculty ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Faculty Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Designation</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Weekly Load</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Workload Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((faculty, idx) => (
                  <tr
                    key={faculty.facultyId || idx}
                    style={{
                      borderBottom: '1px solid var(--color-surface-container)',
                      transition: 'background-color 150ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                      {faculty.facultyId}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                      {faculty.facultyName}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant)' }}>
                      {faculty.designation}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {faculty.calculatedTotalHours ? `${faculty.calculatedTotalHours} hrs` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={faculty.status === 'MATCHED' ? 'success' : faculty.status === 'REVIEW REQUIRED' ? 'warning' : 'neutral'}>
                        {faculty.status || 'ACTIVE'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
