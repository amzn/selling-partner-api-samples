import React, { useState } from 'react';

export default function SingleSelectInput({ inputRequest, onSubmit, loading }) {
  const options = inputRequest.options || [];
  const optionLabel = inputRequest.optionLabel;
  const optionValue = inputRequest.optionValue;
  const [selected, setSelected] = useState(inputRequest.default ?? '');

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

  function handleSubmit(e) {
    e.preventDefault();
    // Return the full option object or just the value
    if (optionValue) {
      onSubmit(selected);
    } else if (typeof options[0] === 'string') {
      onSubmit(selected);
    } else {
      // Find and return full option object
      const opt = options.find(o => getValue(o) === selected);
      onSubmit(opt || selected);
    }
  }

  return (
    <form className="input-form" onSubmit={handleSubmit}>
      <div className="radio-group">
        {options.map((opt, i) => {
          const val = getValue(opt);
          const label = getLabel(opt);
          const desc = typeof opt === 'object' ? opt[inputRequest.optionDescription] : null;
          return (
            <label key={i} className={`radio-option ${selected === val ? 'selected' : ''}`}>
              <input
                type="radio"
                name="single-select"
                value={val}
                checked={selected === val}
                onChange={() => setSelected(val)}
              />
              <span className="radio-label">{label}</span>
              {desc && <span className="radio-desc">{desc}</span>}
            </label>
          );
        })}
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={loading || (!selected && inputRequest.required !== false)}
      >
        {loading ? 'Submitting...' : 'Continue'}
      </button>
    </form>
  );
}
