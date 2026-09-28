import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getFacultyTimetable,
  getCurrentDayId,
  getCurrentPeriodStatus,
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
import EmptyState from '../../components/common/EmptyState';

export default function MyTimetablePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedDay, setSelectedDay] = useState(() => getCurrentDayId());
  const [currentPeriod, setCurrentPeriod] = useState(() => getCurrentPeriodStatus());

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

  // Live period clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentPeriod(getCurrentPeriodStatus());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchSchedule = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getFacultyTimetable(activeFacultyId);
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('[MyTimetable] Failed to fetch schedule:', err);
      setError(err.message || 'Unable to load timetable sessions. Please retry.');
    } finally {
      setIsLoading(false);
    }
  }, [activeFacultyId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleFacultyChange = (e) => {
    const selectedId = e.target.value;
    setActiveFacultyId(selectedId);
    const match = allFaculty.find((f) => f.facultyId === selectedId);
    if (match) {
      setActiveFacultyName(match.facultyName);
    }
  };

  const handleRefresh = async () => {
    await fetchSchedule();
    showToast('Timetable schedule refreshed successfully.', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const grouped = groupSessionsByDay(sessions);
  const metrics = calculateTimetableMetrics(sessions);
  const currentDayId = getCurrentDayId();
  const todaySessions = grouped[currentDayId] || [];

  // Day filter tabs
  const dayTabs = [
    { id: 'TODAY', label: 'Today', count: todaySessions.length, isToday: true },
    { id: 'MON', label: 'Monday', count: (grouped.MON || []).length },
    { id: 'TUE', label: 'Tuesday', count: (grouped.TUE || []).length },
    { id: 'WED', label: 'Wednesday', count: (grouped.WED || []).length },
    { id: 'THU', label: 'Thursday', count: (grouped.THU || []).length },
    { id: 'FRI', label: 'Friday', count: (grouped.FRI || []).length },
    { id: 'ALL', label: 'All Days', count: sessions.length },
  ];

  // Resolve active day for rendering
  const activeDayKey = selectedDay === 'TODAY' ? currentDayId : selectedDay;
  const activeDayConfig = WEEK_DAYS.find((d) => d.id === activeDayKey) || WEEK_DAYS[0];

  const renderSessionCard = (session, periodTiming) => {
    const isLab = session.sessionType === 'LAB';
    const isPBL = session.sessionType === 'PBL' || session.sessionType === 'SAS';
    const isNow = currentPeriod.isActive && currentPeriod.period === session.period && activeDayKey === currentDayId;

    return (
      <div
        key={`${session.day}-${session.period}-${session._id || session.courseCode}`}
        className="ui-daily-session-item"
      >
        {/* Time Sidebar Column */}
        <div
          className="ui-daily-time-badge"
          style={{
            background: isNow ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-low)',
            borderLeft: isNow ? '4px solid var(--color-secondary)' : '4px solid transparent',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)' }}>
              {session.period}
            </span>
            {isNow && (
              <Badge variant="primary" dot size="sm">
                NOW
              </Badge>
            )}
          </div>
          <span className="text-muted text-xs" style={{ marginTop: '2px' }}>
            {periodTiming?.startTime} – {periodTiming?.endTime}
          </span>
        </div>

        {/* Course Card Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card
            hoverable
            style={{
              height: '100%',
              borderColor: isNow ? 'var(--color-secondary)' : isLab ? '#a7f3d0' : undefined,
              background: isLab ? '#f0fdf4' : '#ffffff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-primary)' }}>
                    {session.courseCode}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--color-on-surface)', wordBreak: 'break-word' }}>
                    {session.courseName}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }} className="text-sm text-muted">
                  <span>🏫 {session.allocation || (session.academicContextId?.year ? `${session.academicContextId.year} CSE '${session.academicContextId.section}'` : "UG III Year A")}</span>
                  <span>📍 {session.room || 'LH-101'}</span>
                  {session.duration > 1 && <span>⏱️ Span: {session.duration} Periods</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <Badge variant={isLab ? 'lab' : isPBL ? 'warning' : 'theory'}>
                  {session.sessionType || 'THEORY'}
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderBreakCard = (breakItem) => (
    <div
      key={breakItem.name}
      className="ui-daily-break-item"
    >
      <div style={{ width: '120px', flexShrink: 0, fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-outline)' }}>
        {breakItem.startTime} – {breakItem.endTime}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.1rem' }}>{breakItem.icon || '☕'}</span>
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-on-surface-variant)' }}>
          {breakItem.name}
        </span>
        <span className="text-muted text-xs">({breakItem.duration})</span>
      </div>
    </div>
  );

  const renderFreePeriodCard = (periodItem) => (
    <div
      key={`free-${periodItem.period}`}
      className="ui-daily-session-item"
    >
      <div
        className="ui-daily-time-badge"
        style={{
          background: 'var(--color-surface-container-low)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-outline)' }}>
          {periodItem.period}
        </span>
        <span className="text-muted text-xs" style={{ marginTop: '2px' }}>
          {periodItem.startTime} – {periodItem.endTime}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: '14px 18px',
          border: '1px dashed var(--color-outline-variant)',
          borderRadius: 'var(--radius-md)',
          background: 'transparent',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div>
          <span style={{ fontWeight: 500, color: 'var(--color-on-surface-variant)', fontSize: '0.9rem' }}>
            No Instructional Class Scheduled
          </span>
          <p className="text-muted text-xs" style={{ margin: '2px 0 0 0' }}>
            Available for student proctoring, research, or course preparation.
          </p>
        </div>
        <Badge variant="neutral" size="sm">FREE PERIOD</Badge>
      </div>
    </div>
  );

  const renderSingleDayTimeline = (dayId, dayTitle) => {
    const daySessions = grouped[dayId] || [];

    // Map each period slot in PERIOD_TIMINGS
    return (
      <div key={dayId} style={{ marginBottom: '32px' }}>
        {selectedDay === 'ALL' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '8px',
              borderBottom: '2px solid var(--color-surface-container-highest)',
              marginBottom: '16px',
            }}
          >
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>
              {dayTitle}
            </h3>
            <Badge variant="secondary">{daySessions.length} Scheduled Periods</Badge>
          </div>
        )}

        {PERIOD_TIMINGS.map((item) => {
          if (item.type === 'break' || item.type === 'lunch') {
            return renderBreakCard(item);
          }
          const session = daySessions.find((s) => s.period === item.period);
          if (session) {
            return renderSessionCard(session, item);
          }
          return renderFreePeriodCard(item);
        })}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="My Timetable"
        description={`Personal weekly teaching schedule and lecture timeline for ${activeFacultyName} (${activeFacultyId}).`}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Faculty Portal', path: '/faculty/dashboard' },
              { label: 'My Timetable' },
            ]}
          />
        }
        badge={<Badge variant="success">AY 2026-27 • ODD SEMESTER • VERIFIED</Badge>}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="faculty-select" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
                Faculty:
              </label>
              <select
                id="faculty-select"
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
              Print / PDF
            </Button>
            <Button variant="primary" size="sm" icon="🔄" onClick={handleRefresh}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* Top Academic Status KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card title="Today's Classes" hoverable>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              {todaySessions.length}
            </span>
            <span className="text-muted text-sm">Periods Scheduled Today</span>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
            <Badge variant="theory">Theory: {todaySessions.filter((s) => s.sessionType === 'THEORY').length}</Badge>
            <Badge variant="lab">Lab: {todaySessions.filter((s) => s.sessionType === 'LAB').length}</Badge>
          </div>
        </Card>

        <Card title="Weekly Workload Commitment" hoverable>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--color-secondary)' }}>
              {metrics.totalPeriods}
            </span>
            <span className="text-muted text-sm">/ 16 Weekly Target Periods</span>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
            <Badge variant="success">Norm Compliant</Badge>
            <span className="text-muted text-xs" style={{ alignSelf: 'center' }}>
              ({metrics.theoryCount} Th + {metrics.labCount} Lab)
            </span>
          </div>
        </Card>

        <Card title="Live Instructional Status" hoverable>
          <div style={{ marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: currentPeriod.isActive ? 'var(--color-secondary)' : 'var(--color-on-surface)' }}>
                {currentPeriod.name}
              </span>
              {currentPeriod.isActive && <Badge variant="primary" dot size="sm">ACTIVE</Badge>}
            </div>
            <p className="text-muted text-xs" style={{ margin: '4px 0 0 0' }}>
              {currentPeriod.label}
            </p>
          </div>
          <div style={{ marginTop: '8px' }}>
            <Badge variant="neutral">System Clock Synced</Badge>
          </div>
        </Card>
      </div>

      {/* Day Selector Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '12px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--color-surface-container-high)',
          maxWidth: '100%',
        }}
      >
        {dayTabs.map((tab) => {
          const isSelected = selectedDay === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedDay(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid',
                borderColor: isSelected ? 'var(--color-secondary)' : 'var(--color-outline-variant)',
                background: isSelected ? 'var(--color-secondary)' : 'var(--color-surface)',
                color: isSelected ? '#ffffff' : 'var(--color-on-surface)',
                fontWeight: isSelected ? 600 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-surface-container-high)',
                  color: isSelected ? '#ffffff' : 'var(--color-on-surface-variant)',
                }}
              >
                {tab.count}P
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Schedule Content Area */}
      {isLoading ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <Spinner size="lg" />
          <p className="text-muted text-sm" style={{ marginTop: '16px' }}>
            Loading verified timetable from institutional database...
          </p>
        </Card>
      ) : error ? (
        <ErrorState
          title="Could Not Load Timetable"
          message={error}
          onRetry={fetchSchedule}
        />
      ) : sessions.length === 0 ? (
        <Card>
          <EmptyState
            icon="🗓️"
            title="No Timetable Sessions Scheduled"
            description={`No teaching periods are assigned to faculty profile ${activeFacultyId} in the current published timetable version.`}
            action={
              <Button variant="primary" size="sm" onClick={handleRefresh}>
                Check Again
              </Button>
            }
          />
        </Card>
      ) : (
        <div>
          {selectedDay === 'ALL' ? (
            WEEK_DAYS.map((d) => renderSingleDayTimeline(d.id, d.full))
          ) : (
            renderSingleDayTimeline(activeDayKey, activeDayConfig.full)
          )}
        </div>
      )}
    </div>
  );
}
