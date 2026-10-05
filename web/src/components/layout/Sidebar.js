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
      case 'TC':
      case 'AC':
        return [
          {
            title: 'TIMETABLE OPERATIONS',
            items: [
              { label: 'Dashboard', path: '/coordinator/dashboard', icon: '📊' },
              { label: 'Timetable Design', path: '/coordinator/design', icon: '⚡' },
              { label: 'Timetable View', path: '/coordinator/view', icon: '📅' },
              { label: 'Faculty & Course Allocation', path: '/coordinator/faculty-assignment', icon: '👥' },
            ],
          },
          {
            title: 'MAPPING & SUBSTITUTION',
            items: [
              { label: 'Free Timetable / Substitute Mapping', path: '/coordinator/free-mapping', icon: '🔄' },
              { label: 'Conflict Detection', path: '/coordinator/conflict', icon: '⚠️' },
              { label: 'Validation Rules', path: '/coordinator/validation', icon: '✓' },
            ],
          },
        ];

      case 'HOD':
        return [
          {
            title: 'DEPARTMENT GOVERNANCE',
            items: [
              { label: 'Dashboard', path: '/hod/dashboard', icon: '📊' },
              { label: 'Faculty Management', path: '/hod/faculty', icon: '👥' },
              { label: 'Regulation', path: '/hod/regulation', icon: '📜' },
              { label: 'Class Advisor', path: '/hod/class-advisor', icon: '🎓' },
            ],
          },
          {
            title: 'TIMETABLE & APPROVAL',
            items: [
              { label: 'Timetable', path: '/hod/timetable-review', icon: '📅' },
              { label: 'Faculty Allocation', path: '/hod/faculty-allocation', icon: '📝' },
              { label: 'Approval', path: '/hod/approval', icon: '🛡️', badge: 'Review' },
            ],
          },
        ];

      case 'FACULTY':
      default:
        return [
          {
            title: 'TIMETABLES',
            items: [
              { label: 'Class Timetable', path: '/faculty/class-timetable', icon: '🏫' },
              { label: 'Faculty Timetable', path: '/faculty/faculty-timetable', icon: '🗓️' },
              { label: 'My Timetable', path: '/faculty/my-timetable', icon: '👤' },
              { label: 'Weekly Grid Matrix', path: '/faculty/weekly-timetable', icon: '📅' },
            ],
          },
          {
            title: 'FACULTY SERVICES',
            items: [
              { label: 'Dashboard', path: '/faculty/dashboard', icon: '📊' },
              { label: 'Workload Norms', path: '/faculty/workload', icon: '⚖️' },
              { label: 'Availability', path: '/faculty/availability', icon: '🕒' },
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
        return <Badge variant="warning">Head of Department (HOD)</Badge>;
      case 'TC':
      case 'AC':
        return <Badge variant="secondary">TimeTable Coordinator (TC)</Badge>;
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
          to={`/${role === 'HOD' ? 'hod' : (role === 'AC' || role === 'TC') ? 'coordinator' : 'faculty'}/dashboard`}
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
