import React from 'react';
import Input from '../common/Input';
import { STANDARD_ALLOCATIONS } from '../../constants/responsibilityMaster';

export default function OtherAllocationRow({
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
      [field]: field === 'hours' ? (value === '' ? '' : Number(value)) : value,
    });
  };

  const hoursNum = typeof item.hours === 'number' ? item.hours : Number(item.hours);
  const isOutOfRange = item.hours !== '' && (hoursNum < 1 || hoursNum > 3 || isNaN(hoursNum));

  return (
    <div className="ui-allocation-row ui-allocation-row-4col">
      <div className="ui-allocation-col ui-allocation-col-full">
        <Input
          label="Academic Activity / Course Title *"
          placeholder="e.g. Project Based Learning (PBL) / Mini Project"
          value={item.courseName || ''}
          onChange={(e) => handleFieldChange('courseName', e.target.value)}
          error={error.courseName}
          required
        />
      </div>

      <div className="ui-allocation-col">
        <div className="ui-form-group">
          <label className="ui-label">Allocation / Section</label>
          <input
            list={`other-allocation-datalist-${index}`}
            className="ui-input"
            placeholder="e.g. UG II Year A"
            value={item.allocation || ''}
            onChange={(e) => handleFieldChange('allocation', e.target.value)}
          />
          <datalist id={`other-allocation-datalist-${index}`}>
            {STANDARD_ALLOCATIONS.map((alloc) => (
              <option key={alloc} value={alloc} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="ui-allocation-col">
        <Input
          label="Hrs/Week (1–3) *"
          type="number"
          min="1"
          max="3"
          step="1"
          placeholder="2"
          value={item.hours !== undefined && item.hours !== null ? item.hours : 2}
          onChange={(e) => handleFieldChange('hours', e.target.value)}
          error={error.hours || (isOutOfRange ? 'Must be between 1 and 3 hrs' : null)}
          helperText="Strict limit: 1 to 3 hours/week"
          required
        />
      </div>

      <div className="ui-allocation-col-action">
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={!isRemovable}
          title="Remove other academic allocation"
          className="ui-allocation-delete-btn"
          aria-label={`Remove academic activity ${item.courseName || index + 1}`}
        >
          <span>✕</span>
          <span className="ui-allocation-delete-label">Remove Activity</span>
        </button>
      </div>
    </div>
  );
}
