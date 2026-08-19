import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadAgentConfig, applyEnvVars } from '../agent/agent-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_JSON_PATH = join(__dirname, '../../.env.json');

const SECRET_KEYS = new Set([
  'SP_API_CLIENT_SECRET',
  'SP_API_REFRESH_TOKEN',
  'AWS_BEARER_TOKEN_BEDROCK',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'WEB_PASSWORD',
]);

function maskValue(value) {
  if (!value || typeof value !== 'string') return '';
  if (value.length <= 4) return '****';
  return value.slice(0, 4) + '****';
}

function isMasked(value) {
  return typeof value === 'string' && /.\*{4,}$/.test(value);
}

function readEnvJson() {
  if (!existsSync(ENV_JSON_PATH)) return {};
  try {
    return JSON.parse(readFileSync(ENV_JSON_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export function createSettingsRoutes({ executor, agentService, loadSPAPIClient }) {
  const router = Router();

  // Get current settings with secrets masked
  router.get('/', (req, res) => {
    const raw = readEnvJson();
    const config = {};

    for (const [key, value] of Object.entries(raw)) {
      if (SECRET_KEYS.has(key)) {
        config[key] = maskValue(value);
      } else {
        config[key] = value;
      }
    }

    res.json({
      config,
      secretKeys: [...SECRET_KEYS],
    });
  });

  // Reveal the full value of a single secret key
  router.get('/reveal/:key', (req, res) => {
    const { key } = req.params;
    if (!SECRET_KEYS.has(key)) {
      return res.status(400).json({ error: 'Not a secret key' });
    }
    const raw = readEnvJson();
    res.json({ key, value: raw[key] || '' });
  });

  // Save settings
  router.put('/', async (req, res) => {
    const { config: incoming } = req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'config object is required' });
    }

    // Read current config to preserve unchanged secrets
    const current = readEnvJson();

    // Merge: for masked secret values, keep the original
    const merged = {};
    for (const [key, value] of Object.entries(incoming)) {
      if (SECRET_KEYS.has(key) && isMasked(value)) {
        // Keep original secret
        if (current[key]) merged[key] = current[key];
      } else if (value === '' || value === null || value === undefined) {
        // Skip empty values to keep .env.json clean
      } else {
        merged[key] = value;
      }
    }

    // Validate AGENT_MCP_SERVERS if present
    if (merged.AGENT_MCP_SERVERS && typeof merged.AGENT_MCP_SERVERS === 'string') {
      try {
        merged.AGENT_MCP_SERVERS = JSON.parse(merged.AGENT_MCP_SERVERS);
      } catch {
        return res.status(400).json({ error: 'AGENT_MCP_SERVERS must be valid JSON' });
      }
    }

    // Write to disk
    try {
      writeFileSync(ENV_JSON_PATH, JSON.stringify(merged, null, 2));
    } catch (err) {
      return res.status(500).json({ error: 'Failed to write config: ' + err.message });
    }

    // Check if MCP servers changed
    const mcpChanged = JSON.stringify(merged.AGENT_MCP_SERVERS || {}) !==
                        JSON.stringify(current.AGENT_MCP_SERVERS || {});

    // Apply runtime changes
    try {
      const reloaded = loadAgentConfig();
      applyEnvVars(reloaded.envVars);
      agentService.envVars = reloaded.envVars;
      agentService.mcpServers = reloaded.mcpServers;

      // MCP server changes require a fresh agent session
      if (mcpChanged) {
        agentService.reset();
      }

      // Recreate SP-API client if credentials changed
      const spApiChanged = ['SP_API_CLIENT_ID', 'SP_API_CLIENT_SECRET', 'SP_API_REFRESH_TOKEN', 'SP_API_REGION', 'SP_API_BASE_URL', 'SP_API_OAUTH_URL']
        .some(k => merged[k] && !isMasked(merged[k]) && merged[k] !== current[k]);
      if (spApiChanged) {
        await loadSPAPIClient();
      }
    } catch (err) {
      // Config was saved but runtime apply failed — not fatal
      console.warn('[settings] Runtime apply error:', err.message);
    }

    res.json({
      success: true,
      restartRequired: mcpChanged,
    });
  });

  return router;
}
