# Workflow Web UI

A browser-based interface for building, visualizing, and executing SP-API workflows. Chat with a Claude agent to construct workflows via natural language, view live Mermaid diagrams, and run workflows with human-in-the-loop input collection.

## Quick Start

### Prerequisites

- Node.js 18+
- Amazon Bedrock access (for the agent chat feature)

### Automated Setup

The setup script clones dependencies (sp-api-mcp-server, sp-api-models), builds everything, and generates `.env.json`:

```bash
cd web
npm run setup
```

It will prompt for any missing credentials. You can skip and fill them in later via the Settings UI.

### Manual Setup

```bash
# Install dependencies
cd Sp-api-workflow-mcp && npm install
cd web && npm install

# Build frontend
npm run build

# Start (single server)
npm start
```

Open http://localhost:3001.

### Development Mode

For frontend development with hot-reload:

```bash
npm run dev
```

This starts the Express backend on `:3001` and Vite on `:5173`. Open http://localhost:5173 (Vite proxies API requests to the backend).

### Configuration

On first launch, go to **Settings** and configure:

1. **Web Authentication** — Username and password (optional — leave blank to disable)
2. **SP-API credentials** — Client ID, Secret, Refresh Token, Region
3. **Bedrock credentials** — AWS Region, Bearer Token or IAM credentials
4. **MCP servers** — Paths to the workflow-mcp and sp-api-mcp server entry points

Alternatively, create a `web/.env.json` file:

```json
{
  "WEB_USERNAME": "admin",
  "WEB_PASSWORD": "your-password",
  "SP_API_CLIENT_ID": "amzn1.application-oa2-client.xxx",
  "SP_API_CLIENT_SECRET": "your-secret",
  "SP_API_REFRESH_TOKEN": "Atzr|xxx",
  "SP_API_REGION": "na",
  "CLAUDE_CODE_USE_BEDROCK": "1",
  "AWS_REGION": "us-east-1",
  "AWS_BEARER_TOKEN_BEDROCK": "your-token",
  "AGENT_MCP_SERVERS": {
    "workflow": { "command": "node", "args": ["../index.js"] },
    "amazon-sp-api": { "command": "node", "args": ["/path/to/sp-api-mcp-server/build/index.js"] }
  }
}
```

> **Note:** `web/.env.json` is gitignored and should never be committed.

### Authentication

When `WEB_USERNAME` and `WEB_PASSWORD` are set (via `.env.json` or the Settings page), the app shows a login page. Static assets (HTML/JS/CSS) are served without auth so the login page can load; only `/api/*` routes require credentials. When both fields are blank, auth is disabled. Changes take effect immediately — no restart required.

### Deployment

To deploy to a remote server (e.g. EC2):

```bash
# Transfer project files (respects .gitignore)
git ls-files --cached --others --exclude-standard | \
  rsync -avz --files-from=- . user@host:~/Sp-api-workflow-mcp/

# On the remote server
cd ~/Sp-api-workflow-mcp/web
npm run setup          # or manual: npm install && npm run build
npm start              # or use pm2: pm2 start server/app.js --name app
```

Set `PORT=80` to serve on port 80 (may require `sudo setcap 'cap_net_bind_service=+ep' $(which node)` on Linux).

## Features

### Agent Chat

Chat with a Claude agent to build workflows conversationally. The agent has access to the Workflow MCP tools (create workflow, add states, connect states, etc.) and the SP-API MCP for endpoint discovery.

- Type natural language requests in the chat panel
- Watch the Mermaid diagram and schema update in real-time as the agent makes changes
- Tool calls appear as badges in the chat (with status indicators)
- Chat sessions are persisted per workflow and survive server restarts

### Workflow Visualization

The right panel shows a tabbed view:

- **Diagram** — Interactive Mermaid diagram with pan and zoom
- **Schema** — Raw ASL JSON
- **Execute** — Launch and monitor workflow execution

### Workflow Execution

Run workflows directly from the browser:

- Start execution with JSON input
- Progress bar tracks state transitions in real-time
- Event timeline and API call details in the sidebar

### Human-in-the-Loop Inputs

When a workflow hits an `Input` state, the UI renders the appropriate input component. Supported input types:

