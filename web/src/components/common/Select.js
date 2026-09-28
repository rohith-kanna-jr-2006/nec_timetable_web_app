import React from 'react';

export default function Select({
  label,
  options = [],
  error,
  helperText,
  id,
  className = '',
  wrapperClassName = '',
  required = false,
  placeholder = 'Select an option',
  ...props
}) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`ui-form-group ${wrapperClassName}`}>
      {label && (
        <label htmlFor={selectId} className="ui-label">
          {label} {required && <span style={{ color: 'var(--color-error)' }}>*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={`ui-select ${error ? 'ui-input-error' : ''} ${className}`}
        required={required}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lbl = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
      {error && <span className="ui-form-error">{error}</span>}
      {!error && helperText && <span className="text-xs text-muted">{helperText}</span>}
    </div>
  );
}
