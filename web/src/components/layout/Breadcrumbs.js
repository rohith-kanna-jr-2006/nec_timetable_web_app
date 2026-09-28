import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Breadcrumbs({ items = [] }) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="ui-breadcrumbs">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={item.label || index}>
            {item.path && !isLast ? (
              <NavLink to={item.path}>{item.label}</NavLink>
            ) : (
              <span className={isLast ? 'ui-breadcrumbs-current' : ''}>
                {item.label}
              </span>
            )}
            {!isLast && <span className="ui-breadcrumbs-separator">/</span>}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
