import React, { useState, useEffect, useCallback, useRef } from 'react';

export default function ChatSessionDropdown({ workflowId, currentSessionId, onSelectSession, onNewChat }) {
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchSessions = useCallback(async () => {
    if (!workflowId) return;
    try {
      const res = await fetch(`/api/agent/sessions/by-workflow/${workflowId}`);
      if (res.ok) setSessions(await res.json());
    } catch { /* ignore */ }
  }, [workflowId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, currentSessionId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const handleSelect = (id) => {
    onSelectSession(id);
    setOpen(false);
  };

  const handleNew = () => {
    onNewChat();
    setOpen(false);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await fetch(`/api/agent/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (id === currentSessionId) onNewChat();
    } catch { /* ignore */ }
  };

  return (
    <div className="cs-dropdown" ref={dropdownRef}>
      <button className="cs-dropdown-trigger" onClick={() => setOpen(!open)}>
        <span className="cs-dropdown-label">
          {currentSession ? currentSession.title : 'New Chat'}
        </span>
        <span className="cs-dropdown-arrow">{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div className="cs-dropdown-menu">
          <button className="cs-dropdown-new" onClick={handleNew}>
            + New Chat
          </button>
          {sessions.length === 0 && (
            <div className="cs-dropdown-empty">No previous sessions</div>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              className={`cs-dropdown-item ${s.id === currentSessionId ? 'cs-dropdown-item-active' : ''}`}
              onClick={() => handleSelect(s.id)}
            >
              <div className="cs-dropdown-item-title">{s.title}</div>
              <div className="cs-dropdown-item-meta">
                <span>{s.messageCount} msgs</span>
                <span>{formatTime(s.updatedAt)}</span>
                <button
                  className="cs-dropdown-item-delete"
                  onClick={(e) => handleDelete(e, s.id)}
                  title="Delete"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}
