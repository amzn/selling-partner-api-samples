# Workflow MCP Server

Build and execute Amazon SP-API workflows using natural language with any MCP-compatible AI assistant. Describe what you want — the AI discovers the right SP-API endpoints, builds the workflow step-by-step, and executes it when you're ready.

> **Recommended:** Use alongside the [SP-API MCP Server](https://github.com/amzn/selling-partner-api-samples/tree/main/use-cases/sp-api-mcp-server), which gives your AI assistant live access to SP-API specs and documentation. Together, they enable accurate workflow building without manual API lookup.

## Quick Start

### Option A: Web UI (Recommended)

The [Web UI](web/) provides a browser-based interface with agent chat, diagram visualization, and workflow execution. The setup script handles cloning dependencies, building, and configuration:

```bash
git clone <repo-url> Sp-api-workflow-mcp
cd Sp-api-workflow-mcp/web
npm run setup    # clones sp-api-mcp, builds everything, prompts for credentials
npm start        # open http://localhost:3001
```

See the [Web UI README](web/README.md) for details on development mode, deployment, and configuration.

### Option B: MCP Client

Use with any MCP-compatible client (Claude Desktop, Cursor, VS Code with MCP extension, Kiro, etc.).

### Prerequisites

- Node.js 18+
- Amazon SP-API credentials (Client ID, Secret, Refresh Token) — only needed for live SP-API calls

### 1. Clone and Install

```bash
git clone <repo-url> Sp-api-workflow-mcp
cd Sp-api-workflow-mcp
npm install
```

To also set up the SP-API MCP Server:
```bash
git clone https://github.com/amzn/selling-partner-api-samples.git
cd selling-partner-api-samples/use-cases/sp-api-mcp-server
npm install && npm run build
```

### 2. Configure Your MCP Client

Add this server to your MCP client's configuration. The MCP server block looks the same across clients:

```json
{
  "mcpServers": {
    "workflow-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/Sp-api-workflow-mcp/index.js"],
      "env": {
        "SP_API_CLIENT_ID": "amzn1.application-oa2-client.xxx",
        "SP_API_CLIENT_SECRET": "your-secret",
        "SP_API_REFRESH_TOKEN": "Atzr|xxx",
        "SP_API_REGION": "na"
      }
    },
    "sp-api-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/selling-partner-api-samples/use-cases/sp-api-mcp-server/index.js"]
    }
  }
}
```

**Config file locations by client:**

| Client | Config file |
|--------|-------------|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Linux) | `~/.config/Claude/claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` in your project or `~/.cursor/mcp.json` globally |
| VS Code (MCP extension) | `.vscode/mcp.json` in your project |
| Kiro | `.kiro/settings/mcp.json` in your project |

### 3. Restart Your MCP Client

### 4. Your First Workflow

Open your AI assistant and try:

```
You: Create a workflow that requests a sales report, polls until it's ready,
     then downloads the document.

AI: I'll build that step by step...
  → create_workflow("DownloadSalesReport")
  → add_task_state("CreateReport",
       POST /reports/2021-06-30/reports,
       body={ reportType: "GET_SALES_AND_TRAFFIC_REPORT", ... },
       result_path="$.report")
  → add_wait_state("WaitForReport", seconds=30)
  → add_task_state("CheckStatus",
       GET /reports/2021-06-30/reports/{reportId},
       path_params={ "reportId.$": "$.report.reportId" },
       result_path="$.reportStatus")
  → add_choice_state("IsReady",
       if $.reportStatus.processingStatus == "DONE" → GetDocument,
       default → WaitForReport)
  → add_task_state("GetDocument",
       GET /reports/2021-06-30/documents/{documentId},
       path_params={ "documentId.$": "$.reportStatus.reportDocumentId" },
       result_path="$.document")
  → add_succeed_state("Done")
  → connect_states(...), validate_workflow()

  Workflow ready — it will poll every 30s until the report is available.
  Want me to execute it?

You: Yes, run it.

AI: execute_workflow(input={ "marketplaceId": "ATVPDKIKX0DER" })
  → CreateReport: reportId=RPT-12345
  → WaitForReport (30s) × 2
  → CheckStatus: processingStatus=DONE
  → GetDocument: download URL retrieved
  → Status: SUCCEEDED — report document URL in $.document.url
```

### Tips for Getting Started

- **Start simple** — single task, single condition. Add complexity after the first run.
- **Review before executing** — ask your AI assistant to `show me the workflow schema` or `explain this workflow` first.
- **Use your AI assistant's expertise** — ask it to "add error handling" or "optimize for parallel execution".
- **Test safely** — run test workflows with known SKUs/orders before live use.

---

## User Guide

### How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   AI Assistant  │────▶│  Workflow MCP    │────▶│    SP-API       │
│                 │     │     Server       │     │                 │
│ - Understands   │     │ - Builds ASL     │     │ - Orders API    │
│   your request  │     │ - Executes       │     │ - Inventory API │
│ - Discovers API │     │ - Tracks state   │     │ - Feeds API     │
│   specs         │     │ - Human approval │     │ - Reports API   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

