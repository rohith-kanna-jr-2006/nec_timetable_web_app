import React, { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { showToast } = useToast();

  const isSessionExpired = searchParams.get('expired') === 'true';

  const [email, setEmail] = useState(process.env.NODE_ENV !== 'production' ? 'faculty@nec.edu.in' : '');
  const [password, setPassword] = useState(process.env.NODE_ENV !== 'production' ? 'Password123!' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    isSessionExpired ? 'Your previous session has expired. Please sign in again.' : null
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Please enter both institutional email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email.trim(), password);
      showToast(`Welcome back, ${result.user.name}!`, 'success');

      // Determine redirect path: return to prior destination or role's default portal
      const fromPath = location.state?.from?.pathname;
      const targetPath = fromPath && fromPath !== '/login' ? fromPath : result.redirectPath;

      navigate(targetPath, { replace: true });
    } catch (err) {
      const msg = err.message || 'Invalid institutional credentials. Please verify and try again.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRolePreset = (presetEmail) => {
    setEmail(presetEmail);
    setPassword('Password123!');
    setErrorMessage(null);
  };

  return (
    <Card className="ui-card-hover" style={{ padding: '32px 28px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.375rem', marginBottom: '6px' }}>Staff Sign In</h2>
        <p className="text-muted text-sm">
          Authenticate using your institutional credentials for role-authorized portal access.
        </p>
      </div>

      {/* Role Quick Preset Selector for Testing (non-production only) */}
      {process.env.NODE_ENV !== 'production' && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label className="ui-label" style={{ margin: 0 }}>
              Quick Account Credentials (Dev)
            </label>
            <span className="text-xs text-muted">Click to autofill</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            <button
              type="button"
              className={`btn ${email === 'faculty@nec.edu.in' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              style={{ fontSize: '0.75rem', padding: '6px 2px' }}
              onClick={() => handleRolePreset('faculty@nec.edu.in')}
            >
              Faculty
            </button>
            <button
              type="button"
              className={`btn ${email === 'tc@nec.edu.in' ? 'btn-secondary' : 'btn-outline'} btn-sm`}
              style={{
                fontSize: '0.75rem',
                padding: '6px 2px',
                backgroundColor: email === 'tc@nec.edu.in' ? 'var(--color-primary-container)' : undefined,
                fontWeight: 600,
              }}
              onClick={() => handleRolePreset('tc@nec.edu.in')}
            >
              TC
            </button>
            <button
              type="button"
              className={`btn ${email === 'hod@nec.edu.in' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              style={{
                fontSize: '0.75rem',
                padding: '6px 2px',
                backgroundColor: email === 'hod@nec.edu.in' ? 'var(--color-primary-container)' : undefined,
                borderColor: email === 'hod@nec.edu.in' ? 'var(--color-secondary)' : undefined,
              }}
              onClick={() => handleRolePreset('hod@nec.edu.in')}
            >
              HOD
            </button>
          </div>
        </div>
      )}

      {/* Error / Alert Banner */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: isSessionExpired ? 'var(--color-warning-bg)' : 'var(--color-error-container)',
            color: isSessionExpired ? 'var(--color-warning-text)' : 'var(--color-on-error-container)',
            border: `1px solid ${isSessionExpired ? 'var(--color-warning-border)' : '#ffb4ab'}`,
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontSize: '0.8125rem',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
          role="alert"
        >
          <span>{isSessionExpired ? '⚠️' : '✕'}</span>
          <span style={{ flex: 1 }}>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Input
          label="Institutional Email / Staff ERP ID"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          placeholder="staff@nec.edu.in"
          helperText="Domain: @nec.edu.in"
        />

        <div style={{ position: 'relative' }}>
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: 12,
              top: 36,
              background: 'none',
              border: 'none',
              fontSize: '0.75rem',
              color: 'var(--color-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            fontSize: '0.8125rem',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" defaultChecked />
            <span>Remember session</span>
          </label>
          <span className="text-muted" style={{ cursor: 'not-allowed', fontSize: '0.75rem' }}>
            ERP ext 241
          </span>
        </div>

        <Button
          type="submit"
          variant="secondary"
          size="lg"
          className="w-full"
          isLoading={isLoading}
        >
          Sign In to Portal
        </Button>
      </form>

      <div
        style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid var(--color-surface-container)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
        }}
      >
        <span className="text-muted">Security Tier</span>
        <Badge variant="success" dot>
          JWT • Express Authoritative
        </Badge>
      </div>
    </Card>
  );
}
