import React from 'react';
import Input from '../common/Input';
import { STANDARD_ALLOCATIONS } from '../../constants/responsibilityMaster';

export default function LabAllocationRow({
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
      [field]: field === 'hours' ? (value === '' ? '' : Math.max(0, Number(value))) : value,
    });
  };

  return (
    <div className="ui-allocation-row ui-allocation-row-5col">
      <div className="ui-allocation-col">
        <Input
          label="Lab Code"
          placeholder="e.g. 22CSP07"
          value={item.courseCode || ''}
          onChange={(e) => handleFieldChange('courseCode', e.target.value)}
          error={error.courseCode}
        />
      </div>

      <div className="ui-allocation-col ui-allocation-col-full">
        <Input
          label="Lab Title *"
          placeholder="e.g. Compiler Design Laboratory"
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
            list={`lab-allocation-datalist-${index}`}
            className="ui-input"
            placeholder="e.g. UG III Year A"
            value={item.allocation || ''}
            onChange={(e) => handleFieldChange('allocation', e.target.value)}
          />
          <datalist id={`lab-allocation-datalist-${index}`}>
            {STANDARD_ALLOCATIONS.map((alloc) => (
              <option key={alloc} value={alloc} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="ui-allocation-col">
        <Input
          label="Hrs/Week (Standard)"
          type="number"
          readOnly
          disabled
          value={4}
          helperText="4 hrs standard"
        />
      </div>

      <div className="ui-allocation-col-action">
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={!isRemovable}
          title={isRemovable ? 'Remove laboratory allocation' : 'At least one row required'}
          className="ui-allocation-delete-btn"
          aria-label={`Remove lab ${item.courseCode || index + 1}`}
        >
          <span>✕</span>
          <span className="ui-allocation-delete-label">Remove Lab</span>
        </button>
      </div>
    </div>
  );
}
