import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useWorkflowData from './hooks/useWorkflowData.js';
import useAgentChat from './hooks/useAgentChat.js';
import WorkflowDiagram from './WorkflowDiagram.jsx';
import ChatSessionDropdown from './ChatSessionDropdown.jsx';

export default function WorkflowContext() {
  const { workflowId } = useParams();
  const navigate = useNavigate();

  const {
    messages, loading: chatLoading, sessionId, error: chatError,
    model, activeWorkflowId, latestMermaid, latestSchema,
    sendMessage, stopChat, resetChat, loadSession,
  } = useAgentChat(workflowId);

  // Follow whichever workflow the agent is actually working on
  const effectiveWorkflowId = activeWorkflowId || workflowId;
  const { workflow, schema: apiSchema, diagram: apiDiagram, loading: wfLoading, error: wfError, refresh } = useWorkflowData(effectiveWorkflowId);

  // Prefer session-tracked data (real-time from agent), fall back to API
  const schema = latestSchema || apiSchema;
  const diagram = latestMermaid
    ? { mermaid: latestMermaid.mermaid, stateCount: latestMermaid.stateCount }
    : apiDiagram;

  // Update URL if the agent created/switched to a different workflow
  useEffect(() => {
    if (activeWorkflowId && activeWorkflowId !== workflowId) {
      navigate(`/workflows/${activeWorkflowId}`, { replace: true });
    }
  }, [activeWorkflowId, workflowId, navigate]);

  const [input, setInput] = useState('');
  const [rightTab, setRightTab] = useState('diagram');
  const bottomRef = useRef(null);
  const [mcpServers, setMcpServers] = useState([]);

  // Load available MCP servers
  useEffect(() => {
    fetch('/api/agent/mcp-servers')
      .then(r => r.ok ? r.json() : [])
      .then(setMcpServers)
      .catch(() => {});
  }, []);

  // Auto-load the most recent session for this workflow on mount
  useEffect(() => {
    if (!workflowId) return;
    fetch(`/api/agent/sessions/by-workflow/${workflowId}`)
      .then(r => r.ok ? r.json() : [])
      .then(sessions => {
        if (sessions.length > 0) {
          loadSession(sessions[0].id);
        }
      })
      .catch(() => {});
  }, [workflowId]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || chatLoading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  const handleSelectSession = async (id) => {
    await loadSession(id);
  };

  const handleNewChat = () => {
    resetChat();
  };

  const handleExecute = () => {
    window.open(`/run/${workflowId}`, '_blank');
  };

  if (wfLoading) return <div className="loading">Loading workflow...</div>;
  if (wfError) return <div className="error">{wfError}</div>;

  return (
    <div className="wf-context">
      {/* Header */}
      <div className="wf-context-header">
        <button className="wf-back-btn" onClick={() => navigate('/')}>&larr;</button>
        <div className="wf-context-title">
          <h1>{workflow?.name || 'Workflow'}</h1>
          {workflow?.description && <p>{workflow.description}</p>}
        </div>
        <div className="wf-context-actions">
          {schema && (
            <span className="badge">{Object.keys(schema.States || {}).length} states</span>
          )}
          <button className="btn btn-primary btn-small" onClick={handleExecute}>
            Execute {'↗'}
          </button>
        </div>
      </div>

      <div className="wf-context-body">
        {/* Left: Chat */}
        <div className="wf-chat-col">
          <div className="wf-chat-header">
            <ChatSessionDropdown
              workflowId={workflowId}
              currentSessionId={sessionId}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
            />
            {mcpServers.length > 0 && (
              <div className="mcp-server-badges">
                {mcpServers.map(s => (
                  <span key={s.name} className="mcp-server-badge" title={s.command}>{s.name}</span>
                ))}
              </div>
            )}
          </div>

          <div className="wf-chat-messages">
            {messages.length === 0 && !chatLoading && (
              <div className="chat-empty">
                <p>Chat with the agent to build and edit this workflow.</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`chat-message chat-message-${msg.role}`}>
                <div className="chat-message-label">{msg.role === 'user' ? 'You' : 'Agent'}</div>
                <div className="chat-message-content">
                  {msg.content && (
                    <div className="chat-message-text">
                      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{msg.content}</Markdown>
                    </div>
                  )}
                  {msg.toolCalls?.length > 0 && (
                    <div className="chat-tool-calls">
                      {collapseToolCalls(msg.toolCalls).map((tool, j) => (
                        <span key={j} className={`chat-tool-badge ${tool.status === 'done' ? 'chat-tool-badge-done' : 'chat-tool-badge-running'}`}>
                          {tool.status === 'done' ? '\u2713' : '\u25B6'} {tool.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {chatLoading && messages.length > 0 && !messages[messages.length - 1]?.content && (
              <div className="chat-typing">
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
              </div>
            )}

            {chatError && <div className="chat-error">{chatError}</div>}
            <div ref={bottomRef} />
          </div>

          <form className="chat-input-area" onSubmit={handleSubmit}>
            <textarea
              className="chat-input"
              placeholder="Ask the agent to build or modify this workflow..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={chatLoading}
              rows={3}
            />
            <div className="chat-input-footer">
              {model && <span className="chat-model-id">{model}</span>}
              {chatLoading ? (
                <button type="button" className="btn-stop chat-send-btn" onClick={stopChat}>Stop</button>
              ) : (
                <button type="submit" className="btn-primary chat-send-btn" disabled={!input.trim()}>Send</button>
              )}
            </div>
          </form>
        </div>

        {/* Right: Visualization */}
        <div className="wf-detail-col">
          <div className="viz-tabs">
            <button
              className={`viz-tab ${rightTab === 'diagram' ? 'viz-tab-active' : ''}`}
              onClick={() => setRightTab('diagram')}
            >
              Diagram
            </button>
            <button
              className={`viz-tab ${rightTab === 'schema' ? 'viz-tab-active' : ''}`}
              onClick={() => setRightTab('schema')}
            >
              Schema
            </button>
            <button
              className="viz-tab-refresh"
              onClick={refresh}
              title="Refresh diagram and schema"
            >
              &#x21bb;
            </button>
          </div>

          <div className="wf-detail-content">
            {rightTab === 'diagram' && (
              diagram && diagram.mermaid ? (
                <WorkflowDiagram mermaid={diagram.mermaid} stateCount={diagram.stateCount} />
              ) : (
                <div className="chat-diagram-empty">
                  <div className="chat-diagram-empty-icon">&#x2750;</div>
                  <p>Diagram will appear as you add states to the workflow.</p>
                </div>
              )
            )}

            {rightTab === 'schema' && (
              schema && schema.States && Object.keys(schema.States).length > 0 ? (
                <div className="schema-view">
                  <div className="schema-header">
                    <span className="schema-name">{workflow?.name}</span>
                    <button
                      className="btn-secondary btn-small"
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(schema, null, 2))}
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="schema-json">{JSON.stringify(schema, null, 2)}</pre>
                </div>
              ) : (
                <div className="chat-diagram-empty">
                  <div className="chat-diagram-empty-icon">{'{}'}</div>
                  <p>Schema will appear as you add states to the workflow.</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const markdownComponents = {
  code({ inline, className, children, ...props }) {
    if (inline) {
      return <code className="md-inline-code" {...props}>{children}</code>;
    }
    return (
      <pre className="md-code-block">
        <code className={className} {...props}>{children}</code>
      </pre>
    );
  },
  a({ href, children }) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
  },
  ul({ children }) { return <ul className="md-list">{children}</ul>; },
  ol({ children }) { return <ol className="md-list">{children}</ol>; },
  table({ children }) {
    const body = React.Children.toArray(children).find(c => c?.type === 'tbody');
    const rowCount = body ? React.Children.count(body.props.children) : 0;
    return (
      <div className="md-table-container">
        {rowCount > 0 && (
          <div className="md-table-info">
            <span>{rowCount} row{rowCount !== 1 ? 's' : ''}</span>
            <span>Scroll to see more &rarr;</span>
          </div>
        )}
        <div className="md-table-wrap">
          <table className="md-table">{children}</table>
        </div>
      </div>
    );
  },
  td({ children }) {
    const text = typeof children === 'string' ? children
      : Array.isArray(children) ? children.map(c => (typeof c === 'string' ? c : '')).join('') : '';
    return <td title={text}>{children}</td>;
  },
};

function formatToolName(name) {
  if (!name) return '';
  const parts = name.split('__');
  return parts[parts.length - 1];
}

/**
 * Collapse paired tool_use/tool_result entries into a single item per tool call.
 * Shows each tool once: 'done' if a matching tool_result exists, 'running' otherwise.
 */
function collapseToolCalls(toolCalls) {
  const tools = [];
  // Count results per tool name to pair with uses in order
  const resultCounts = {};
  for (const tc of toolCalls) {
    if (tc.type === 'tool_result') {
      resultCounts[tc.tool] = (resultCounts[tc.tool] || 0) + 1;
    }
  }

  const usedResults = {};
  for (const tc of toolCalls) {
    if (tc.type === 'tool_use') {
      const name = formatToolName(tc.tool);
      usedResults[tc.tool] = (usedResults[tc.tool] || 0) + 1;
      const done = usedResults[tc.tool] <= (resultCounts[tc.tool] || 0);
      tools.push({ name, status: done ? 'done' : 'running' });
    }
  }

  return tools;
}
