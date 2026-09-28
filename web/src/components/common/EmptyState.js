import React from 'react';

export default function EmptyState({
  title = 'No records found',
  description = 'There are no items to display in this view at the moment.',
  icon = '📭',
  action = null,
  className = '',
  style = {},
}) {
  return (
    <div className={`ui-empty-state ${className}`} style={style}>
      <div className="ui-state-icon ui-empty-icon">{icon}</div>
      <h4 className="ui-state-title">{title}</h4>
      <p className="ui-state-desc">{description}</p>
      {action && <div className="ui-state-action">{action}</div>}
    </div>
  );
}
