import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for managing a conversational agent chat session.
 * Consumes SSE events from POST /api/agent/chat.
 *
 * @param {string} workflowId - The workflow this chat session is scoped to.
 *   Included in the POST body so the backend persists the association.
 * @param {object} [options]
 * @param {function} [options.onToolResult] - Called on tool_result and result SSE events
 *   so the parent can refresh workflow data via useWorkflowData.
 */
export default function useAgentChat(workflowId, options = {}) {
  const { onToolResult } = options;
  const onToolResultRef = useRef(onToolResult);
  onToolResultRef.current = onToolResult;

  const workflowIdRef = useRef(workflowId);
  workflowIdRef.current = workflowId;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, _setSessionId] = useState(null);
  const sessionIdRef = useRef(null);
  const setSessionId = (id) => { sessionIdRef.current = id; _setSessionId(id); };
  const [error, setError] = useState(null);
  const [model, setModel] = useState(null);
  useEffect(() => {
    fetch('/api/agent/model')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.model) setModel(data.model); })
      .catch(() => {});
  }, []);
  const [activeWorkflowId, setActiveWorkflowId] = useState(null);
  const [latestMermaid, setLatestMermaid] = useState(null);
  const [latestSchema, setLatestSchema] = useState(null);
  const abortRef = useRef(null);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;

    setLoading(true);
    setError(null);

    // Append user message
    const userMsg = { role: 'user', content: text };
    const assistantMsg = { role: 'assistant', content: '', toolCalls: [] };
    setMessages(prev => [...prev, userMsg, assistantMsg]);

    // Track the assistant message we're building
    const assistantRef = { content: '', toolCalls: [] };

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body = {
        message: text,
        sessionId: sessionIdRef.current,
        workflowId: workflowIdRef.current,
      };

      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const events = [];
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const event = parseSSE(raw);
          if (event) events.push(event);
        }

        for (const event of events) {
          switch (event.type) {
            case 'session':
              setSessionId(event.data.sessionId);
              break;

            case 'text':
              assistantRef.content += event.data.content;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = {
                  ...next[next.length - 1],
                  content: assistantRef.content,
                };
                return next;
              });
              break;

            case 'tool_use':
              assistantRef.toolCalls.push({
                type: 'tool_use',
                tool: event.data.tool,
                input: event.data.input,
              });
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = {
                  ...next[next.length - 1],
                  toolCalls: [...assistantRef.toolCalls],
                };
                return next;
              });
              break;

            case 'tool_result': {
              assistantRef.toolCalls.push({
                type: 'tool_result',
                tool: event.data.tool,
                output: event.data.output,
              });
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = {
                  ...next[next.length - 1],
                  toolCalls: [...assistantRef.toolCalls],
                };
                return next;
              });
              // Track the workflow the agent is actually working on
              const wfId = extractWorkflowId(event.data.output);
              if (wfId) setActiveWorkflowId(wfId);
              if (onToolResultRef.current) {
                onToolResultRef.current(event.data);
              }
              break;
            }

            case 'result':
              if (event.data.content) {
                assistantRef.content = event.data.content;
                setMessages(prev => {
                  const next = [...prev];
                  next[next.length - 1] = {
                    ...next[next.length - 1],
                    content: assistantRef.content,
                  };
                  return next;
                });
              }
              if (onToolResultRef.current) {
                onToolResultRef.current(event.data);
              }
              break;

            case 'mermaid':
              setLatestMermaid({ mermaid: event.data.mermaid, stateCount: event.data.stateCount });
              if (event.data.workflowId) setActiveWorkflowId(event.data.workflowId);
              break;

            case 'schema':
              setLatestSchema(event.data.schema);
              if (event.data.workflowId) setActiveWorkflowId(event.data.workflowId);
              break;

            case 'error':
              setError(event.data.message || 'Agent error');
              break;

            case 'done':
              break;
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to connect to agent');
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, []);

  const stopChat = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  const resetChat = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    try {
      await fetch('/api/agent/reset', { method: 'POST' });
    } catch { /* best effort */ }
    setMessages([]);
    setSessionId(null);
    setError(null);
    setLoading(false);
    setActiveWorkflowId(null);
    setLatestMermaid(null);
    setLatestSchema(null);
  }, []);

  const loadSession = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/agent/sessions/${id}`);
      if (!res.ok) throw new Error('Failed to load session');
      const session = await res.json();
      setMessages(session.messages || []);
      setSessionId(session.id);
      setError(null);
      if (session.mermaid) setLatestMermaid({ mermaid: session.mermaid, stateCount: session.stateCount || 0 });
      if (session.schema) setLatestSchema(session.schema);
      if (session.workflowId) setActiveWorkflowId(session.workflowId);
      return session;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  return { messages, loading, sessionId, error, model, activeWorkflowId, latestMermaid, latestSchema, sendMessage, stopChat, resetChat, loadSession };
}

/**
 * Extract workflow_id from a tool result output string.
 * MCP tool results are JSON strings containing workflow_id.
 */
function extractWorkflowId(output) {
  if (!output) return null;
  try {
    const data = typeof output === 'string' ? JSON.parse(output) : output;
    return data.workflow_id || data.workflowId || null;
  } catch {
    // Try regex fallback for unstructured output
    const match = output.match(/wf_[a-f0-9]{12}/);
    return match ? match[0] : null;
  }
}

/**
 * Parse a raw SSE chunk into { type, data }.
 */
function parseSSE(raw) {
  let eventType = 'message';
  let dataStr = '';

  for (const line of raw.split('\n')) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      dataStr += line.slice(6);
    }
  }

  if (!dataStr) return null;

  try {
    return { type: eventType, data: JSON.parse(dataStr) };
  } catch {
    return { type: eventType, data: { raw: dataStr } };
  }
}
