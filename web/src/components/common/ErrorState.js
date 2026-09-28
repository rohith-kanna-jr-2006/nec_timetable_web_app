import React from 'react';
import Button from './Button';

export default function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred while loading this section. Please try again.',
  errorDetails = null,
  onRetry = null,
  retryText = 'Try Again',
  className = '',
  style = {},
}) {
  return (
    <div className={`ui-error-state ${className}`} style={style}>
      <div className="ui-state-icon ui-error-icon">⚠️</div>
      <h4 className="ui-state-title">{title}</h4>
      <p className="ui-state-desc">{description}</p>
      {errorDetails && (
        <pre
          style={{
            maxWidth: '100%',
            overflowX: 'auto',
            padding: '8px 12px',
            backgroundColor: 'var(--color-surface-container)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.75rem',
            color: 'var(--color-error)',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          {typeof errorDetails === 'object' ? JSON.stringify(errorDetails, null, 2) : errorDetails}
        </pre>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryText}
        </Button>
      )}
    </div>
  );
}
