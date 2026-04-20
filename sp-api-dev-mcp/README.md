# Amazon SP-API Developer MCP Server

A Model Context Protocol (MCP) server that provides tools for interacting with Amazon's Selling Partner API (SP-API), specifically focused on Orders API operations and migration assistance.

## Usage with MCP Clients

The `@spectrumtest/sp-api-dev-mcp` package consolidates multiple SP-API MCP servers into a single npm package:

| Server | npx command arg |
|--------|----------------|
| SP-API Dev Assistant | `sp-api-dev-assistant-mcp-server` |
| Amazon Data Kiosk (Seller Central) | `amazon-data-kiosk-sc-mcp-server` |
| Amazon Data Kiosk (Vendor Central) | `amazon-data-kiosk-vc-mcp-server` |
| SP-API MCP Server | `sp-api-mcp-server` |

### Claude Desktop

```json
{
  "mcpServers": {
    "sp-api-dev-assistant": {
      "command": "npx",
      "args": ["-y", "@spectrumtest/sp-api-dev-mcp", "sp-api-dev-assistant-mcp-server"],
      "env": {
        "SP_API_CLIENT_ID": "your_client_id",
        "SP_API_CLIENT_SECRET": "your_client_secret",
        "SP_API_REFRESH_TOKEN": "your_refresh_token",
        "SP_API_BASE_URL": "https://sellingpartnerapi-na.amazon.com"
      }
    },
    "amazon-data-kiosk-sc": {
      "command": "npx",
      "args": ["-y", "@spectrumtest/sp-api-dev-mcp", "amazon-data-kiosk-sc-mcp-server"],
      "env": {
        "SP_API_CLIENT_ID": "your_client_id",
        "SP_API_CLIENT_SECRET": "your_client_secret",
        "SP_API_REFRESH_TOKEN": "your_refresh_token",
        "SP_API_BASE_URL": "https://sellingpartnerapi-na.amazon.com"
      }
    },
    "amazon-data-kiosk-vc": {
      "command": "npx",
      "args": ["-y", "@spectrumtest/sp-api-dev-mcp", "amazon-data-kiosk-vc-mcp-server"],
      "env": {
        "SP_API_CLIENT_ID": "your_client_id",
        "SP_API_CLIENT_SECRET": "your_client_secret",
        "SP_API_REFRESH_TOKEN": "your_refresh_token",
        "SP_API_BASE_URL": "https://sellingpartnerapi-na.amazon.com"
      }
    },
    "sp-api-mcp-server": {
      "command": "npx",
      "args": ["-y", "@spectrumtest/sp-api-dev-mcp", "sp-api-mcp-server"],
      "env": {
        "SP_API_CLIENT_ID": "your_client_id",
        "SP_API_CLIENT_SECRET": "your_client_secret",
        "SP_API_REFRESH_TOKEN": "your_refresh_token",
        "SP_API_BASE_URL": "https://sellingpartnerapi-na.amazon.com"
      }
    }
  }
}
```

> **Note:** The `env` variables are optional. The migration assistant tool does not require credentials and can be used without API access.

## Usage Examples

### Migration Assistant - General Guidance

#### Prompt:
```
Guide me through the processes to migrate from orders V0 to V1.
```

#### Tool args:
```typescript
{
  "source_version": "orders-v0",
  "target_version": "orders-2026-01-01"
}
```

### Migration Assistant - Code Analysis

#### Prompt:
```
Help me refactor my orders V0 code
<Code snippet>
```

#### Tool args:
```typescript
{
  "source_code": "your existing code here",
  "source_version": "orders-v0",
  "target_version": "orders-2026-01-01",
  "language": "javascript"
}
```
