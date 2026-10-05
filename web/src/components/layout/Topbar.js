import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function Topbar({
  unreadCount = 3,
  onToggleMobileMenu = () => {},
  isMobileOpen = false,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [academicYearDisplay, setAcademicYearDisplay] = React.useState('ACADEMIC YEAR 2026–2027');

  React.useEffect(() => {
    let isCancelled = false;
    import('../../services/academicContextService').then(({ getAcademicContexts }) => {
      getAcademicContexts().then((res) => {
        if (isCancelled) return;
        const list = Array.isArray(res) ? res : res?.data || [];
        if (list.length > 0) {
          const first = list[0];
          const yearStr = first.academicYearFrom && first.academicYearTo
            ? `${first.academicYearFrom}–${first.academicYearTo}`
            : first.academicYear || '2026–2027';
          setAcademicYearDisplay(`ACADEMIC YEAR ${yearStr}`);
        }
      }).catch(() => {});
    });
    return () => { isCancelled = true; };
  }, []);

  const handleLogout = () => {
    logout();
    showToast('You have been signed out.', 'info');
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const displayName = user?.name || 'Faculty Member';
  const displayRole = user?.role === 'AC' ? 'TC' : (user?.role || 'FACULTY');

  return (
    <header className="ui-topbar">
      {/* Left: Mobile Menu Trigger + Active Academic Context */}
      <div className="ui-topbar-left">
        <button
          type="button"
          className="ui-topbar-menu-btn"
          onClick={onToggleMobileMenu}
          aria-label={isMobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMobileOpen}
          title={isMobileOpen ? 'Close menu' : 'Open menu'}
        >
          {isMobileOpen ? '✕' : '☰'}
        </button>

        <div className="ui-topbar-context">
          <span className="ui-topbar-pulse-dot" />
          <span className="ui-topbar-context-detail">{academicYearDisplay}</span>
          <span className="ui-topbar-context-detail" style={{ color: 'var(--color-outline-variant)' }}>•</span>
          <span className="ui-topbar-context-detail text-muted">CSE • R2022</span>
        </div>
      </div>

      {/* Right: Portal Switcher, Notifications & Authenticated Profile */}
      <div className="ui-topbar-right">
        {/* Portal Switcher for Multi-Role Nav (Authorized Portals Only) */}
        <div className="ui-topbar-portal-switcher" style={{ display: 'flex', gap: 6 }}>
          {(user?.role === 'FACULTY' || user?.role === 'ADMIN') && (
            <NavLink
              to="/faculty/dashboard"
              className="btn btn-subtle btn-sm"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
            >
              Faculty
            </NavLink>
          )}
          {(user?.role === 'TC' || user?.role === 'AC' || user?.role === 'ADMIN') && (
            <NavLink
              to="/coordinator/dashboard"
              className="btn btn-subtle btn-sm"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
            >
              TC
            </NavLink>
          )}
          {(user?.role === 'HOD' || user?.role === 'ADMIN') && (
            <NavLink
              to="/hod/dashboard"
              className="btn btn-subtle btn-sm"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
            >
              HOD
            </NavLink>
          )}
        </div>

        {/* Notifications Icon Button */}
        <button
          type="button"
          className="ui-topbar-icon-btn"
          aria-label="View notifications"
          title={`${unreadCount} unread notifications`}
        >
          <span>🔔</span>
          {unreadCount > 0 && (
            <span className="ui-topbar-notification-badge">{unreadCount}</span>
          )}
        </button>

        {/* User Profile Chip */}
        <div className="ui-topbar-user-profile">
          <div className="ui-topbar-avatar" title={`${displayName} (${displayRole})`}>
            {getInitials(displayName)}
          </div>
          <div className="ui-topbar-user-info">
            <span className="ui-topbar-user-name">{displayName}</span>
            <span className="ui-topbar-user-role">{displayRole}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-outline btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem', marginLeft: 6, minHeight: '32px' }}
            title="Sign Out of Session"
            aria-label="Sign Out"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
