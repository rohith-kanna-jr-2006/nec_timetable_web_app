import React from 'react';
import { Outlet } from 'react-router-dom';
import StitchLogo from '../assets/StitchLogo';

export default function AuthLayout() {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        maxWidth: '100vw',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        backgroundColor: 'var(--color-background)',
        background: 'linear-gradient(180deg, #f8f9ff 0%, #e5eeff 100%)',
      }}
    >
      {/* Institutional Top Crest Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          marginBottom: '24px',
        }}
      >
        <StitchLogo size={64} style={{ marginBottom: 16 }} />
        <div
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-secondary)',
            backgroundColor: 'var(--color-secondary-fixed)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            marginBottom: 8,
          }}
        >
          Autonomous Institution • Affiliated to Anna University
        </div>
        <h1
          style={{
            fontSize: '1.75rem',
            color: 'var(--color-primary)',
            margin: '4px 0 2px',
            letterSpacing: '-0.02em',
          }}
        >
          NANDHA ENGINEERING COLLEGE
        </h1>
        <p
          style={{
            fontSize: '0.9375rem',
            color: 'var(--color-on-surface-variant)',
            fontWeight: 500,
          }}
        >
          Faculty Timetable & Workload Management Suite
        </p>
      </div>

      {/* Main Auth Content / Form Outlet */}
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <Outlet />
      </div>

      {/* Institutional Footer */}
      <footer
        style={{
          marginTop: '32px',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--color-outline)',
        }}
      >
        <div>Autonomous Regulations R2022 • ERP Support: ext 241</div>
        <div style={{ marginTop: 4 }}>IT Cell Timetable Management Framework</div>
      </footer>
    </div>
  );
}
