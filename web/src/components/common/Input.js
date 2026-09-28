import React from 'react';

export default function Input({
  label,
  error,
  helperText,
  icon = null,
  id,
  type = 'text',
  className = '',
  wrapperClassName = '',
  required = false,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`ui-form-group ${wrapperClassName}`}>
      {label && (
        <label htmlFor={inputId} className="ui-label">
          {label} {required && <span style={{ color: 'var(--color-error)' }}>*</span>}
        </label>
      )}
      <div className="ui-input-wrapper">
        {icon && <span className="ui-input-icon-left">{icon}</span>}
        <input
          id={inputId}
          type={type}
          className={`ui-input ${icon ? 'ui-input-has-icon' : ''} ${error ? 'ui-input-error' : ''} ${className}`}
          required={required}
          {...props}
        />
      </div>
      {error && <span className="ui-form-error">{error}</span>}
      {!error && helperText && <span className="text-xs text-muted">{helperText}</span>}
    </div>
  );
}
