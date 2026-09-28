import React from 'react';

export default function Toast({ message, type = 'info', onClose }) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      default:
        return 'ℹ';
    }
  };

  return (
    <div className={`ui-toast ui-toast-${type}`} role="alert">
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '0.875rem',
          backgroundColor:
            type === 'success'
              ? 'var(--color-success-forest)'
              : type === 'error'
              ? 'var(--color-error)'
              : 'var(--color-secondary)',
          color: '#ffffff',
          flexShrink: 0,
        }}
      >
        {getIcon()}
      </span>
      <div style={{ flex: 1, fontSize: '0.875rem' }}>{message}</div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            opacity: 0.7,
            cursor: 'pointer',
            fontSize: '1.125rem',
            padding: '2px 4px',
          }}
          aria-label="Dismiss toast"
        >
          ×
        </button>
      )}
    </div>
  );
}
