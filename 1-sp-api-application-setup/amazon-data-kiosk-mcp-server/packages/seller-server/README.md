# Amazon Seller Analytics MCP Server

An MCP server that allows AI assistants like Claude to interact with the Amazon Data Kiosk API for retrieving and analyzing seller analytics data.

## Overview

This MCP server provides tools specifically for third-party sellers on Amazon Marketplace. It enables AI assistants to:

- Create and manage GraphQL queries for sales, traffic, and economics data
- Check query processing status
- Retrieve and download query results
- Analyze sales trends and performance metrics
- Examine profitability and fee impacts
- Build custom queries for specific analytics needs

## Key Features

- **Sales and Traffic Analysis**: Analyze sales trends, page views, conversions, and more
- **Economics and Profitability**: Understand your true profitability after all Amazon fees and costs
- **Fee Breakdown**: Get detailed breakdowns of FBA fulfillment fees, storage fees, referral fees, and more
- **Fee Change Impact**: Evaluate how Amazon fee changes affect your business
- **Future Impact Preview**: Preview how upcoming fee changes will impact your profitability

## Prerequisites

- Node.js v16 or higher
- An Amazon Seller Central account with Data Kiosk access
- Amazon Selling Partner API credentials (client ID, client secret, and refresh token)

## Installation

1. Clone the repository and navigate to the seller-server directory:
```bash
git clone https://github.com/yourusername/amazon-data-kiosk-mcp.git
cd amazon-data-kiosk-mcp/packages/seller-server
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
    "amazon-seller-analytics": {
      "command": "node",
      "args": [
        "/absolute/path/to/amazon-data-kiosk-mcp/packages/seller-server/build/index.js"
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

### Sales and Traffic Tools
- `explore-sales-and-traffic-schema`: Explore the Sales and Traffic GraphQL schema structure
- `build-sales-and-traffic-query`: Build a GraphQL query for sales and traffic based on parameters
- `get-sales-and-traffic-example`: Get example GraphQL queries for sales and traffic data

### Economics Tools
- `explore-economics-schema`: Explore the Seller Economics GraphQL schema structure
- `build-economics-query`: Build a GraphQL query for seller economics data
- `build-economics-preview-query`: Build a GraphQL query to preview future seller economics based on fee changes
- `get-economics-example`: Get example GraphQL queries for seller economics data

## Example Prompts

- "What were my top-selling ASINs in the US marketplace last month?"
- "Show me my conversion rate and buy box percentage over the past 30 days"
- "How have my sales been trending week-over-week for the past quarter?"
- "What's my total profitability after all Amazon fees by ASIN?"
- "Compare my sales performance between mobile and desktop traffic"
- "How will the upcoming FBA fee changes impact my profitability?"
- "What's my return rate by product category?"
- "Show me products where my buy box percentage is below 90%"

## Data Domains

### Sales and Traffic Data (analytics_salesAndTraffic_2024_04_24)
- Units ordered and revenue
- Page views and sessions (browser and mobile)
- Buy box percentage
- Conversion rates
- Return metrics
- B2B-specific metrics

### Economics Data (analytics_economics_2024_03_15)
- Product sales performance
- Amazon fee breakdowns
- Advertising spend
- Seller-provided costs
- Net proceeds (profitability)
- Fee change impacts

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

This server is designed specifically for Amazon Marketplace Sellers. If you are a vendor selling directly to Amazon, please use the Amazon Vendor Analytics MCP Server instead.