import React from 'react';

export default function StitchLogo({ size = 44, className = '', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-label="Nandha Engineering College Logo"
    >
      <rect width="100" height="100" rx="20" fill="#0f2942" />
      <path d="M22 74V26L48 54V26H56V74L30 46V74H22Z" fill="#ffffff" />
      <circle cx="74" cy="32" r="7" fill="#38bdf8" />
      <path d="M67 48H81V54H67V48ZM67 62H81V68H67V62Z" fill="#93c5fd" />
    </svg>
  );
}