1. **You describe** what you want in plain English
2. **The AI discovers** the SP-API endpoints needed (via SP-API Discovery MCP)
3. **The AI builds** the workflow using this MCP server's tools
4. **You execute** the workflow and get results

### Building Workflows

#### Create a Workflow

```
You: Create a new workflow called "Order Processing"

AI: create_workflow(name="Order Processing", description="Process incoming orders")
→ Created workflow wf_abc123
```

#### Add SP-API Tasks

The AI uses full endpoint specifications learned from SP-API Discovery:

```
You: Add a step to get order details

AI: add_task_state(
  workflow_id="wf_abc123",
  state_name="GetOrder",
  method="GET",
  path="/orders/v0/orders/{orderId}",
  path_params={ "orderId.$": "$.input.orderId" },
  result_path="$.orderData"
)
```

**Task Parameters:**

| Parameter | Description | Example |
|-----------|-------------|---------|
| `method` | HTTP method | `GET`, `POST`, `PUT`, `DELETE` |
| `path` | API endpoint path | `/orders/v0/orders/{orderId}` |
| `path_params` | URL path variables | `{ "orderId": "123-456" }` |
| `query_params` | Query string params | `{ "MarketplaceIds": ["ATVPDKIKX0DER"] }` |
| `body` | Request body (POST/PUT) | `{ "feedType": "POST_PRODUCT_DATA" }` |
| `result_path` | Where to store result | `$.orderData` |

#### Add Conditional Logic

```
You: If the order total is over $500, require approval

AI: add_choice_state(
  workflow_id="wf_abc123",
  state_name="CheckValue",
  choices=[{
    "variable": "$.orderData.OrderTotal.Amount",
    "comparison": "NumericGreaterThan",
    "value": 500,
    "next": "RequireApproval"
  }],
  default="AutoProcess"
)
```

**Supported Comparisons:**
- `StringEquals`, `StringLessThan`, `StringGreaterThan`
- `NumericEquals`, `NumericLessThan`, `NumericGreaterThan`
- `BooleanEquals`
- `IsNull`, `IsPresent`, `IsString`, `IsNumeric`

#### Add Human Approval

```
You: Add an approval step for high-value orders

AI: add_task_state(
  workflow_id="wf_abc123",
  state_name="RequireApproval",
  resource="callback",
  prompt="High-value order requires approval",
  details={ "orderId.$": "$.input.orderId", "total.$": "$.orderData.OrderTotal" },
  timeout_seconds=3600
)
```

The workflow pauses until someone approves:

```
You: list_pending_callbacks
→ Callback cb_xyz789: "High-value order requires approval"

You: submit_callback(callback_id="cb_xyz789", approved=true, comment="Approved by manager")
→ Workflow resumes
```

#### Connect States

```
You: Connect GetOrder to CheckValue, then to the terminal states

AI:
  connect_states(workflow_id="wf_abc123", from_state="GetOrder", to_state="CheckValue")
  connect_states(workflow_id="wf_abc123", from_state="AutoProcess", to_state="Done")
```

#### View the Workflow

```
You: Show me the workflow schema

AI: get_workflow_schema(workflow_id="wf_abc123")
→ Returns full ASL JSON
```

### Executing Workflows

#### Run a Workflow

```
You: Execute the order processing workflow for order 123-456-789

AI: execute_workflow(
  workflow_id="wf_abc123",
  input={ "orderId": "123-456-789" }
)
→ Execution exec_def456 started
```

#### Check Status

```
You: What's the status of that execution?

AI: get_execution_status(execution_id="exec_def456")
→ Status: SUCCEEDED, Output: { orderData: {...}, result: "processed" }
```

#### View Execution History

```
You: Show me what happened during execution

AI: get_execution_events(execution_id="exec_def456")
→ [StateEntered: GetOrder, StateExited: GetOrder, StateEntered: CheckValue, ...]
```

### JSONPath for Dynamic Data

Use JSONPath to pass data between states:

```javascript
// Reference input data
"orderId.$": "$.input.orderId"

// Reference previous state output
"orderTotal.$": "$.orderData.OrderTotal.Amount"

// Static value (no .$ suffix)
"marketplaceId": "ATVPDKIKX0DER"
```

---

## MCP Tools Reference

### Builder Tools

| Tool | Description |
|------|-------------|
| `create_workflow` | Create a new workflow |
| `add_task_state` | Add SP-API call or callback |
| `add_choice_state` | Add conditional branching |
| `add_pass_state` | Add data transformation |
| `add_wait_state` | Add delay (max 60s) |
| `add_succeed_state` | Add success endpoint |
| `add_fail_state` | Add failure endpoint |
| `connect_states` | Link two states |
| `set_start_state` | Set entry point |
| `remove_state` | Delete a state |
| `get_workflow_schema` | Export ASL JSON |
| `validate_workflow` | Check for errors |
| `list_workflows` | List all workflows |
| `delete_workflow` | Delete a workflow |

