import React, { useState } from 'react';

export default function ConfirmInput({ inputRequest, onSubmit, loading }) {
  const details = inputRequest.details;
  const detailFields = inputRequest.detailFields;
  const confirmLabel = inputRequest.confirmLabel || 'Confirm';
  const cancelLabel = inputRequest.cancelLabel || 'Cancel';
  const warningLevel = inputRequest.warningLevel;
  const warningMessage = inputRequest.warningMessage;
  const requireTyped = inputRequest.requireTypedConfirmation;
  const confirmPhrase = inputRequest.confirmationPhrase || 'CONFIRM';
  const [typed, setTyped] = useState('');

  function renderDetails() {
    if (!details) return null;

    if (detailFields && Array.isArray(detailFields)) {
      return (
        <div className="confirm-details">
          {detailFields.map((field, i) => (
            <div key={i} className="detail-row">
              <span className="detail-label">{field.label || field.key}:</span>
              <span className="detail-value">
                {formatValue(details[field.key], field.format)}
              </span>
            </div>
          ))}
        </div>
      );
    }

    if (typeof details === 'object') {
      return (
        <pre className="confirm-details-json">
          {JSON.stringify(details, null, 2)}
        </pre>
      );
    }

    return <p>{String(details)}</p>;
  }

  function formatValue(val, format) {
    if (val === null || val === undefined) return '-';
    if (format === 'currency') return `$${Number(val).toFixed(2)}`;
    if (format === 'date') return new Date(val).toLocaleDateString();
    if (format === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  const canConfirm = !requireTyped || typed === confirmPhrase;

  return (
    <div className="input-form confirm-input">
      {warningMessage && (
        <div className={`warning warning-${warningLevel || 'info'}`}>
          {warningMessage}
        </div>
      )}
      {renderDetails()}
      {requireTyped && (
        <div className="typed-confirm">
          <label>Type <strong>{confirmPhrase}</strong> to confirm:</label>
          <input
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder={confirmPhrase}
          />
        </div>
      )}
      <div className="confirm-buttons">
        <button
          className="btn btn-primary"
          onClick={() => onSubmit(true)}
          disabled={loading || !canConfirm}
        >
          {confirmLabel}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => onSubmit(false)}
          disabled={loading}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
