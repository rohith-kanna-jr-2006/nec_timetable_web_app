import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';

import AccessDenied from '../pages/common/AccessDenied';

export default function ProtectedRoute({ allowedRoles = null, children }) {
  const { isAuthenticated, user, isLoading, getDefaultDashboard } = useAuth();
  const location = useLocation();

  // Show accessible full-page spinner while session is being verified
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-background)',
          gap: 16,
        }}
      >
        <Spinner size="lg" />
        <div style={{ fontSize: '0.9375rem', color: 'var(--color-on-surface-variant)', fontWeight: 500 }}>
          Verifying security clearance...
        </div>
      </div>
    );
  }

  // If not logged in, redirect to /login with return intent
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If role is restricted and user's role is not authorized, show explicit 403 Forbidden state
  if (allowedRoles && Array.isArray(allowedRoles) && !allowedRoles.includes(user.role)) {
    console.warn(
      `[ProtectedRoute] Access denied. User role '${user.role}' not permitted in: [${allowedRoles.join(', ')}]`
    );
    return <AccessDenied allowedRoles={allowedRoles} />;
  }

  return children ? children : <Outlet />;
}
