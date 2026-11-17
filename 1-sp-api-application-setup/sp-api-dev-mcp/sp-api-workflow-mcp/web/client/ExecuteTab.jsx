import React, { useState, useEffect } from 'react';
import useWorkflowExecution from './hooks/useWorkflowExecution.js';
import InputRenderer from './InputRenderer.jsx';
import SuccessScreen from './displays/SuccessScreen.jsx';
import FailureScreen from './displays/FailureScreen.jsx';
import EventTimeline from './EventTimeline.jsx';
import ProgressBar from './ProgressBar.jsx';
import ApiCallPanel from './ApiCallPanel.jsx';

export default function ExecuteTab({ workflowId, workflow }) {
  const [sideTab, setSideTab] = useState('api');
  const [pastRuns, setPastRuns] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const {
    executionId,
    status,
    callbackId,
    inputRequest,
    output,
    error,
    loading,
    events,
    start,
    submit,
    recover,
  } = useWorkflowExecution();

  // Load past executions
  useEffect(() => {
    if (!workflowId) return;
    fetch(`/api/executions?workflow_id=${workflowId}&limit=10`)
      .then(r => r.json())
      .then(data => setPastRuns(data.executions || []))
      .catch(() => {});
  }, [workflowId, status]);

  // Recover from stored execution on mount
  useEffect(() => {
    const storedExecId = sessionStorage.getItem(`exec_${workflowId}`);
    if (storedExecId && status === 'IDLE') {
      recover(storedExecId);
    }
  }, [workflowId, status, recover]);

  // Store execution ID in session storage
  useEffect(() => {
    if (executionId) {
      sessionStorage.setItem(`exec_${workflowId}`, executionId);
    }
  }, [executionId, workflowId]);

  // Clear stored execution when done
  useEffect(() => {
    if (status === 'SUCCEEDED' || status === 'FAILED') {
      sessionStorage.removeItem(`exec_${workflowId}`);
    }
  }, [status, workflowId]);

  function handleStart() {
    setShowHistory(false);
    start(workflowId);
  }

  function handleRestart() {
    sessionStorage.removeItem(`exec_${workflowId}`);
    setShowHistory(false);
    start(workflowId);
  }

  const schema = workflow?.schema;
  const hasActivity = events.length > 0;

  return (
    <div className="exec-tab">
      {schema && hasActivity && (
        <ProgressBar schema={schema} events={events} currentStatus={status} />
      )}

      <div className={`exec-layout ${hasActivity ? 'has-sidebar' : ''}`}>
        <div className="exec-main">
          {status === 'IDLE' && (
            <div className="exec-idle">
              <button className="btn btn-primary" onClick={handleStart}>
                Start Workflow
              </button>
              {pastRuns.length > 0 && (
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => setShowHistory(!showHistory)}
                  style={{ marginTop: 12 }}
                >
                  {showHistory ? 'Hide' : 'Show'} Past Runs ({pastRuns.length})
                </button>
              )}
              {showHistory && (
                <div className="exec-history">
                  {pastRuns.map(run => (
                    <div
                      key={run.execution_id}
                      className="exec-history-item"
                      onClick={() => recover(run.execution_id)}
                    >
                      <span className={`exec-status-dot exec-status-${run.status.toLowerCase()}`} />
                      <span className="exec-history-id">{run.execution_id.slice(0, 16)}</span>
                      <span className={`exec-status-label exec-status-${run.status.toLowerCase()}`}>
                        {run.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {status === 'RUNNING' && loading && (
            <div className="loading">
              <div className="spinner" />
              <p>Running...</p>
            </div>
          )}

          {status === 'WAITING_FOR_INPUT' && inputRequest && (
            <InputRenderer
              callbackId={callbackId}
              inputRequest={inputRequest}
              onSubmit={submit}
              error={error}
              loading={loading}
            />
          )}

          {status === 'SUCCEEDED' && (
            <SuccessScreen
              output={output}
              onRestart={handleRestart}
            />
          )}

          {status === 'FAILED' && (
            <FailureScreen
              error={error}
              onRetry={handleRestart}
            />
          )}
        </div>

        {hasActivity && (
          <div className="exec-sidebar">
            <div className="sidebar-tabs">
              <button
                className={`sidebar-tab ${sideTab === 'api' ? 'active' : ''}`}
                onClick={() => setSideTab('api')}
              >
                API Calls
              </button>
              <button
                className={`sidebar-tab ${sideTab === 'events' ? 'active' : ''}`}
                onClick={() => setSideTab('events')}
              >
                Events ({events.length})
              </button>
            </div>
            <div className="sidebar-content">
              {sideTab === 'api' && <ApiCallPanel events={events} />}
              {sideTab === 'events' && <EventTimeline events={events} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
