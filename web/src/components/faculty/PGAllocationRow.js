import React from 'react';
import Input from '../common/Input';
import Badge from '../common/Badge';
import { STANDARD_ALLOCATIONS } from '../../constants/responsibilityMaster';

export default function PGAllocationRow({
  item,
  index,
  onChange,
  onRemove,
  isRemovable = true,
  error = {},
}) {
  const handleFieldChange = (field, value) => {
    onChange(index, {
      ...item,
      [field]: value,
    });
  };

  return (
    <div className="ui-allocation-row ui-allocation-row-4col">
      <div className="ui-allocation-col">
        <Input
          label="Course Code"
          placeholder="e.g. 22CPB05"
          value={item.courseCode || ''}
          onChange={(e) => handleFieldChange('courseCode', e.target.value)}
          error={error.courseCode}
        />
      </div>

      <div className="ui-allocation-col ui-allocation-col-full">
        <Input
          label="PG / Honours / Minor Title *"
          placeholder="e.g. Advanced Distributed Systems"
          value={item.courseName || ''}
          onChange={(e) => handleFieldChange('courseName', e.target.value)}
          error={error.courseName}
          required
        />
      </div>

      <div className="ui-allocation-col">
        <div className="ui-form-group">
          <label className="ui-label">Allocation</label>
          <input
            list={`pg-allocation-datalist-${index}`}
            className="ui-input"
            placeholder="e.g. PG I Year"
            value={item.allocation || ''}
            onChange={(e) => handleFieldChange('allocation', e.target.value)}
          />
          <datalist id={`pg-allocation-datalist-${index}`}>
            {STANDARD_ALLOCATIONS.map((alloc) => (
              <option key={alloc} value={alloc} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="ui-allocation-col">
        <div className="ui-form-group">
          <label className="ui-label">Equivalent Load</label>
          <div
            style={{
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-surface-container-low)',
              padding: '0 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-outline-variant)',
              fontSize: '0.8125rem',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            <Badge variant="secondary">1 hr/wk</Badge>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Norm</span>
          </div>
        </div>
      </div>

      <div className="ui-allocation-col-action">
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={!isRemovable}
          title="Remove PG course"
          className="ui-allocation-delete-btn"
          aria-label={`Remove PG course ${item.courseCode || index + 1}`}
        >
          <span>✕</span>
          <span className="ui-allocation-delete-label">Remove PG Course</span>
        </button>
      </div>
    </div>
  );
}
