import React, { useState } from 'react';

export default function TextInput({ inputRequest, onSubmit, loading }) {
  const [value, setValue] = useState(inputRequest.default || '');
  const multiline = inputRequest.multiline;
  const minLength = inputRequest.minLength;
  const maxLength = inputRequest.maxLength;
  const pattern = inputRequest.pattern;

  function validate() {
    if (inputRequest.required !== false && !value.trim()) return false;
    if (minLength && value.length < minLength) return false;
    if (maxLength && value.length > maxLength) return false;
    if (pattern) {
      try {
        if (!new RegExp(pattern).test(value)) return false;
      } catch { /* invalid pattern, skip */ }
    }
    return true;
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(value);
  }

  return (
    <form className="input-form" onSubmit={handleSubmit}>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={inputRequest.placeholder || ''}
          rows={5}
          maxLength={maxLength}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={inputRequest.placeholder || ''}
          minLength={minLength}
          maxLength={maxLength}
        />
      )}
      {maxLength && (
        <span className="char-count">{value.length}/{maxLength}</span>
      )}
      <button type="submit" className="btn btn-primary" disabled={loading || !validate()}>
        {loading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
