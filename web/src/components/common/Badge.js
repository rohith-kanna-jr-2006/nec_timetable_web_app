import React from 'react';

export default function Badge({
  children,
  variant = 'neutral', // 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral' | 'theory' | 'lab' | 'elective'
  dot = false,
  className = '',
  style = {},
  ...props
}) {
  return (
    <span
      className={`ui-badge ui-badge-${variant} ${className}`}
      style={style}
      {...props}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            display: 'inline-block',
          }}
        />
      )}
      {children}
    </span>
  );
}
