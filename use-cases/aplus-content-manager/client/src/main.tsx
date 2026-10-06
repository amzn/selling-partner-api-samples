import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { api } from './api';
import { App } from './App';
import { PreviewPage } from './PreviewPage';
import './styles.css';

/** /preview is the detail-page simulation in its own tab; everything else is the manager UI. */
function Root() {
  const isPreview = window.location.pathname.replace(/\/+$/, '') === '/preview';
  const [config, setConfig] = useState<{ mode: 'live' | 'mock'; accountType?: 'seller' | 'vendor' } | null>(null);
  useEffect(() => {
    if (isPreview)
      api
        .config()
        .then(setConfig)
        .catch(() => setConfig({ mode: 'live' }));
  }, [isPreview]);
  if (!isPreview) return <App />;
  return config ? (
    <PreviewPage mode={config.mode} accountType={config.accountType} />
  ) : (
    <div className="loading">Loading…</div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
