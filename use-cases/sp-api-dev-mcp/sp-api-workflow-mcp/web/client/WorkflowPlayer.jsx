import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useWorkflowExecution from './hooks/useWorkflowExecution.js';
import InputRenderer from './InputRenderer.jsx';
import SuccessScreen from './displays/SuccessScreen.jsx';
import FailureScreen from './displays/FailureScreen.jsx';
import EventTimeline from './EventTimeline.jsx';
import ProgressBar from './ProgressBar.jsx';
import ApiCallPanel from './ApiCallPanel.jsx';

export default function WorkflowPlayer() {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [sideTab, setSideTab] = useState('api'); // 'api' | 'events'

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

  // Load workflow info on mount
  useEffect(() => {
    fetch(`/api/workflows/${workflowId}`)
      .then(r => {
        if (!r.ok) throw new Error('Workflow not found');
        return r.json();
      })
      .then(data => setWorkflow(data))
      .catch(err => setLoadError(err.message));
  }, [workflowId]);

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
    start(workflowId);
  }

  function handleSubmit(cbId, data) {
    submit(cbId, data);
  }

  function handleRestart() {
    sessionStorage.removeItem(`exec_${workflowId}`);
    start(workflowId);
  }

  if (loadError) {
    return <div className="error">{loadError}</div>;
  }
  if (!workflow) {
    return <div className="loading">Loading workflow...</div>;
  }

  const hasActivity = events.length > 0;

  return (
    <div className="player">
      <div className="player-header">
        <h1>{workflow.name}</h1>
        {workflow.description && <p className="player-desc">{workflow.description}</p>}
      </div>

      {workflow.schema && (
        <ProgressBar schema={workflow.schema} events={events} currentStatus={status} />
      )}

      <div className={`player-layout ${hasActivity ? 'has-sidebar' : ''}`}>
        <div className="player-main">
          <div className="player-content">
            {status === 'IDLE' && (
              <div className="start-section">
                <button className="btn btn-primary" onClick={handleStart}>
                  Start Workflow
                </button>
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
                onSubmit={handleSubmit}
                error={error}
                loading={loading}
              />
            )}

            {status === 'SUCCEEDED' && (
              <SuccessScreen
                output={output}
                onRestart={handleRestart}
                onBack={() => navigate('/')}
              />
            )}

            {status === 'FAILED' && (
              <FailureScreen
                error={error}
                onRetry={handleRestart}
                onBack={() => navigate('/')}
              />
            )}
          </div>
        </div>

        {hasActivity && (
          <div className="player-sidebar">
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
