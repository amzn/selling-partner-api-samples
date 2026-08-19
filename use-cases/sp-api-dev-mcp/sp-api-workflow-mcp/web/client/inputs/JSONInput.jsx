import React, { useState } from 'react';

export default function JSONInput({ inputRequest, onSubmit, loading }) {
  const pretty = inputRequest.pretty;
  const maxLength = inputRequest.maxLength;
  const [value, setValue] = useState(
    inputRequest.default ? (pretty ? JSON.stringify(inputRequest.default, null, 2) : JSON.stringify(inputRequest.default)) : ''
  );
  const [parseError, setParseError] = useState(null);

  function validate() {
    if (!value.trim() && inputRequest.required !== false) return false;
    if (!value.trim()) return true;
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  function handleChange(e) {
    setValue(e.target.value);
    try {
      if (e.target.value.trim()) JSON.parse(e.target.value);
      setParseError(null);
    } catch (err) {
      setParseError(err.message);
    }
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(value);
      setValue(JSON.stringify(parsed, null, 2));
      setParseError(null);
    } catch { /* ignore */ }
  }

  function handleSubmit(e) {
    e.preventDefault();
    try {
      onSubmit(JSON.parse(value));
    } catch {
      setParseError('Invalid JSON');
    }
  }

  return (
    <form className="input-form json-input" onSubmit={handleSubmit}>
      <div className="json-toolbar">
        <button type="button" className="btn btn-small" onClick={handleFormat}>
          Format
        </button>
        {maxLength && <span className="char-count">{value.length}/{maxLength}</span>}
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        rows={12}
        className="json-textarea"
        spellCheck={false}
        maxLength={maxLength}
      />
      {parseError && <div className="error json-error">{parseError}</div>}
      <button type="submit" className="btn btn-primary" disabled={loading || !validate()}>
        {loading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
