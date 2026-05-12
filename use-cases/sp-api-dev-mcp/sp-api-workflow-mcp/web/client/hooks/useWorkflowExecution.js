import { useState, useCallback, useRef, useEffect } from 'react';

export default function useWorkflowExecution() {
  const [executionId, setExecutionId] = useState(null);
  const [status, setStatus] = useState('IDLE'); // IDLE | RUNNING | WAITING_FOR_INPUT | SUCCEEDED | FAILED
  const [callbackId, setCallbackId] = useState(null);
  const [inputRequest, setInputRequest] = useState(null);
  const [output, setOutput] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const pollRef = useRef(null);
  const execIdRef = useRef(null);

  // Keep execIdRef in sync for polling
  useEffect(() => { execIdRef.current = executionId; }, [executionId]);

  // Poll events while RUNNING
  useEffect(() => {
    if (status === 'RUNNING' && executionId) {
      pollRef.current = setInterval(async () => {
        const id = execIdRef.current;
        if (!id) return;
        try {
          const res = await fetch(`/api/executions/${id}/events`);
          if (res.ok) {
            const data = await res.json();
            setEvents(data.events || []);
          }
        } catch { /* non-critical */ }
      }, 2000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [status, executionId]);

  // Process the result from execute or resume
  const processResult = useCallback(async (result, execId) => {
    const id = execId || result.execution_id;

    if (result.status === 'WAITING_FOR_CALLBACK') {
      setStatus('WAITING_FOR_INPUT');
      setCallbackId(result.callback_id);
      setInputRequest(result.input_request);
    } else if (result.status === 'SUCCEEDED') {
      setStatus('SUCCEEDED');
      setOutput(result.output);
    } else if (result.status === 'FAILED') {
      setStatus('FAILED');
      setError({ error: result.error, cause: result.cause });
    }

    // Fetch events
    if (id) {
      try {
        const evRes = await fetch(`/api/executions/${id}/events`);
        const evData = await evRes.json();
        setEvents(evData.events || []);
      } catch {
        // non-critical
      }
    }
  }, []);

  // Start a new execution
  const start = useCallback(async (workflowId, input = {}) => {
    setLoading(true);
    setStatus('RUNNING');
    setError(null);
    setOutput(null);
    setCallbackId(null);
    setInputRequest(null);
    setEvents([]);

    try {
      const res = await fetch('/api/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_id: workflowId, input }),
      });
      const result = await res.json();

      if (res.ok) {
        setExecutionId(result.execution_id);
        await processResult(result, result.execution_id);
      } else {
        setStatus('FAILED');
        setError({ error: result.error, cause: result.cause });
      }
    } catch (err) {
      setStatus('FAILED');
      setError({ error: 'NetworkError', cause: err.message });
    } finally {
      setLoading(false);
    }
  }, [processResult]);

  // Submit callback data and auto-resume
  const submit = useCallback(async (cbId, data) => {
    setLoading(true);
    setStatus('RUNNING');
    setCallbackId(null);
    setInputRequest(null);

    try {
      const res = await fetch(`/api/callbacks/${cbId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true, data }),
      });
      const result = await res.json();

      if (res.ok) {
        await processResult(result, executionId);
      } else {
        // Validation error — go back to input
        if (res.status === 400) {
          setStatus('WAITING_FOR_INPUT');
          setCallbackId(cbId);
          setError({ error: 'ValidationError', cause: result.error });
        } else {
          setStatus('FAILED');
          setError({ error: result.error, cause: result.cause });
        }
      }
    } catch (err) {
      setStatus('FAILED');
      setError({ error: 'NetworkError', cause: err.message });
    } finally {
      setLoading(false);
    }
  }, [executionId, processResult]);

  // Recover state from an existing execution (e.g., page refresh)
  const recover = useCallback(async (execId) => {
    setLoading(true);
    setExecutionId(execId);

    try {
      const res = await fetch(`/api/executions/${execId}`);
      const data = await res.json();

      if (data.status === 'WAITING_FOR_CALLBACK' && data.callback_id) {
        setStatus('WAITING_FOR_INPUT');
        setCallbackId(data.callback_id);
        setInputRequest(data.input_request);
      } else if (data.status === 'SUCCEEDED') {
        setStatus('SUCCEEDED');
        setOutput(data.output);
      } else if (data.status === 'FAILED') {
        setStatus('FAILED');
        setError(data.error);
      } else {
        setStatus('RUNNING');
      }

      // Fetch events
      try {
        const evRes = await fetch(`/api/executions/${execId}/events`);
        const evData = await evRes.json();
        setEvents(evData.events || []);
      } catch {
        // non-critical
      }
    } catch (err) {
      setStatus('FAILED');
      setError({ error: 'NetworkError', cause: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  return {
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
  };
}
