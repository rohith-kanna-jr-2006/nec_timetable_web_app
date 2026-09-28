import React from 'react';

export default function Card({
  children,
  title,
  action,
  hoverable = false,
  className = '',
  style = {},
  ...props
}) {
  return (
    <div
      className={`ui-card ${hoverable ? 'ui-card-hover' : ''} ${className}`}
      style={style}
      {...props}
    >
      {(title || action) && (
        <div className="ui-card-header">
          {title && <h3 style={{ fontSize: '1.0625rem', margin: 0 }}>{title}</h3>}
          {action && <div className="ui-card-action">{action}</div>}
        </div>
      )}
      <div className="ui-card-content">{children}</div>
    </div>
  );
}
