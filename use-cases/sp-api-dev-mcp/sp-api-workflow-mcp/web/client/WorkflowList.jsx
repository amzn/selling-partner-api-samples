import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MermaidThumbnail from './MermaidThumbnail.jsx';

export default function WorkflowList() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null); // null | 'create' | 'import'
  const [newName, setNewName] = useState('');
  const [importFile, setImportFile] = useState(null); // { schema, fileName }
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/workflows')
      .then(r => r.json())
      .then(data => setWorkflows(data.workflows || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setDialog('create');
    setNewName('');
  }

  function openImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const schema = JSON.parse(text);
        const defaultName = schema.Comment || file.name.replace('.json', '');
        setImportFile({ schema, fileName: file.name });
        setNewName(defaultName);
        setDialog('import');
      } catch (err) {
        setError('Invalid JSON file: ' + err.message);
      }
    };
    input.click();
  }

  function closeDialog() {
    setDialog(null);
    setNewName('');
    setImportFile(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!newName.trim() || submitting) return;
    setSubmitting(true);
    try {
      if (dialog === 'create') {
        const res = await fetch('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName.trim() }),
        });
        const result = await res.json();
        if (res.ok) {
          navigate(`/workflows/${result.workflow_id}`);
        } else {
          setError(result.error);
        }
      } else if (dialog === 'import' && importFile) {
        const res = await fetch('/api/workflows/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName.trim(), schema: importFile.schema }),
        });
        const result = await res.json();
        if (result.success) {
          navigate(`/workflows/${result.workflow_id}`);
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(e, wf) {
    e.stopPropagation();
    if (!confirm(`Delete "${wf.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/workflows/${wf.workflow_id}`, { method: 'DELETE' });
      if (res.ok) {
        setWorkflows(prev => prev.filter(w => w.workflow_id !== wf.workflow_id));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to delete workflow');
      }
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="loading">Loading workflows...</div>;

  return (
    <div className="wf-list">
      <div className="wf-list-header">
        <h1>Workflows</h1>
        <div className="wf-list-actions">
          <button className="btn btn-secondary" onClick={openImport}>Import JSON</button>
          <button className="btn btn-primary" onClick={openCreate}>Create New</button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {dialog && (
        <form className="wf-create-form" onSubmit={handleSubmit}>
          <div className="wf-create-form-inner">
            <label className="wf-create-label">
              {dialog === 'create' ? 'New Workflow' : `Import: ${importFile?.fileName}`}
            </label>
            <input
              type="text"
              className="wf-create-input"
              placeholder="Enter workflow name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary btn-small" disabled={!newName.trim() || submitting}>
            {submitting ? (dialog === 'create' ? 'Creating...' : 'Importing...') : (dialog === 'create' ? 'Create' : 'Import')}
          </button>
          <button type="button" className="btn btn-secondary btn-small" onClick={closeDialog}>
            Cancel
          </button>
        </form>
      )}

      {workflows.length === 0 ? (
        <div className="wf-list-empty">
          <div className="wf-list-empty-icon">&#x2750;</div>
          <p>No workflows yet. Create one or import a JSON file to get started.</p>
        </div>
      ) : (
        <div className="workflow-grid">
          {workflows.map(wf => (
            <div
              key={wf.workflow_id}
              className="workflow-card"
              onClick={() => navigate(`/workflows/${wf.workflow_id}`)}
            >
              {wf.state_count > 0 && <MermaidThumbnail workflowId={wf.workflow_id} />}
              <h2>{wf.name}</h2>
              {wf.description && <p>{wf.description}</p>}
              <div className="wf-card-footer">
                <span className="badge">{wf.state_count} states</span>
                <div className="wf-card-footer-right">
                  {wf.updated_at && (
                    <span className="wf-card-time">{formatTime(wf.updated_at)}</span>
                  )}
                  <button
                    className="wf-card-delete"
                    title="Delete workflow"
                    onClick={(e) => handleDelete(e, wf)}
                  >
                    &times;
                  </button>
                </div>
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
