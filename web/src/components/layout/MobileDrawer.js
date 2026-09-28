import React from 'react';
import Sidebar from './Sidebar';

/**
 * MobileDrawer Component
 * Shared responsive mobile navigation drawer wrapping institutional Sidebar
 */
export default function MobileDrawer({
  isOpen = false,
  onClose = () => {},
  role = 'FACULTY',
}) {
  return (
    <>
      <div
        className={`ui-sidebar-backdrop ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <Sidebar
        role={role}
        isCollapsed={false}
        isMobileOpen={isOpen}
        onCloseMobile={onClose}
      />
    </>
  );
}
