import React from 'react';

export default function SuccessScreen({ output, onRestart, onBack }) {
  return (
    <div className="result-screen success-screen">
      <div className="result-icon">&#10003;</div>
      <h2>Workflow Completed</h2>
      {output && (
        <details open>
          <summary>Output</summary>
          <pre className="output-json">{JSON.stringify(output, null, 2)}</pre>
        </details>
      )}
      <div className="result-actions">
        <button className="btn btn-primary" onClick={onRestart}>Run Again</button>
        <button className="btn btn-secondary" onClick={onBack}>Back to Workflows</button>
      </div>
    </div>
  );
}
