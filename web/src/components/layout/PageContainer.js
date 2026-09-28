import React from 'react';

export default function PageContainer({
  children,
  maxWidth = 'var(--max-content-width)',
  className = '',
  style = {},
}) {
  return (
    <main
      className={`ui-page-container ${className}`}
      style={{ maxWidth, ...style }}
    >
      {children}
    </main>
  );
}
