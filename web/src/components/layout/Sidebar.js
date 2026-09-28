import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import StitchLogo from '../../assets/StitchLogo';
import Badge from '../common/Badge';

export default function Sidebar({
  role = 'FACULTY', // 'FACULTY' | 'AC' | 'HOD'
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile = () => {},
}) {
  const location = useLocation();

  const getNavigationGroups = () => {
    switch (role) {
      case 'AC':
        return [
          {
            title: 'OPERATIONAL DESK',
            items: [
              { label: 'Dashboard', path: '/coordinator/dashboard', icon: '📊' },
              { label: 'Academic Context', path: '/coordinator/context', icon: '🏛️' },
              { label: 'Course Selection', path: '/coordinator/course-selection', icon: '📚' },
            ],
          },
          {
            title: 'TIMETABLE SCHEDULING',
            items: [
              { label: 'Faculty Assignment', path: '/coordinator/faculty-assignment', icon: '👥' },
              { label: 'Conflict Detection', path: '/coordinator/conflict', icon: '⚠️' },
              { label: 'Validation Rules', path: '/coordinator/validation', icon: '✓' },
              { label: 'Optimization Solver', path: '/coordinator/optimization', icon: '⚡' },
            ],
          },
          {
            title: 'COMMUNICATIONS',
            items: [
              { label: 'Notifications', path: '/coordinator/notifications', icon: '🔔' },
            ],
          },
        ];

      case 'HOD':
        return [
          {
            title: 'STATUTORY EXECUTIVE',
            items: [
              { label: 'Executive Dashboard', path: '/hod/dashboard', icon: '🏛️' },
              { label: 'Faculty Directory', path: '/hod/faculty', icon: '👥' },
              { label: 'Add New Faculty', path: '/hod/faculty/add', icon: '➕' },
              { label: 'Academic Context', path: '/hod/context', icon: '📋' },
            ],
          },
          {
            title: 'GOVERNANCE & APPROVAL',
            items: [
              { label: 'Faculty Allocation', path: '/hod/faculty-allocation', icon: '📝' },
              { label: 'Allocation Review', path: '/hod/allocation-review', icon: '🔎' },
              { label: 'Class Timetable Review', path: '/hod/timetable-review', icon: '📅' },
              { label: 'State Ratification', path: '/hod/approval', icon: '🛡️', badge: 'Action' },
            ],
          },
          {
            title: 'FACULTY & ADVISORY',
            items: [
              { label: 'Class Advisors', path: '/hod/class-advisor', icon: '🎓' },
              { label: 'Faculty Inputs', path: '/hod/faculty-input', icon: '📬' },
              { label: 'Alerts & Messages', path: '/hod/notifications', icon: '🔔' },
              { label: 'Executive Profile', path: '/hod/profile', icon: '👤' },
            ],
          },
        ];

      case 'FACULTY':
      default:
        return [
          {
            title: 'TEACHING & SCHEDULE',
            items: [
              { label: 'Faculty Dashboard', path: '/faculty/dashboard', icon: '📊' },
              { label: 'My Timetable', path: '/faculty/timetable', icon: '🗓️' },
              { label: 'Weekly Grid Matrix', path: '/faculty/weekly-timetable', icon: '📅' },
              { label: 'Workload Norms', path: '/faculty/workload', icon: '⚖️' },
            ],
          },
          {
            title: 'SERVICES & AVAILABILITY',
            items: [
              { label: 'Availability / Prefs', path: '/faculty/availability', icon: '🕒' },
              { label: 'Absence & Leave', path: '/faculty/absence', icon: '📝' },
              { label: 'Notifications', path: '/faculty/notifications', icon: '🔔' },
              { label: 'Staff Profile', path: '/faculty/profile', icon: '👤' },
            ],
          },
        ];
    }
  };

  const getRoleBadge = () => {
    switch (role) {
      case 'HOD':
        return <Badge variant="warning">HOD EXECUTIVE (L1)</Badge>;
      case 'AC':
        return <Badge variant="secondary">ACADEMIC COORD (L2)</Badge>;
      default:
        return <Badge variant="primary">FACULTY MEMBER</Badge>;
    }
  };

  const groups = getNavigationGroups();

  return (
    <aside className={`ui-sidebar ${isCollapsed ? 'ui-sidebar-collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      {/* Brand Header */}
      <div className="ui-sidebar-header">
        <NavLink
          to={`/${role === 'HOD' ? 'hod' : role === 'AC' ? 'coordinator' : 'faculty'}/dashboard`}
          className="ui-sidebar-brand"
          onClick={onCloseMobile}
        >
          <StitchLogo size={36} />
          {!isCollapsed && (
            <div>
              <div className="ui-sidebar-brand-title">NANDHA ENGG</div>
              <div className="ui-sidebar-brand-subtitle">Timetable Suite</div>
            </div>
          )}
        </NavLink>
        {/* Desktop Collapse Button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="ui-sidebar-toggle-btn"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? '»' : '«'}
        </button>
        {/* Mobile Close Button */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="ui-sidebar-close-btn"
          aria-label="Close navigation menu"
          title="Close navigation menu"
        >
          ✕
        </button>
      </div>

      {/* Role Badge Container */}
      {!isCollapsed && (
        <div className="ui-sidebar-role-badge">
          {getRoleBadge()}
        </div>
      )}

      {/* Navigation Groups */}
      <nav className="ui-sidebar-nav">
        {groups.map((group, gIdx) => (
          <div key={gIdx} className="ui-sidebar-nav-group">
            {!isCollapsed && (
              <div className="ui-sidebar-nav-group-title">{group.title}</div>
            )}
            {group.items.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`ui-sidebar-link ${isActive ? 'active' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                  onClick={onCloseMobile}
                >
                  <span className="ui-sidebar-link-icon">{item.icon}</span>
                  {!isCollapsed && (
                    <>
                      <span className="ui-sidebar-link-label">{item.label}</span>
                      {item.badge && (
                        <span className="ui-sidebar-link-badge">{item.badge}</span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="ui-sidebar-footer">
          <div>R2022 Regulation • CSE Dept</div>
          <div style={{ opacity: 0.7, marginTop: 2 }}>Autonomous Institution</div>
        </div>
      )}
    </aside>
  );
}