### Execution Tools

| Tool | Description |
|------|-------------|
| `execute_workflow` | Run a workflow |
| `get_execution_status` | Check execution state |
| `list_executions` | List all executions |
| `get_execution_events` | Get execution history |
| `abort_execution` | Stop a running execution |

### Callback Tools

| Tool | Description |
|------|-------------|
| `list_pending_callbacks` | List awaiting approvals |
| `get_callback_details` | Get callback info |
| `submit_callback` | Approve or reject |
| `extend_callback_timeout` | Add more time |

---

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SP_API_CLIENT_ID` | SP-API app client ID | For SP-API calls |
| `SP_API_CLIENT_SECRET` | SP-API app secret | For SP-API calls |
| `SP_API_REFRESH_TOKEN` | Seller refresh token | For SP-API calls |
| `SP_API_REGION` | Region: `na`, `eu`, `fe` | No (default: `na`) |
| `SP_API_BASE_URL` | Custom SP-API endpoint URL | No |
| `SP_API_OAUTH_URL` | Custom OAuth token endpoint URL | No |

### Custom API Endpoints

Use `SP_API_BASE_URL` and `SP_API_OAUTH_URL` to redirect SP-API traffic to a custom endpoint — useful for mock servers, local development, or proxying through a corporate gateway.

- **`SP_API_BASE_URL`** overrides the regional SP-API host (default: `https://sellingpartnerapi-na.amazon.com` for `na`). All API requests (orders, reports, inventory, etc.) are sent here instead.
- **`SP_API_OAUTH_URL`** overrides the LWA token endpoint (default: `https://api.amazon.com/auth/o2/token`). Token refresh requests are sent here instead.

```json
{
  "mcpServers": {
    "workflow-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/Sp-api-workflow-mcp/index.js"],
      "env": {
        "SP_API_CLIENT_ID": "amzn1.application-oa2-client.xxx",
        "SP_API_CLIENT_SECRET": "your-secret",
        "SP_API_REFRESH_TOKEN": "Atzr|xxx",
        "SP_API_REGION": "na",
        "SP_API_BASE_URL": "http://localhost:4000",
        "SP_API_OAUTH_URL": "http://localhost:4000/auth/token"
      }
    }
  }
}
```

When these variables are not set, the client uses the standard Amazon endpoints for the configured region.

See the Quick Start section above for the basic MCP client configuration.

---

## Examples

### Example 1: Simple Inventory Check

```
You: Create a workflow that checks if inventory is low and alerts me

AI creates:
1. GetInventory → calls /fba/inventory/v1/summaries
2. CheckLevel → if quantity < 10, go to LowStock
3. LowStock → returns alert message
4. OK → returns success message
```

### Example 2: Order with Approval

```
You: Create an order processing workflow that requires approval for orders over $500

AI creates:
1. GetOrder → calls /orders/v0/orders/{orderId}
2. CheckValue → if total > 500, go to Approval
3. Approval → callback task, waits for human
4. Process → marks order as processed
5. Done → success state
```

### Example 3: Report Generation

```
You: Create a workflow that requests a report, waits, then downloads it

AI creates:
1. CreateReport → POST /reports/2021-06-30/reports
2. Wait → wait 30 seconds
3. CheckStatus → GET /reports/2021-06-30/reports/{reportId}
4. Choice → if status != "DONE", go back to Wait
5. GetDocument → GET /reports/2021-06-30/documents/{documentId}
6. Done → return report data
```

---

## Troubleshooting

### "SP-API client is not configured"

Set the environment variables in your MCP client config:
```json
"env": {
  "SP_API_CLIENT_ID": "...",
  "SP_API_CLIENT_SECRET": "...",
  "SP_API_REFRESH_TOKEN": "..."
}
```

### "Workflow validation failed"

Check that:
- All states are connected (no orphans)
- StartAt points to a valid state
- Choice states have valid Next references

### Callback not appearing

Callbacks are logged to stderr. Check your MCP client's console or logs.

---

## Development

### Run Tests

```bash
npm test
```

### Project Structure

```
Sp-api-workflow-mcp/
├── index.js              # MCP server entry
├── src/
│   ├── builder/          # Workflow construction
│   ├── interpreter/      # Workflow execution
│   ├── callback/         # Human interaction
│   ├── sp-api-core/      # Generic SP-API client
│   ├── schema/           # Input validation schemas
│   └── utils/            # JSONPath, validation
├── web/                  # Browser UI (see web/README.md)
│   ├── setup.js          # Quickstart setup script
│   ├── client/           # React 19 frontend
│   └── server/           # Express backend + Claude Agent SDK
├── test/                 # Test suite
└── .data/                # Runtime persistence (gitignored)
```

---

## License

Apache-2.0
