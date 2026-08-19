import React, { useState } from 'react';

export default function NumberInput({ inputRequest, onSubmit, loading }) {
  const [value, setValue] = useState(inputRequest.default ?? '');

  function validate() {
    if (value === '' && inputRequest.required !== false) return false;
    if (value === '') return true;
    const num = Number(value);
    if (isNaN(num)) return false;
    if (inputRequest.min !== undefined && num < inputRequest.min) return false;
    if (inputRequest.max !== undefined && num > inputRequest.max) return false;
    return true;
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(Number(value));
  }

  return (
    <form className="input-form" onSubmit={handleSubmit}>
      <div className="number-field">
        <input
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          min={inputRequest.min}
          max={inputRequest.max}
          step={inputRequest.step || 'any'}
        />
        {inputRequest.unit && <span className="unit">{inputRequest.unit}</span>}
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading || !validate()}>
        {loading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
