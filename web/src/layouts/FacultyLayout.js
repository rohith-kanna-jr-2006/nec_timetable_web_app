import React from 'react';
import { Outlet } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../context/AuthContext';

export default function FacultyLayout() {
  const { user } = useAuth();

  return (
    <AppShell role={user?.role || 'FACULTY'}>
      <Outlet />
    </AppShell>
  );
}
