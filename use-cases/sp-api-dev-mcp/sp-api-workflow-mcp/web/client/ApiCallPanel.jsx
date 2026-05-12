import React, { useState } from 'react';

/**
 * Extracts API call groups from execution events.
 * Each group = one state's TaskScheduled + TaskSucceeded/TaskFailed.
 * Polling loops (same state name repeated) are collapsed into one group.
 */
function buildApiCalls(events) {
  const calls = [];
  let current = null;

  for (const event of events) {
    if (event.type === 'TaskScheduled') {
      const req = event.request || {};
      const isPoll = current
        && current.stateName === event.state_name
        && !current.completed;

      if (isPoll) {
        // Add as a poll attempt to existing group
        current.attempts.push({
          scheduledAt: event.timestamp,
          request: req,
          response: null,
          error: null,
          completedAt: null,
        });
      } else {
        // Finalize previous if incomplete
        if (current && !current.completed) {
          current.completed = true;
        }
        current = {
          stateName: event.state_name,
          resource: event.resource || req.resource || 'sp-api',
          method: req.method || 'GET',
          path: req.path || req.url || '',
          url: req.url || '',
          attempts: [{
            scheduledAt: event.timestamp,
            request: req,
            response: null,
            error: null,
            completedAt: null,
          }],
          completed: false,
        };
        calls.push(current);
      }
    } else if (event.type === 'TaskSucceeded' && current) {
      const last = current.attempts[current.attempts.length - 1];
      if (last) {
        last.response = event.response;
        last.completedAt = event.timestamp;
        last.latency = new Date(event.timestamp) - new Date(last.scheduledAt);
      }
    } else if (event.type === 'TaskFailed' && current) {
      const last = current.attempts[current.attempts.length - 1];
      if (last) {
        last.error = { error: event.error, cause: event.cause };
        last.completedAt = event.timestamp;
        last.latency = new Date(event.timestamp) - new Date(last.scheduledAt);
      }
    } else if (event.type === 'StateExited' && current && event.state_name === current.stateName) {
      current.completed = true;
    }
  }

  return calls;
}

function MethodBadge({ method, resource }) {
  if (resource === 'fetch') {
    return <span className="api-method-badge method-fetch">FETCH</span>;
  }
  const cls = `api-method-badge method-${(method || 'GET').toLowerCase()}`;
  return <span className={cls}>{method || 'GET'}</span>;
}

function StatusBadge({ attempt }) {
  if (attempt.error) {
    return <span className="api-status-badge status-error">FAILED</span>;
  }
  if (attempt.response !== null && attempt.response !== undefined) {
    return <span className="api-status-badge status-success">200 OK</span>;
  }
  return <span className="api-status-badge status-pending">Pending...</span>;
}

function formatLatency(ms) {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function CollapsibleJson({ label, data }) {
  const [open, setOpen] = useState(false);
  if (data === null || data === undefined) return null;

  // For large string responses (like report content), truncate
  let displayData = data;
  let truncated = false;
  if (typeof data === 'string' && data.length > 2000) {
    displayData = data.substring(0, 2000);
    truncated = true;
  }

  return (
    <div className="api-collapsible">
      <button className="api-collapsible-toggle" onClick={() => setOpen(!open)}>
        <span className={`api-chevron ${open ? 'open' : ''}`}>&#9654;</span>
        {label}
      </button>
      {open && (
        <pre className="api-json-block">
          {typeof displayData === 'string' ? displayData : JSON.stringify(displayData, null, 2)}
          {truncated && '\n\n... (truncated)'}
        </pre>
      )}
    </div>
  );
}

function displayPath(call) {
  if (call.resource === 'fetch') {
    try {
      const u = new URL(call.url);
      return u.hostname + u.pathname.substring(0, 40) + (u.pathname.length > 40 ? '...' : '');
    } catch {
      return call.url.substring(0, 60) + (call.url.length > 60 ? '...' : '');
    }
  }

  // For sp-api calls, resolve path params if available
  let path = call.path;
  const req = call.attempts[0]?.request;
  if (req?.pathParams) {
    for (const [key, val] of Object.entries(req.pathParams)) {
      path = path.replace(`{${key}}`, val);
    }
  }
  return path;
}

function PollRow({ attempt, index }) {
  const status = attempt.error
    ? attempt.error.cause || 'Error'
    : attempt.response?.processingStatus || 'OK';
  const statusClass = attempt.error
    ? 'poll-error'
    : status === 'DONE' ? 'poll-done' : 'poll-pending';

  return (
    <div className={`api-poll-row ${statusClass}`}>
      <span className="poll-index">#{index + 1}</span>
      <span className="poll-status">{status}</span>
      {attempt.latency != null && (
        <span className="poll-latency">{formatLatency(attempt.latency)}</span>
      )}
      {!attempt.completedAt && (
        <span className="poll-spinner" />
      )}
    </div>
  );
}

function ApiCallCard({ call }) {
  const isPolling = call.attempts.length > 1;
  const lastAttempt = call.attempts[call.attempts.length - 1];
  const firstAttempt = call.attempts[0];

  return (
    <div className={`api-call-card ${lastAttempt.error ? 'card-error' : lastAttempt.response !== null ? 'card-success' : 'card-active'}`}>
      <div className="api-call-header">
        <div className="api-call-title">
          <MethodBadge method={call.method} resource={call.resource} />
          <span className="api-path">{displayPath(call)}</span>
        </div>
        <div className="api-call-meta">
          {isPolling && (
            <span className="api-poll-count">{call.attempts.length} calls</span>
          )}
          {!isPolling && lastAttempt.latency != null && (
            <span className="api-latency">{formatLatency(lastAttempt.latency)}</span>
          )}
          <StatusBadge attempt={lastAttempt} />
        </div>
      </div>

      <div className="api-call-state">{call.stateName}</div>

      {isPolling && (
        <div className="api-poll-list">
          {call.attempts.map((attempt, i) => (
            <PollRow key={i} attempt={attempt} index={i} />
          ))}
        </div>
      )}

      {!isPolling && (
        <div className="api-call-details">
          <CollapsibleJson label="Request" data={firstAttempt.request} />
          {lastAttempt.response && <CollapsibleJson label="Response" data={lastAttempt.response} />}
          {lastAttempt.error && <CollapsibleJson label="Error" data={lastAttempt.error} />}
        </div>
      )}
    </div>
  );
}

export default function ApiCallPanel({ events }) {
  const calls = buildApiCalls(events);

  if (calls.length === 0) {
    return <div className="api-empty">No API calls yet</div>;
  }

  return (
    <div className="api-panel">
      <div className="api-call-list">
        {[...calls].reverse().map((call, i) => (
          <ApiCallCard key={i} call={call} />
        ))}
      </div>
    </div>
  );
}
