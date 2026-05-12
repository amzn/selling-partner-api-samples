# SP-API Dev MCP

A consolidated npm package that bundles MCP servers for Amazon Selling Partner API development. Install once, get access to all SP-API developer tools.

## Prerequisites

- **Node.js >= 20** is required.

## Installation

```bash
npm install -g @amazon-sp-api-release/sp-api-dev-mcp
```

Or use directly with `npx` (no install required).

## Included Servers

### sp-api-dev-assistant-mcp-server

Developer assistant with 6 tools for SP-API integration:

| Tool | Description |
|------|-------------|
| `sp_api_reference` | Search official SP-API documentation using natural language |
| `sp_api_explore_catalog` | Browse SP-API endpoint catalog (parameters, schemas, examples) |
| `sp_api_execute` | Execute live SP-API requests with auth and signing |
| `sp_api_generate_code_sample` | Generate code samples (Python, Java, JavaScript, C#, PHP) |
| `sp_api_migration_assistant` | Migrate between API versions (e.g., Orders v0 to v2026-01-01) |
| `sp_api_optimize` | Well-architected review of SP-API integration code |

Most tools work locally with no credentials. SP-API credentials are only needed for `sp_api_execute`.

### sp-api-workflow-mcp-server

Build and execute SP-API workflows using natural language:

| Category | Tools |
|----------|-------|
| **Builder** | `create_workflow`, `import_workflow`, `add_task_state`, `add_fetch_state`, `add_choice_state`, `add_succeed_state`, `add_fail_state`, `add_wait_state`, `add_pass_state`, `add_input_state`, `set_start_state`, `get_workflow_schema`, `validate_workflow`, `list_workflows`, `delete_workflow` |
| **Interpreter** | `execute_workflow`, `get_execution_status`, `list_executions`, `abort_execution`, `get_execution_events`, `resume_execution`, `tail_execution_events` |
| **Callback** | `list_pending_callbacks`, `get_callback_details`, `submit_callback`, `extend_callback_timeout` |

SP-API credentials are required for workflows that make live API calls.

## MCP Client Configuration

### Claude Desktop / Kiro

Add to your MCP config file:

```json
{
  "mcpServers": {
    "sp-api-dev-assistant": {
      "command": "npx",
      "args": ["-y", "@amazon-sp-api-release/sp-api-dev-mcp", "sp-api-dev-assistant-mcp-server"],
      "env": {
        "SP_API_CLIENT_ID": "your-client-id",
        "SP_API_CLIENT_SECRET": "your-client-secret",
        "SP_API_REFRESH_TOKEN": "your-refresh-token"
      }
    },
    "sp-api-workflow": {
      "command": "npx",
      "args": ["-y", "@amazon-sp-api-release/sp-api-dev-mcp", "sp-api-workflow-mcp-server"],
      "env": {
        "SP_API_CLIENT_ID": "your-client-id",
        "SP_API_CLIENT_SECRET": "your-client-secret",
        "SP_API_REFRESH_TOKEN": "your-refresh-token"
      }
    }
  }
}
```

### Config file locations

| Client | Config file |
|--------|-------------|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Linux) | `~/.config/Claude/claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` in your project or `~/.cursor/mcp.json` globally |
| VS Code (MCP extension) | `.vscode/mcp.json` in your project |
| Kiro | `.kiro/settings/mcp.json` in your project |

## Environment Variables

| Variable | Required For | Description |
|----------|-------------|-------------|
| `SP_API_CLIENT_ID` | `sp_api_execute`, workflow execution | SP-API OAuth client ID |
| `SP_API_CLIENT_SECRET` | `sp_api_execute`, workflow execution | SP-API OAuth client secret |
| `SP_API_REFRESH_TOKEN` | `sp_api_execute`, workflow execution | SP-API refresh token |
| `SP_API_BASE_URL` | Optional | Override SP-API base URL (default: NA endpoint) |
| `SP_API_REGION` | Optional | Selling region: `na`, `eu`, `fe` (default: `na`) |
| `LOG_LEVEL` | Optional | Logging level: `error`, `warn`, `info`, `debug` |

## License

Apache-2.0
