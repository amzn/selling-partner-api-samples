import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import WorkflowList from './WorkflowList.jsx';
import WorkflowContext from './WorkflowContext.jsx';
import WorkflowPlayer from './WorkflowPlayer.jsx';
import Settings from './Settings.jsx';
import Login from './Login.jsx';

const nativeFetch = window.fetch.bind(window);

function patchFetch(creds) {
  if (!creds) {
    window.fetch = nativeFetch;
    return;
  }
  const authValue = 'Basic ' + btoa(`${creds.username}:${creds.password}`);
  window.fetch = function (url, opts = {}) {
    if (typeof url === 'string' && url.startsWith('/api/')) {
      opts.headers = { ...opts.headers, Authorization: authValue };
    }
    return nativeFetch(url, opts);
  };
}

function readSavedCreds() {
  try {
    const saved = sessionStorage.getItem('auth');
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

const initialCreds = readSavedCreds();
patchFetch(initialCreds);

export default function App() {
  const [authState, setAuthState] = useState('loading');
  const credsRef = useRef(initialCreds);

  const checkAuth = useCallback(async () => {
    try {
      const res = await nativeFetch('/api/auth/check', {
        headers: credsRef.current
          ? { Authorization: 'Basic ' + btoa(`${credsRef.current.username}:${credsRef.current.password}`) }
          : {},
      });
      const data = await res.json();
      if (!data.required || data.authenticated) {
        setAuthState('ok');
      } else {
        setAuthState('login');
      }
    } catch {
      setAuthState('ok');
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  function handleLogin(username, password) {
    const newCreds = { username, password };
    credsRef.current = newCreds;
    sessionStorage.setItem('auth', JSON.stringify(newCreds));
    patchFetch(newCreds);
    setAuthState('ok');
  }

  if (authState === 'loading') {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (authState === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <nav className="app-nav">
          <a href="/">Workflows</a>
          <a href="/settings">Settings</a>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<WorkflowList />} />
          <Route path="/workflows/:workflowId" element={<WorkflowContext />} />
          <Route path="/run/:workflowId" element={<WorkflowPlayer />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
