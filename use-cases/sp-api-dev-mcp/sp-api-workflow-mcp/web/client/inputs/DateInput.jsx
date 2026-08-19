import React, { useState } from 'react';

export default function DateInput({ inputRequest, onSubmit, loading }) {
  const [value, setValue] = useState(inputRequest.default || '');
  const includeTime = inputRequest.includeTime;
  const inputType = includeTime ? 'datetime-local' : 'date';

  function validate() {
    if (!value && inputRequest.required !== false) return false;
    return true;
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(value);
  }

  return (
    <form className="input-form" onSubmit={handleSubmit}>
      <input
        type={inputType}
        value={value}
        onChange={e => setValue(e.target.value)}
        min={inputRequest.minDate}
        max={inputRequest.maxDate}
      />
      <button type="submit" className="btn btn-primary" disabled={loading || !validate()}>
        {loading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
