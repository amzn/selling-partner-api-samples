import React from 'react';

export default function BooleanInput({ inputRequest, onSubmit, loading }) {
  const trueLabel = inputRequest.trueLabel || 'Yes';
  const falseLabel = inputRequest.falseLabel || 'No';

  return (
    <div className="input-form boolean-input">
      <div className="boolean-buttons">
        <button
          className="btn btn-primary"
          onClick={() => onSubmit(true)}
          disabled={loading}
        >
          {trueLabel}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => onSubmit(false)}
          disabled={loading}
        >
          {falseLabel}
        </button>
      </div>
    </div>
  );
}
