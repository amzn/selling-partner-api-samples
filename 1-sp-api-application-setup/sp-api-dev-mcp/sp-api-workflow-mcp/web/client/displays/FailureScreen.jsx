import React from 'react';

export default function FailureScreen({ error, onRetry, onBack }) {
  const errorName = error?.error || 'Unknown Error';
  const errorCause = error?.cause || 'An unexpected error occurred';

  return (
    <div className="result-screen failure-screen">
      <div className="result-icon error-icon">&#10007;</div>
      <h2>Workflow Failed</h2>
      <div className="error-details">
        <strong>{errorName}</strong>
        <p>{errorCause}</p>
      </div>
      <div className="result-actions">
        <button className="btn btn-primary" onClick={onRetry}>Retry</button>
        <button className="btn btn-secondary" onClick={onBack}>Back to Workflows</button>
      </div>
    </div>
  );
}
