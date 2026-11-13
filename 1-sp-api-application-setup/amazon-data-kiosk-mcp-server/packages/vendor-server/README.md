# Amazon Vendor Analytics MCP Server

An MCP server that allows AI assistants like Claude to interact with the Amazon Data Kiosk API for retrieving and analyzing vendor analytics data.

## Overview

This MCP server provides tools specifically for vendors selling directly to Amazon. It enables AI assistants to:

- Create and manage GraphQL queries for vendor analytics data
- Check query processing status
- Retrieve and download query results
- Analyze inventory health and sell-through rates
- Examine purchase order fulfillment metrics
- Build custom queries for specific analytics needs

## Key Features

- **Sourcing View**: Analyze metrics for products sourced directly from you to Amazon (distributor role)
- **Manufacturing View**: Analyze metrics for products manufactured by you, including traffic and forecasting
- **Inventory Analysis**: Track inventory health, sell-through rates, and stock levels
- **Supply Chain Metrics**: Monitor purchase order fulfillment, lead times, and confirmation rates
- **Sales Performance**: Analyze shipped units, revenue, and average selling prices
- **Demand Forecasting**: Access Amazon's demand predictions with statistical confidence levels

## Prerequisites

- Node.js v16 or higher
- An Amazon Vendor Central account with Data Kiosk access
- Amazon Selling Partner API credentials (client ID, client secret, and refresh token)

## Installation

1. Clone the repository and navigate to the vendor-server directory:
```bash
git clone https://github.com/yourusername/amazon-data-kiosk-mcp.git
cd amazon-data-kiosk-mcp/packages/vendor-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the server:
```bash
npm run build
```

## Configuration

### Claude Desktop Integration

Add the server to your Claude Desktop configuration file located at:
- macOS/Linux: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%AppData%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "amazon-vendor-analytics": {
      "command": "node",
      "args": [
        "/absolute/path/to/amazon-data-kiosk-mcp/packages/vendor-server/build/index.js"
      ],
      "env": {
        "DATA_KIOSK_CLIENT_ID": "your_client_id",
        "DATA_KIOSK_CLIENT_SECRET": "your_client_secret",
        "DATA_KIOSK_REFRESH_TOKEN": "your_refresh_token",
        "DATA_KIOSK_BASE_URL": "https://sellingpartnerapi-na.amazon.com",
        "DATA_KIOSK_OAUTH_URL": "https://api.amazon.com/auth/o2/token",
        "DATA_KIOSK_API_VERSION": "2023-11-15"
      }
    }
  }
}
```

Make sure to:
1. Replace the placeholder values with your actual Amazon Selling Partner API credentials
2. Use the absolute path to the server's index.js file on your system

## Available Tools

### General Tools
- `list-queries`: List all Data Kiosk queries with optional filtering
- `create-query`: Create a new GraphQL query for retrieving business analytics data
- `check-query-status`: Check the status of a specific query
- `cancel-query`: Cancel a running query
- `get-document-details`: Get details of a document, including the download URL
- `download-document`: Download the content of a document using its URL
- `get-api-help`: Get help information about the Amazon Data Kiosk API

### Vendor Analytics Tools
- `explore-vendor-analytics-schema`: Explore the Vendor Analytics GraphQL schema structure
- `build-vendor-analytics-query`: Build a GraphQL query for vendor analytics based on parameters
- `get-vendor-analytics-example`: Get example GraphQL queries for vendor analytics

## Example Prompts

- "What's my inventory health across product categories?"
- "Show me my purchase order fill rate trends for the last quarter"
- "Analyze my shipped revenue by brand"
- "What's my sell-through rate for aging inventory?"
- "Show me customer returns by ASIN"
- "What's Amazon's demand forecast for my top products next month?"
- "How's my vendor confirmation rate trending over time?"
- "Which products have the lowest Ultra Fast Track percentage?"

## Data Views and Metrics

### Sourcing View
For products sourced directly from you to Amazon (distributor role):

- **Shipping Metrics**: Units shipped, revenue, average selling price
- **Inventory Metrics**: Sellable/unsellable inventory, sell-through rates
- **Supply Chain Metrics**: Purchase order fulfillment, lead times
- **Cost Metrics**: COGS, contra-COGS, sales discounts
- **Customer Satisfaction**: Return metrics

### Manufacturing View
For products manufactured by you, includes all sourcing view metrics plus:

- **Traffic Metrics**: Glance views (product page views)
- **Order Metrics**: Unfilled orders, ordered units
- **Forecasting**: Future demand predictions with statistical confidence levels

## Grouping Attributes

You can segment data by various product attributes:

- Product identifiers (ASIN, UPC, EAN, ISBN)
- Brand information (brand name, brand code)
- Product details (title, category, color, model number)
- Fulfillment information (prep instructions, replenishment category)
- Customer geography (city, state, country, ZIP code)

## Troubleshooting

If you encounter issues with the MCP server:

1. Check Claude Desktop logs at `~/Library/Logs/Claude/mcp*.log`
2. Verify your Amazon API credentials are correct
3. Ensure the path in the configuration is absolute and correct
4. Check that you've built the server with `npm run build`
5. Restart Claude Desktop after making configuration changes

## Security Considerations

- Keep your API credentials secure and never share them
- Consider using a dedicated IAM user with minimal permissions
- Regularly rotate your refresh token
- Review Amazon's security best practices for the Selling Partner API

## Important Note

This server is designed specifically for Amazon Vendors. If you are a third-party seller on Amazon Marketplace, please use the Amazon Seller Analytics MCP Server instead.