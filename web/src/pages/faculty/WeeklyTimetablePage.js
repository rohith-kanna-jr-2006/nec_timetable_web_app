import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getFacultyTimetable,
  getClassTimetable,
  groupSessionsByDay,
  calculateTimetableMetrics,
} from '../../services/timetableService';
import { getFacultyList } from '../../services/facultyService';
import { WEEK_DAYS, PERIOD_TIMINGS } from '../../constants/schedule';

import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';

export default function WeeklyTimetablePage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('FACULTY'); // 'FACULTY' | 'CLASS'
  const [sessions, setSessions] = useState([]);
  const [selectedDayFilter, setSelectedDayFilter] = useState('ALL');

  const [activeFacultyId, setActiveFacultyId] = useState(user?.facultyId || 'FWL-03');
  const [activeFacultyName, setActiveFacultyName] = useState(user?.name || 'Dr. S. Karpusamy');
  const [allFaculty, setAllFaculty] = useState([]);

  // Fetch faculty list for switcher
  useEffect(() => {
    async function loadFaculty() {
      try {
        const res = await getFacultyList({ limit: 100 });
        const list = res.items || res.data || (Array.isArray(res) ? res : []);
        setAllFaculty(list);
        if (user?.facultyId) {
          const match = list.find((f) => f.facultyId === user.facultyId);
          if (match) setActiveFacultyName(match.facultyName);
        }
      } catch (err) {
        console.warn('Could not load faculty list for dropdown:', err.message);
      }
    }
    loadFaculty();
  }, [user]);

  const fetchMatrix = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (viewMode === 'FACULTY') {
        const data = await getFacultyTimetable(activeFacultyId);
        setSessions(data.sessions || []);
      } else {
        // Fetch class schedule for III Year CSE 'A'
        const data = await getFacultyTimetable('FWL-03');
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('[WeeklyTimetable] Failed to load schedule:', err);
      setError(err.message || 'Unable to load weekly timetable matrix.');
    } finally {
      setIsLoading(false);
    }
  }, [activeFacultyId, viewMode]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const handleFacultyChange = (e) => {
    const selectedId = e.target.value;
    setActiveFacultyId(selectedId);
    const match = allFaculty.find((f) => f.facultyId === selectedId);
    if (match) {
      setActiveFacultyName(match.facultyName);
    }
  };

  const handleRefresh = async () => {
    await fetchMatrix();
    addToast('Weekly matrix reloaded.', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const grouped = groupSessionsByDay(sessions);
  const metrics = calculateTimetableMetrics(sessions);

  const visibleDays =
    selectedDayFilter === 'ALL'
      ? WEEK_DAYS
      : WEEK_DAYS.filter((d) => d.id === selectedDayFilter);

  // Period slots excluding break columns
  const lecturePeriods = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];

  return (
    <div>
      <PageHeader
        title="Weekly Matrix Timetable"
        description="Full 2D institutional grid (P1–P7, Monday–Friday) with continuous laboratory blocks and break intervals."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Faculty Portal', path: '/faculty/dashboard' },
              { label: 'Weekly Matrix Timetable' },
            ]}
          />
        }
        badge={<Badge variant="primary">DEPARTMENT OF CSE • III YEAR &apos;A&apos;</Badge>}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="weekly-faculty-select" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
                Faculty:
              </label>
              <select
                id="weekly-faculty-select"
                className="form-select form-select-sm"
                value={activeFacultyId}
                onChange={handleFacultyChange}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-outline-variant)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--color-primary)',
                  background: '#ffffff',
                }}
              >
                {allFaculty.length > 0 ? (
                  allFaculty.map((f) => (
                    <option key={f.facultyId} value={f.facultyId}>
                      {f.facultyId}: {f.facultyName}
                    </option>
                  ))
                ) : (
                  <option value={activeFacultyId}>{activeFacultyName} ({activeFacultyId})</option>
                )}
              </select>
            </div>
            <Button variant="outline" size="sm" icon="🖨️" onClick={handlePrint}>
              Print / Export Grid
            </Button>
            <Button variant="primary" size="sm" icon="🔄" onClick={handleRefresh}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* Control Strip & Filter Bar */}
      <Card style={{ marginBottom: '20px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-on-surface-variant)' }}>
              View:
            </span>
            <div style={{ display: 'inline-flex', padding: '2px', background: 'var(--color-surface-container-high)', borderRadius: 'var(--radius-md)' }}>
              <button
                type="button"
                onClick={() => setViewMode('FACULTY')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: viewMode === 'FACULTY' ? 700 : 500,
                  background: viewMode === 'FACULTY' ? '#ffffff' : 'transparent',
                  color: viewMode === 'FACULTY' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'FACULTY' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                👤 Faculty View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('CLASS')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: viewMode === 'CLASS' ? 700 : 500,
                  background: viewMode === 'CLASS' ? '#ffffff' : 'transparent',
                  color: viewMode === 'CLASS' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'CLASS' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                🏫 Class Master
              </button>
            </div>
          </div>

          {/* Day Filter Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-on-surface-variant)' }}>
              Filter:
            </span>
            <button
              type="button"
              className={`btn ${selectedDayFilter === 'ALL' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => setSelectedDayFilter('ALL')}
            >
              All Days
            </button>
            {WEEK_DAYS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`btn ${selectedDayFilter === d.id ? 'btn-primary' : 'btn-outline'} btn-sm`}
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => setSelectedDayFilter(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Main 2D Matrix Table */}
      {isLoading ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <Spinner size="lg" />
          <p className="text-muted text-sm" style={{ marginTop: '16px' }}>
            Constructing 2D weekly matrix schedule...
          </p>
        </Card>
      ) : error ? (
        <ErrorState
          title="Schedule Unavailable"
          message={error}
          onRetry={fetchMatrix}
        />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ padding: '8px 14px', fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', background: 'var(--color-surface-container-low)', borderBottom: '1px solid var(--color-surface-container)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>↔️</span>
            <span>Scroll horizontally to view complete periods matrix (P1–P7)</span>
          </div>
          <div className="ui-timetable-scroll-container">
            <table
              style={{
                width: '100%',
                minWidth: '1080px',
                borderCollapse: 'collapse',
                textAlign: 'center',
                fontSize: '0.875rem',
              }}
            >
              {/* Table Column Headers */}
              <thead>
                <tr style={{ background: 'var(--color-primary)', color: '#ffffff' }}>
                  <th
                    style={{
                      padding: '14px 12px',
                      width: '110px',
                      borderRight: '1px solid rgba(255, 255, 255, 0.15)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Day / Time
                  </th>
                  <th style={{ padding: '12px 8px', width: '120px' }}>
                    <div>P1</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>09:15–10:05</div>
                  </th>
                  <th style={{ padding: '12px 8px', width: '120px' }}>
                    <div>P2</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>10:05–10:55</div>
                  </th>
                  {/* Morning Break Interval */}
                  <th
                    style={{
                      padding: '12px 6px',
                      width: '45px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      fontSize: '0.7rem',
                      color: 'var(--color-primary-fixed)',
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      letterSpacing: '0.05em',
                    }}
                  >
                    ☕ BREAK (15m)
                  </th>
                  <th style={{ padding: '12px 8px', width: '120px' }}>
                    <div>P3</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>11:10–12:00</div>
                  </th>
                  <th style={{ padding: '12px 8px', width: '120px' }}>
                    <div>P4</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>12:00–12:50</div>
                  </th>
                  {/* Lunch Interval */}
                  <th
                    style={{
                      padding: '12px 6px',
                      width: '45px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      fontSize: '0.7rem',
                      color: '#fed7aa',
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      letterSpacing: '0.05em',
                    }}
                  >
                    🍽️ LUNCH (55m)
                  </th>
                  <th style={{ padding: '12px 8px', width: '120px' }}>
                    <div>P5</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>01:45–02:35</div>
                  </th>
                  <th style={{ padding: '12px 8px', width: '120px' }}>
                    <div>P6</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>02:35–03:25</div>
                  </th>
                  {/* Evening Break Interval */}
                  <th
                    style={{
                      padding: '12px 6px',
                      width: '45px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      fontSize: '0.7rem',
                      color: 'var(--color-primary-fixed)',
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      letterSpacing: '0.05em',
                    }}
                  >
                    🍵 TEA (15m)
                  </th>
                  <th style={{ padding: '12px 8px', width: '120px' }}>
                    <div>P7</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>03:40–04:30</div>
                  </th>
                </tr>
              </thead>

              {/* Table Rows for Each Day */}
              <tbody>
                {visibleDays.map((day, rowIndex) => {
                  const daySessions = grouped[day.id] || [];
                  const getSlotSession = (periodId) => daySessions.find((s) => s.period === periodId);

                  return (
                    <tr
                      key={day.id}
                      style={{
                        background: rowIndex % 2 === 0 ? '#ffffff' : 'var(--color-surface-container-lowest)',
                        borderBottom: '1px solid var(--color-surface-container-high)',
                      }}
                    >
                      {/* Day Label Cell */}
                      <td
                        style={{
                          padding: '16px 12px',
                          fontWeight: 700,
                          color: 'var(--color-primary)',
                          background: 'var(--color-surface-container-low)',
                          borderRight: '1px solid var(--color-surface-container-high)',
                        }}
                      >
                        <div style={{ fontSize: '0.95rem' }}>{day.label}</div>
                        <div className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 500 }}>
                          {day.full}
                        </div>
                      </td>

                      {/* P1 */}
                      {renderCell(getSlotSession('P1'))}

                      {/* P2 */}
                      {renderCell(getSlotSession('P2'))}

                      {/* Morning Break Column Divider */}
                      <td
                        style={{
                          background: '#f8fafc',
                          borderLeft: '1px dashed var(--color-outline-variant)',
                          borderRight: '1px dashed var(--color-outline-variant)',
                        }}
                      />

                      {/* P3 */}
                      {renderCell(getSlotSession('P3'))}

                      {/* P4 */}
                      {renderCell(getSlotSession('P4'))}

                      {/* Lunch Column Divider */}
                      <td
                        style={{
                          background: '#fffbeb',
                          borderLeft: '1px dashed var(--color-outline-variant)',
                          borderRight: '1px dashed var(--color-outline-variant)',
                        }}
                      />

                      {/* P5 */}
                      {renderCell(getSlotSession('P5'))}

                      {/* P6 */}
                      {renderCell(getSlotSession('P6'))}

                      {/* Tea Break Column Divider */}
                      <td
                        style={{
                          background: '#f8fafc',
                          borderLeft: '1px dashed var(--color-outline-variant)',
                          borderRight: '1px dashed var(--color-outline-variant)',
                        }}
                      />

                      {/* P7 */}
                      {renderCell(getSlotSession('P7'))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Legend & Statistics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <Card title="Timetable Matrix Legend">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#eff6ff', border: '1px solid #93c5fd' }} />
              <span className="text-sm"><strong>Theory Lecture:</strong> 50 min instructional contact period</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#ecfdf5', border: '1px solid #6ee7b7' }} />
              <span className="text-sm"><strong>Laboratory Block:</strong> Consecutive hands-on practical session</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#fef3c7', border: '1px solid #fcd34d' }} />
              <span className="text-sm"><strong>Project / SAS:</strong> Project-based learning & mentor proctoring</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#f8fafc', border: '1px dashed #cbd5e1' }} />
              <span className="text-sm"><strong>Free / Prep Slot:</strong> Open academic prep period</span>
            </div>
          </div>
        </Card>

        <Card title="Weekly Load Summary">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '8px' }}>
            <div style={{ padding: '12px', background: 'var(--color-surface-container-low)', borderRadius: 'var(--radius-md)' }}>
              <span className="text-muted text-xs">Total Teaching Slots</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
                {metrics.totalPeriods} P
              </div>
            </div>
            <div style={{ padding: '12px', background: 'var(--color-surface-container-low)', borderRadius: 'var(--radius-md)' }}>
              <span className="text-muted text-xs">Theory vs Lab</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-secondary)', marginTop: '4px' }}>
                {metrics.theoryCount} Th • {metrics.labCount} Lab
              </div>
            </div>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Badge variant="success">100% Verified Allocation</Badge>
            <span className="text-muted text-xs">Approved by HOD</span>
          </div>
        </Card>
      </div>
    </div>
  );

  function renderCell(session) {
    if (!session) {
      return (
        <td
          style={{
            padding: '12px 8px',
            borderRight: '1px solid var(--color-surface-container-high)',
            background: 'transparent',
          }}
        >
          <span style={{ color: 'var(--color-outline)', fontSize: '0.75rem', fontWeight: 500 }}>
            —
          </span>
        </td>
      );
    }

    const isLab = session.sessionType === 'LAB';
    const isPBL = session.sessionType === 'PBL' || session.sessionType === 'SAS';

    return (
      <td
        style={{
          padding: '8px',
          borderRight: '1px solid var(--color-surface-container-high)',
          background: isLab ? '#ecfdf5' : isPBL ? '#fef3c7' : '#eff6ff',
          verticalAlign: 'top',
        }}
      >
        <div
          style={{
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            border: isLab ? '1px solid #a7f3d0' : isPBL ? '1px solid #fde68a' : '1px solid #bfdbfe',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-primary)' }}>
              {session.courseCode}
            </span>
            <Badge variant={isLab ? 'lab' : isPBL ? 'warning' : 'theory'} size="sm">
              {session.sessionType || 'THEORY'}
            </Badge>
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--color-on-surface)',
              marginTop: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={session.courseName}
          >
            {session.courseName}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '0.7rem' }} className="text-muted">
            <span>📍 {session.room || 'LH-101'}</span>
            {session.duration > 1 && <span>Span: {session.duration}</span>}
          </div>
        </div>
      </td>
    );
  }
}