| Type | Component | Description |
|------|-----------|-------------|
| `text` | TextInput | Single-line or multi-line text |
| `number` | NumberInput | Numeric with min/max validation |
| `boolean` | BooleanInput | Toggle true/false |
| `date` | DateInput | Date picker |
| `single_select` | SingleSelectInput | Radio button selection |
| `multi_select` | MultiSelectInput | Checkbox selection |
| `confirm` | ConfirmInput | Yes/No confirmation dialog |
| `form` | FormInput | Multi-field dynamic form |
| `table` | TableInput | Selectable table rows |
| `json` | JSONInput | Raw JSON editor |

After the user submits input, execution resumes automatically.

## Architecture

```
                Express Server (:3001)
Browser        ┌────────────────────────┐
┌──────────┐   │  Static (dist/)        │
│ React    │──▶│  Login page (no auth)  │
│ SPA      │   │                        │
│ - Chat   │   │  /api/* (auth)         │
│ - Diagram│   │  ├── /auth/check       │
│ - Player │   │  ├── /auth/login       │
│ - Settings   │  ├── /workflows        │
└──────────┘   │  ├── /executions       │
               │  ├── /callbacks        │
               │  ├── /agent/chat (SSE) │
               │  └── /settings         │
               │                        │
               │  Agent Service         │
               │  └── Claude Agent SDK  │
               │      ├── workflow-mcp  │
               │      └── sp-api-mcp    │
               │                        │
               │  Shared Stores         │
               │  └── ../.data/         │
               └────────────────────────┘
```

- **Single server** — Express serves both the built React frontend and the API on one port. In development, Vite provides hot-reload on a separate port with API proxy.
- **Frontend** — React 19 + Vite, with `react-router-dom` for routing and `mermaid` for diagram rendering. Login page gates the app when auth is enabled.
- **Backend** — Express server that imports the core workflow modules (WorkflowStore, WorkflowExecutor, CallbackHandler) as libraries
- **Agent** — Claude Agent SDK connects to MCP servers as subprocesses, streams responses via SSE
- **Persistence** — Workflow, execution, and callback data stored in `../.data/` (shared with the MCP server). Chat sessions stored in `web/data/sessions/`

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run setup` | `node setup.js` | Automated quickstart — clone deps, build, configure |
| `npm run dev` | `node server/app.js & npx vite` | Development with hot-reload (backend :3001, frontend :5173) |
| `npm run dev:server` | `node server/app.js` | Start backend only |
| `npm run dev:client` | `npx vite --port 5173` | Start frontend only (proxies API to :3001) |
| `npm run build` | `npx vite build` | Build frontend for production |
| `npm start` | `node server/app.js` | Production server (serves built frontend + API) |

## Project Structure

```
web/
├── setup.js                      # Quickstart setup script
├── client/                       # React frontend
│   ├── main.jsx                  # Entry point
│   ├── App.jsx                   # Router + auth gating
│   ├── Login.jsx                 # Login page
│   ├── styles.css                # All styles
│   ├── WorkflowList.jsx          # Landing page — workflow grid
│   ├── WorkflowContext.jsx       # Main editor — chat + diagram + execute
│   ├── WorkflowPlayer.jsx        # Standalone execution player
│   ├── WorkflowDiagram.jsx       # Mermaid renderer with pan/zoom
│   ├── Settings.jsx              # Configuration UI
│   ├── InputRenderer.jsx         # Routes input type to component
│   ├── inputs/                   # Input components (10 types)
│   ├── displays/                 # Terminal screens (Success, Failure)
│   └── hooks/
│       ├── useAgentChat.js       # SSE stream management
│       ├── useWorkflowData.js    # Schema/diagram fetching
│       └── useWorkflowExecution.js  # Execution lifecycle
├── server/
│   ├── app.js                    # Express entry — auth, static, API routes
│   ├── routes/
│   │   ├── workflows.js          # CRUD + diagram + import
│   │   ├── executions.js         # Start, status, events
│   │   ├── callbacks.js          # Submit input + auto-resume
│   │   ├── agent.js              # Chat SSE + session management
│   │   └── settings.js           # Config read/write
│   └── agent/
│       ├── agent-service.js      # Claude Agent SDK integration
│       ├── agent-config.js       # Env/MCP server config loader
│       └── session-store.js      # Chat session persistence
├── data/sessions/                # Persisted chat sessions (gitignored)
├── dist/                         # Built frontend (gitignored)
├── index.html                    # Vite HTML entry
├── vite.config.js                # Vite + API proxy config
└── package.json
```
