# SP-API Dev Assistant MCP Server

A Model Context Protocol (MCP) server providing developer assistant tools for the Amazon Selling Partner API (SP-API).

## Tools

| Tool | Description |
|------|-------------|
| `search_orders` | Search orders with filters (date, status, marketplace, etc.) |
| `get_order` | Get detailed order information by order ID |
| `cancel_order` | Cancel an order with a reason code |
| `update_shipment_status` | Update shipment status (V0 API) |
| `update_verification_status` | Update verification status for regulated orders (V0 API) |
| `confirm_shipment` | Confirm shipment for an order (V0 API) |
| `get_order_regulated_info` | Get regulated information for an order (V0 API) |
| `migration_assistant` | Assists with Orders API v0 → v2026-01-01 migration |
| `credentials` | Manage SP-API credentials (configure, status, clear) |

## Development

```bash
npm install
npm run build
npm test
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SP_API_CLIENT_ID` | SP-API LWA Client ID |
| `SP_API_CLIENT_SECRET` | SP-API LWA Client Secret |
| `SP_API_REFRESH_TOKEN` | SP-API Refresh Token |
| `SP_API_BASE_URL` | API base URL (defaults to NA endpoint) |

> The migration assistant tool does not require credentials and can be used without API access.
