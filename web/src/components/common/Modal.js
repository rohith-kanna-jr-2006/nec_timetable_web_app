import React, { useEffect } from 'react';
import Button from './Button';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = '560px',
  closeOnEscape = true,
  closeOnBackdrop = true,
}) {
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="ui-modal-backdrop"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="ui-modal-content"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-modal-header">
          <h3 id="modal-title" style={{ fontSize: '1.25rem', margin: 0 }}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-subtle btn-sm"
            style={{ padding: '4px 8px', fontSize: '1.25rem', lineHeight: 1 }}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
