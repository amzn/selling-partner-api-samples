import express from 'express';
import cors from 'cors';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { WorkflowStore } from '../../src/builder/workflow-store.js';
import { WorkflowExecutor } from '../../src/interpreter/executor.js';
import { CallbackHandler } from '../../src/callback/callback-handler.js';

import { createWorkflowRoutes } from './routes/workflows.js';
import { createExecutionRoutes } from './routes/executions.js';
import { createCallbackRoutes } from './routes/callbacks.js';
import { createAgentRoutes } from './routes/agent.js';
import { createSettingsRoutes } from './routes/settings.js';
import { loadAgentConfig, applyEnvVars } from './agent/agent-config.js';
import { AgentService } from './agent/agent-service.js';
import { SessionStore } from './agent/session-store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

// Initialize shared instances — use the same .data/workflows directory as the MCP server
// so the web server sees workflows created/modified by the agent's MCP subprocess.
const PROJECT_ROOT = join(__dirname, '../..');
const workflowStore = new WorkflowStore({ dataDir: join(PROJECT_ROOT, '.data/workflows') });
const callbackHandler = new CallbackHandler();
const executor = new WorkflowExecutor({
  spApiClient: null,
  callbackHandler,
});

// Read SP-API credentials from env vars, falling back to web/.env.json
function loadCredentials() {
  const envCreds = {
    clientId: process.env.SP_API_CLIENT_ID,
    clientSecret: process.env.SP_API_CLIENT_SECRET,
    refreshToken: process.env.SP_API_REFRESH_TOKEN,
    region: process.env.SP_API_REGION || 'na',
    endpoint: process.env.SP_API_BASE_URL,
    tokenEndpoint: process.env.SP_API_OAUTH_URL,
  };
  if (envCreds.clientId && envCreds.clientSecret && envCreds.refreshToken) {
    console.log('[web] Using SP-API credentials from environment');
    return envCreds;
  }

  // Fallback: read from web/.env.json
  const envPath = join(__dirname, '../.env.json');
  if (existsSync(envPath)) {
    try {
      const config = JSON.parse(readFileSync(envPath, 'utf8'));
      if (config.SP_API_CLIENT_ID && config.SP_API_CLIENT_SECRET && config.SP_API_REFRESH_TOKEN) {
        console.log('[web] Using SP-API credentials from .env.json');
        return {
          clientId: config.SP_API_CLIENT_ID,
          clientSecret: config.SP_API_CLIENT_SECRET,
          refreshToken: config.SP_API_REFRESH_TOKEN,
          region: config.SP_API_REGION || 'na',
          endpoint: config.SP_API_BASE_URL,
          tokenEndpoint: config.SP_API_OAUTH_URL,
        };
      }
    } catch (err) {
      console.warn('[web] Failed to read .env.json:', err.message);
    }
  }

  return null;
}

// Load SP-API client if credentials available
async function loadSPAPIClient() {
  const creds = loadCredentials();
  if (creds) {
    try {
      const { createClient } = await import('../../src/sp-api-core/index.js');
      const client = await createClient(creds);
      executor.spApiClient = client;
      console.log('[web] SP-API client initialized');
    } catch (err) {
      console.warn('[web] SP-API client not available:', err.message);
    }
  } else {
    console.log('[web] SP-API credentials not configured — create web/.env.json with SP_API_* keys');
  }
}

// Auto-load workflow JSON files from workflows/ directory on first startup.
// Skips import if the store already has workflows (i.e. .data/workflows/ has data).
function loadWorkflows() {
  // If the store already has persisted workflows, skip importing from workflows/
  if (workflowStore.list().workflows.length > 0) {
    return;
  }

  const workflowsDir = join(__dirname, '../../workflows');
  if (!existsSync(workflowsDir)) {
    return;
  }

  const files = readdirSync(workflowsDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const content = readFileSync(join(workflowsDir, file), 'utf8');
      const schema = JSON.parse(content);
      const name = schema.Comment || file.replace('.json', '');
      const result = workflowStore.importSchema(name, schema);
      console.log(`[web] Loaded workflow: ${name} (${result.workflow_id}, ${result.state_count} states)`);
    } catch (err) {
      console.error(`[web] Failed to load ${file}:`, err.message);
    }
  }
}

// Load agent configuration and apply env vars (Bedrock + SP-API for MCP subprocess)
const agentConfig = loadAgentConfig();
applyEnvVars(agentConfig.envVars);

const sessionStore = new SessionStore();

const agentService = new AgentService({
  mcpServers: agentConfig.mcpServers,
  systemPrompt: agentConfig.systemPrompt,
  allowedTools: agentConfig.allowedTools,
  envVars: agentConfig.envVars,
  sessionStore,
  workflowStore,
});

function getAuthCredentials() {
  const envPath = join(__dirname, '../.env.json');
  try {
    const config = JSON.parse(readFileSync(envPath, 'utf8'));
    return { username: config.WEB_USERNAME, password: config.WEB_PASSWORD };
  } catch { return {}; }
}

function basicAuth(req, res, next) {
  const { username, password } = getAuthCredentials();
  if (!username && !password) return next();

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = Buffer.from(header.slice(6), 'base64').toString();
  const [user, pass] = decoded.split(':');
  if (user === username && pass === password) return next();

  return res.status(401).json({ error: 'Invalid credentials' });
}

// Create Express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Reject malformed URLs (path traversal scans, double-encoded probes)
app.use((req, res, next) => {
  try {
    decodeURIComponent(req.path);
    next();
  } catch {
    res.status(400).end();
  }
});

app.get('/api/auth/check', (req, res) => {
  const { username, password } = getAuthCredentials();
  if (!username && !password) return res.json({ required: false });

  const header = req.headers.authorization;
  if (header && header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString();
    const [user, pass] = decoded.split(':');
    if (user === username && pass === password) {
      return res.json({ required: true, authenticated: true });
    }
  }
  return res.json({ required: true, authenticated: false });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = getAuthCredentials();
  if (!username && !password) return res.json({ ok: true });

  const { username: inputUser, password: inputPass } = req.body || {};
  if (inputUser === username && inputPass === password) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid username or password' });
});

// Serve static frontend before auth so the login page can load
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Auth only protects API routes
app.use('/api', basicAuth);

// API routes
const context = { workflowStore, executor, callbackHandler, agentService, sessionStore, loadWorkflows, loadSPAPIClient };
app.use('/api/workflows', createWorkflowRoutes(context));
app.use('/api/executions', createExecutionRoutes(context));
app.use('/api/callbacks', createCallbackRoutes(context));
app.use('/api/agent', createAgentRoutes(context));
app.use('/api/settings', createSettingsRoutes(context));

// SPA fallback for client-side routes
if (existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

// Start server
async function start() {
  await loadSPAPIClient();
  loadWorkflows();

  app.listen(PORT, () => {
    console.log(`[web] Server running at http://localhost:${PORT}`);
  });
}

start().catch(console.error);
