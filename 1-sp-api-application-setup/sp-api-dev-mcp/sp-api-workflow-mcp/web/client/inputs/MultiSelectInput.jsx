import React, { useState } from 'react';

export default function MultiSelectInput({ inputRequest, onSubmit, loading }) {
  const options = inputRequest.options || [];
  const optionLabel = inputRequest.optionLabel;
  const optionValue = inputRequest.optionValue;
  const minSelections = inputRequest.minSelections ?? 0;
  const maxSelections = inputRequest.maxSelections;
  const [selected, setSelected] = useState(new Set());

  function getLabel(opt) {
    if (typeof opt === 'string') return opt;
    if (optionLabel) return opt[optionLabel];
    return opt.label || opt.name || JSON.stringify(opt);
  }

  function getValue(opt) {
    if (typeof opt === 'string') return opt;
    if (optionValue) return opt[optionValue];
    return opt.value || opt.id || JSON.stringify(opt);
  }

  function toggle(val) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(val)) {
        next.delete(val);
      } else {
        if (maxSelections && next.size >= maxSelections) return prev;
        next.add(val);
      }
      return next;
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const values = Array.from(selected);
    if (optionValue || typeof options[0] === 'string') {
      onSubmit(values);
    } else {
      onSubmit(options.filter(o => selected.has(getValue(o))));
    }
  }

  const valid = selected.size >= minSelections &&
    (!maxSelections || selected.size <= maxSelections);

  return (
    <form className="input-form" onSubmit={handleSubmit}>
      {minSelections > 0 && (
        <p className="hint">Select at least {minSelections}{maxSelections ? `, up to ${maxSelections}` : ''}</p>
      )}
      <div className="checkbox-group">
        {options.map((opt, i) => {
          const val = getValue(opt);
          const label = getLabel(opt);
          return (
            <label key={i} className={`checkbox-option ${selected.has(val) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={selected.has(val)}
                onChange={() => toggle(val)}
              />
              <span>{label}</span>
            </label>
          );
        })}
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading || !valid}>
        {loading ? 'Submitting...' : 'Continue'}
      </button>
    </form>
  );
}
