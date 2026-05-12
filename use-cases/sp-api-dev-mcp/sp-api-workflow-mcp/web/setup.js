#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = __dirname;
const PROJECT_ROOT = resolve(WEB_ROOT, '..');
const DEPS_DIR = resolve(PROJECT_ROOT, '..'); // sibling directory for cloned repos
const ENV_PATH = join(WEB_ROOT, '.env.json');

const REPOS = {
  'selling-partner-api-samples': {
    url: 'https://github.com/amzn/selling-partner-api-samples.git',
    subdir: 'use-cases/sp-api-mcp-server',
    needsBuild: true,
  },
  'selling-partner-api-models': {
    url: 'https://github.com/amzn/selling-partner-api-models.git',
    subdir: null,
    needsBuild: false,
  },
};

function run(cmd, cwd) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(question, ans => { rl.close(); r(ans.trim()); }));
}

function header(msg) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${msg}`);
  console.log('='.repeat(60));
}

// ── Step 1: Clone or pull GitHub dependencies ──────────────────────────

async function setupRepos() {
  header('Step 1: Clone / pull GitHub dependencies');

  const paths = {};

  for (const [name, repo] of Object.entries(REPOS)) {
    const repoDir = join(DEPS_DIR, name);
    paths[name] = repoDir;

    if (existsSync(join(repoDir, '.git'))) {
      console.log(`\n[${name}] Already cloned at ${repoDir} — pulling latest...`);
      run('git pull --ff-only', repoDir);
    } else {
      console.log(`\n[${name}] Cloning into ${repoDir}...`);
      run(`git clone ${repo.url} "${repoDir}"`);
    }
  }

  return paths;
}

// ── Step 2: Build sp-api-mcp-server ────────────────────────────────────

function buildSpApiMcp(repoPaths) {
  header('Step 2: Build sp-api-mcp-server');

  const mcpDir = join(repoPaths['selling-partner-api-samples'], REPOS['selling-partner-api-samples'].subdir);
  console.log(`\nInstalling dependencies in ${mcpDir}...`);
  run('npm install', mcpDir);

  console.log('\nBuilding TypeScript...');
  run('npm run build', mcpDir);

  const buildEntry = join(mcpDir, 'build', 'index.js');
  if (!existsSync(buildEntry)) {
    throw new Error(`Build failed — expected ${buildEntry} to exist`);
  }
  console.log(`\nBuild output verified: ${buildEntry}`);
  return buildEntry;
}

// ── Step 3: Install workflow-mcp (root) ────────────────────────────────

function installWorkflowMcp() {
  header('Step 3: Install workflow-mcp (root)');
  run('npm install', PROJECT_ROOT);
}

// ── Step 4: Install web dependencies ───────────────────────────────────

function installWeb() {
  header('Step 4: Install web UI dependencies');
  run('npm install', WEB_ROOT);
}

// ── Step 5: Build web frontend ─────────────────────────────────────────

function buildWeb() {
  header('Step 5: Build web frontend');
  run('npx vite build', WEB_ROOT);
}

// ── Step 6: Generate / update .env.json ────────────────────────────────

async function updateEnvJson(spApiMcpEntry, repoPaths) {
  header('Step 6: Configure .env.json');

  const modelsPath = join(repoPaths['selling-partner-api-models'], 'models');

  let existing = {};
  if (existsSync(ENV_PATH)) {
    try {
      existing = JSON.parse(readFileSync(ENV_PATH, 'utf8'));
      console.log('\nExisting .env.json found — merging with updated paths.');
    } catch {
      console.log('\nExisting .env.json is invalid — creating fresh.');
    }
  }

  const merged = {
    SP_API_CLIENT_ID: existing.SP_API_CLIENT_ID || '',
    SP_API_CLIENT_SECRET: existing.SP_API_CLIENT_SECRET || '',
    SP_API_REFRESH_TOKEN: existing.SP_API_REFRESH_TOKEN || '',
    SP_API_REGION: existing.SP_API_REGION || 'na',

    CLAUDE_CODE_USE_BEDROCK: existing.CLAUDE_CODE_USE_BEDROCK || '1',
    AWS_REGION: existing.AWS_REGION || 'us-east-1',
    AWS_BEARER_TOKEN_BEDROCK: existing.AWS_BEARER_TOKEN_BEDROCK || '',

    AGENT_MCP_SERVERS: {
      workflow: {
        command: 'node',
        args: ['../index.js'],
      },
      'amazon-sp-api': {
        command: 'node',
        args: [spApiMcpEntry],
        env: {
          CATALOG_PATH: modelsPath,
        },
      },
    },

    WEB_USERNAME: existing.WEB_USERNAME || 'admin',
    WEB_PASSWORD: existing.WEB_PASSWORD || 'admin123',
  };

  // Prompt for missing credentials
  const credFields = [
    ['SP_API_CLIENT_ID', 'SP-API Client ID'],
    ['SP_API_CLIENT_SECRET', 'SP-API Client Secret'],
    ['SP_API_REFRESH_TOKEN', 'SP-API Refresh Token'],
    ['AWS_BEARER_TOKEN_BEDROCK', 'AWS Bedrock Bearer Token'],
  ];

  const hasMissing = credFields.some(([key]) => !merged[key]);
  if (hasMissing) {
    console.log('\nSome credentials are missing. Enter them now or press Enter to skip.');
    console.log('(You can fill them in later via the Settings UI or by editing web/.env.json)\n');
    for (const [key, label] of credFields) {
      if (!merged[key]) {
        const value = await ask(`  ${label}: `);
        if (value) merged[key] = value;
      }
    }
  }

  writeFileSync(ENV_PATH, JSON.stringify(merged, null, 2) + '\n');
  console.log(`\nWrote ${ENV_PATH}`);

  const warnings = [];
  if (!merged.SP_API_CLIENT_ID) warnings.push('SP_API_CLIENT_ID');
  if (!merged.SP_API_CLIENT_SECRET) warnings.push('SP_API_CLIENT_SECRET');
  if (!merged.SP_API_REFRESH_TOKEN) warnings.push('SP_API_REFRESH_TOKEN');
  if (!merged.AWS_BEARER_TOKEN_BEDROCK) warnings.push('AWS_BEARER_TOKEN_BEDROCK');

  if (warnings.length > 0) {
    console.log(`\n  ⚠  Still missing: ${warnings.join(', ')}`);
    console.log('     Fill these in via Settings UI or edit web/.env.json directly.');
  }
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log('\n  SP-API Workflow MCP — Quickstart Setup\n');
  console.log(`  Project root:  ${PROJECT_ROOT}`);
  console.log(`  Dependencies:  ${DEPS_DIR}`);
  console.log(`  Web root:      ${WEB_ROOT}`);

  const repoPaths = await setupRepos();
  const spApiMcpEntry = buildSpApiMcp(repoPaths);
  installWorkflowMcp();
  installWeb();
  buildWeb();
  await updateEnvJson(spApiMcpEntry, repoPaths);

  header('Setup complete!');
  console.log(`
  To start in development mode:
    cd web && npm run dev

  To start in production mode:
    cd web && npm start

  Open http://localhost:5173 (dev) or http://localhost:3001 (prod)
`);
}

main().catch(err => {
  console.error('\nSetup failed:', err.message);
  process.exit(1);
});
