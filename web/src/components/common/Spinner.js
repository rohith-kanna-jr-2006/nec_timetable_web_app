import React from 'react';

export default function Spinner({ size = 'md', variant = 'default', className = '' }) {
  const sizeClass = size === 'lg' ? 'ui-spinner-lg' : '';
  const variantClass = variant === 'white' ? 'ui-spinner-white' : '';

  return (
    <span
      className={`ui-spinner ${sizeClass} ${variantClass} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
