import React, { useState, useEffect } from 'react';

const SP_API_FIELDS = [
  { key: 'SP_API_CLIENT_ID', label: 'Client ID', type: 'text' },
  { key: 'SP_API_CLIENT_SECRET', label: 'Client Secret', type: 'password' },
  { key: 'SP_API_REFRESH_TOKEN', label: 'Refresh Token', type: 'password' },
  { key: 'SP_API_REGION', label: 'Region', type: 'select', options: ['na', 'eu', 'fe'] },
  { key: 'SP_API_BASE_URL', label: 'API Base URL', type: 'text', hint: 'Optional custom endpoint for mock testing' },
  { key: 'SP_API_OAUTH_URL', label: 'OAuth URL', type: 'text', hint: 'Optional custom token endpoint for mock testing' },
];

const BEDROCK_FIELDS = [
  { key: 'CLAUDE_CODE_USE_BEDROCK', label: 'Use Bedrock', type: 'select', options: [{ value: '1', label: 'Yes' }, { value: '', label: 'No' }] },
  { key: 'AWS_REGION', label: 'AWS Region', type: 'text', hint: 'e.g. us-east-1' },
  { key: 'AWS_BEARER_TOKEN_BEDROCK', label: 'Bearer Token', type: 'password' },
  { key: 'AWS_ACCESS_KEY_ID', label: 'Access Key ID', type: 'text' },
  { key: 'AWS_SECRET_ACCESS_KEY', label: 'Secret Access Key', type: 'password' },
  { key: 'AWS_SESSION_TOKEN', label: 'Session Token', type: 'password' },
  { key: 'AWS_PROFILE', label: 'AWS Profile', type: 'text' },
];

const AUTH_FIELDS = [
  { key: 'WEB_USERNAME', label: 'Username', type: 'text', hint: 'Leave both blank to disable auth' },
  { key: 'WEB_PASSWORD', label: 'Password', type: 'password' },
];

const MODEL_FIELDS = [
  { key: 'ANTHROPIC_DEFAULT_SONNET_MODEL', label: 'Sonnet Model', type: 'text', hint: 'Optional override' },
  { key: 'ANTHROPIC_DEFAULT_HAIKU_MODEL', label: 'Haiku Model', type: 'text', hint: 'Optional override' },
  { key: 'ANTHROPIC_DEFAULT_OPUS_MODEL', label: 'Opus Model', type: 'text', hint: 'Optional override' },
];

export default function Settings() {
  const [config, setConfig] = useState(null);
  const [secretKeys, setSecretKeys] = useState([]);
  const [mcpText, setMcpText] = useState('');
  const [mcpError, setMcpError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [visibleSecrets, setVisibleSecrets] = useState(new Set());

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setConfig(data.config || {});
        setSecretKeys(data.secretKeys || []);
        setMcpText(JSON.stringify(data.config?.AGENT_MCP_SERVERS || {}, null, 2));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(key, value) {
    setConfig(prev => ({ ...prev, [key]: value }));
    setSuccess(null);
  }

  function handleMcpChange(text) {
    setMcpText(text);
    setMcpError(null);
    setSuccess(null);
    try {
      const parsed = JSON.parse(text);
      setConfig(prev => ({ ...prev, AGENT_MCP_SERVERS: parsed }));
    } catch {
      setMcpError('Invalid JSON');
    }
  }

  // Track which secrets have been revealed (have real values loaded)
  const [revealedSecrets, setRevealedSecrets] = useState({});

  async function toggleSecret(key) {
    if (visibleSecrets.has(key)) {
      // Hide
      setVisibleSecrets(prev => { const next = new Set(prev); next.delete(key); return next; });
      return;
    }

    // Show — fetch real value if we haven't edited this field
    const currentVal = config[key] || '';
    const isMaskedVal = /.\*{4,}$/.test(currentVal);
    if (isMaskedVal && !revealedSecrets[key]) {
      try {
        const res = await fetch(`/api/settings/reveal/${key}`);
        if (res.ok) {
          const { value } = await res.json();
          setRevealedSecrets(prev => ({ ...prev, [key]: true }));
          setConfig(prev => ({ ...prev, [key]: value }));
        }
      } catch { /* ignore */ }
    }

    setVisibleSecrets(prev => { const next = new Set(prev); next.add(key); return next; });
  }

  async function handleSave() {
    if (mcpError) {
      setError('Fix MCP Servers JSON before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save settings');
      } else {
        let msg = 'Settings saved successfully.';
        if (data.restartRequired) {
          msg += ' MCP server changes require a server restart to take effect.';
        }
        setSuccess(msg);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function renderField({ key, label, type, hint, options }) {
    const value = config[key] || '';
    const isSecret = secretKeys.includes(key);
    const isVisible = visibleSecrets.has(key);

    return (
      <div key={key} className="settings-field">
        <label htmlFor={`setting-${key}`}>{label}</label>
        {hint && <span className="field-hint">{hint}</span>}

        {type === 'select' ? (
          <select
            id={`setting-${key}`}
            value={value}
            onChange={e => handleChange(key, e.target.value)}
          >
            {(options || []).map(opt => {
              const optVal = typeof opt === 'string' ? opt : opt.value;
              const optLabel = typeof opt === 'string' ? opt : opt.label;
              return <option key={optVal} value={optVal}>{optLabel}</option>;
            })}
          </select>
        ) : type === 'password' ? (
          <div className="password-wrapper">
            <input
              id={`setting-${key}`}
              type={isVisible ? 'text' : 'password'}
              value={value}
              onChange={e => handleChange(key, e.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => toggleSecret(key)}
            >
              {isVisible ? 'Hide' : 'Show'}
            </button>
          </div>
        ) : (
          <input
            id={`setting-${key}`}
            type="text"
            value={value}
            onChange={e => handleChange(key, e.target.value)}
          />
        )}
      </div>
    );
  }

  if (loading) return <div className="loading">Loading settings...</div>;

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="settings-sections">
        <section className="settings-section">
          <h2>Web Authentication</h2>
          {AUTH_FIELDS.map(renderField)}
        </section>

        <section className="settings-section">
          <h2>SP-API Configuration</h2>
          {SP_API_FIELDS.map(renderField)}
        </section>

        <section className="settings-section">
          <h2>AWS / Bedrock</h2>
          {BEDROCK_FIELDS.map(renderField)}
          <div className="settings-subsection-label">Model Overrides</div>
          {MODEL_FIELDS.map(renderField)}
        </section>

        <section className="settings-section">
          <h2>MCP Servers</h2>
          <div className="settings-notice">
            Changes to MCP server configuration require a server restart to take effect.
          </div>
          <div className="settings-field">
            <label htmlFor="setting-mcp">AGENT_MCP_SERVERS</label>
            <textarea
              id="setting-mcp"
              className="settings-mcp-textarea"
              value={mcpText}
              onChange={e => handleMcpChange(e.target.value)}
              spellCheck={false}
            />
            {mcpError && <span className="field-error">{mcpError}</span>}
          </div>
        </section>
      </div>
    </div>
  );
}
