import React from 'react';
import Breadcrumbs from '../layout/Breadcrumbs';

export default function PageHeader({
  title,
  description,
  badge = null,
  actions = null,
  breadcrumbs = null,
  className = '',
}) {
  const renderBreadcrumbs = () => {
    if (!breadcrumbs) return null;
    if (Array.isArray(breadcrumbs)) {
      return <Breadcrumbs items={breadcrumbs} />;
    }
    return breadcrumbs;
  };

  return (
    <div className={`ui-page-header ${className}`}>
      <div className="ui-page-header-main">
        {breadcrumbs && <div style={{ marginBottom: 6 }}>{renderBreadcrumbs()}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="ui-page-header-title">{title}</h1>
          {badge && <span className="ui-page-header-badge">{badge}</span>}
        </div>
        {description && <p className="ui-page-header-desc">{description}</p>}
      </div>
      {actions && <div className="ui-page-header-actions">{actions}</div>}
    </div>
  );
}
