import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';

export default function AccessDenied({ allowedRoles = [] }) {
  const { user, logout, getDefaultDashboard } = useAuth();
  const navigate = useNavigate();

  const userRole = user?.role || 'UNKNOWN';
  const userName = user?.name || 'Authenticated User';
  const defaultDashboard = getDefaultDashboard(userRole);

  const handleSwitchAccount = () => {
    logout();
    navigate('/login');
  };

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <Card
        style={{
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          padding: '36px 28px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '3rem', lineHeight: 1 }}>🛡️</span>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <Badge variant="error" dot>
            HTTP 403 • ACCESS RESTRICTED
          </Badge>
        </div>

        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--color-on-surface)' }}>
          Clearance Required
        </h2>

        <p
          className="text-muted"
          style={{ fontSize: '0.9375rem', lineHeight: 1.5, marginBottom: '20px' }}
        >
          You are currently signed in as <strong>{userName}</strong> with role{' '}
          <span
            style={{
              fontWeight: 600,
              padding: '2px 6px',
              backgroundColor: 'var(--color-surface-container)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {userRole}
          </span>
          . This portal requires authorized credentials for:{' '}
          <strong>{allowedRoles.length > 0 ? allowedRoles.join(', ') : 'Restricted Roles'}</strong>.
        </p>

        <div
          style={{
            backgroundColor: 'var(--color-surface-container)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            fontSize: '0.8125rem',
            color: 'var(--color-on-surface-variant)',
            marginBottom: '24px',
            textAlign: 'left',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>🔒 Session Status: Active</div>
          <div>
            Your authentication token remains intact and valid. You have not been logged out.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => navigate(defaultDashboard)}
          >
            Return to Authorized Dashboard
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleSwitchAccount}
          >
            Switch Account / Sign Out
          </Button>
        </div>
      </Card>
    </div>
  );
}
