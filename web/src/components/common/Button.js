import React from 'react';
import Spinner from './Spinner';

export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'subtle' | 'danger'
  size = 'md',        // 'sm' | 'md' | 'lg'
  isLoading = false,
  disabled = false,
  icon = null,
  iconRight = null,
  type = 'button',
  onClick,
  className = '',
  ...props
}) {
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;

  return (
    <button
      type={type}
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner size="sm" variant={variant === 'primary' || variant === 'secondary' || variant === 'danger' ? 'white' : 'default'} />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {icon && <span className="btn-icon-left">{icon}</span>}
          {children}
          {iconRight && <span className="btn-icon-right">{iconRight}</span>}
        </>
      )}
    </button>
  );
}
