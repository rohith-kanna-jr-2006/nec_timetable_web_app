import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import MobileDrawer from './MobileDrawer';
import Topbar from './Topbar';
import PageContainer from './PageContainer';

export default function AppShell({ role = 'FACULTY', children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile drawer on route navigation
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Handle ESC key to dismiss mobile drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen]);

  // Prevent background body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  return (
    <div className="app-shell">
      {/* Responsive Navigation: MobileDrawer integrates backdrop & sidebar */}
      <MobileDrawer
        role={role}
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Main Layout Area */}
      <div className="app-main-layout">
        <Topbar
          onToggleMobileMenu={() => setIsMobileOpen((prev) => !prev)}
          isMobileOpen={isMobileOpen}
        />
        <PageContainer>
          {children}
        </PageContainer>
      </div>
    </div>
  );
}
