# Data Kiosk MCP Server

A Model Context Protocol (MCP) server that enables AI assistants like Claude Desktop to interact with Amazon's Data Kiosk API for analyzing seller and vendor data.

**This MCP server example runs locally in your test environment and provides a foundation for development and experimentation. Developers utilizing this sample solution are responsible for its implementation, usage patterns, and ensuring compliance with Amazon's Acceptable Use Policy (AUP) and Data Protection Policy (DPP).**

https://github.com/user-attachments/assets/e90896e6-bec2-4a5b-ad42-81052feada1d


## Overview

This MCP server provides a bridge between AI assistants and Amazon's Data Kiosk API, allowing for powerful analytics capabilities through natural language conversations. It enables users to:

- Query Sales and Traffic data for Amazon sellers
- Analyze Economics and Profitability metrics
- Examine Vendor Analytics data
- Build and execute GraphQL queries
- Monitor query processing
- Download and analyze query results

## Architecture

The project is structured as a monorepo with three packages:

1. **common**: Shared utilities and base functionality
   - Authentication with Amazon Selling Partner API
   - Base API interaction
   - GraphQL query helpers
   - Utility functions

2. **seller-server**: MCP server for Amazon Seller Analytics
   - Sales and Traffic analytics tools
   - Economics data tools
   - Example query builders

3. **vendor-server**: MCP server for Amazon Vendor Analytics
   - Sourcing view analytics
   - Manufacturing view analytics
   - Example query builders

## Prerequisites

- Node.js v16 or higher
- An Amazon Seller Central or Vendor Central account with Data Kiosk access
- Amazon Selling Partner API credentials:
  - Client ID
  - Client Secret
  - Refresh Token

## Installation

1. Clone the repository:
```bash
git clone https://github.com/amzn/selling-partner-api-samples.git
cd use-cases/amazon-data-kiosk-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build all packages:
```bash
npm run build
```

## Configuration

### Environment Variables

Set the following environment variables:

```
DATA_KIOSK_CLIENT_ID=your_client_id
DATA_KIOSK_CLIENT_SECRET=your_client_secret
DATA_KIOSK_REFRESH_TOKEN=your_refresh_token
DATA_KIOSK_BASE_URL=https://sellingpartnerapi-na.amazon.com
DATA_KIOSK_OAUTH_URL=https://api.amazon.com/auth/o2/token
DATA_KIOSK_API_VERSION=2023-11-15
```

### MCP Client Configuration (Using Claude Desktop as an Example)

Add the server to your Claude Desktop configuration file located at:
- macOS/Linux: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%AppData%\Claude\claude_desktop_config.json`

**Note:** While you can add both the seller and vendor servers to your configuration, it's recommended to add only one at a time to avoid confusion for the AI model. Choose the server that matches your account type (seller or vendor).

```json
{
  "mcpServers": {
    "amazon-seller-analytics": {
      "command": "node",
      "args": [
        "/absolute/path/to/amazon-data-kiosk-mcp-server/packages/seller-server/build/index.js"
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

## Usage

1. Start Claude Desktop
2. Verify the MCP server is connected by checking for the tools icon
3. Ask Claude about your Amazon seller or vendor data

### Example Prompts

For Sellers:
- "What were my sales trends last month?"
- "Show me my top-selling products by ASIN"
- "What's my conversion rate and buy box percentage?"
- "Analyze my profitability after all Amazon fees"
- "What's the impact of the recent FBA fee changes on my products?"

For Vendors:
- "What's my inventory health across product categories?"
- "Show me my purchase order fill rate trends"
- "What's my forecast accuracy for the last quarter?"
- "Analyze my shipped revenue by brand"

## Available Tools

### General Tools
- `list-queries`: List all Data Kiosk queries with optional filtering
- `create-query`: Create a new GraphQL query for retrieving business analytics data
- `check-query-status`: Check the status of a specific query
- `cancel-query`: Cancel a running query
- `get-document-details`: Get details of a document, including the download URL
- `download-document`: Download the content of a document using its URL
- `get-api-help`: Get help information about the Amazon Data Kiosk API

### Seller Analytics Tools
- `explore-sales-and-traffic-schema`: Explore the Sales and Traffic GraphQL schema structure
- `build-sales-and-traffic-query`: Build a GraphQL query for sales and traffic based on parameters
- `get-sales-and-traffic-example`: Get example GraphQL queries for sales and traffic data
- `explore-economics-schema`: Explore the Seller Economics GraphQL schema structure
- `build-economics-query`: Build a GraphQL query for seller economics data
- `build-economics-preview-query`: Build a GraphQL query to preview future seller economics based on fee changes
- `get-economics-example`: Get example GraphQL queries for seller economics data

### Vendor Analytics Tools
- `explore-vendor-analytics-schema`: Explore the Vendor Analytics GraphQL schema structure
- `build-vendor-analytics-query`: Build a GraphQL query for vendor analytics based on parameters
- `get-vendor-analytics-example`: Get example GraphQL queries for vendor analytics

## Technical Details

### Data Kiosk API

The server interacts with Amazon's Data Kiosk API, which provides:
- GraphQL-based query interface
- JSONL format results
- Support for multiple data domains (Sales, Economics, Vendor Analytics)
- Asynchronous query processing

### MCP Integration

This project uses the Model Context Protocol to:
- Expose tools to AI assistants like Claude
- Process natural language requests into structured API calls
- Format API responses for conversational use
- Guide users through complex analytics workflows

## Troubleshooting

If the MCP server isn't connecting to Claude Desktop:
1. Check the Claude logs at `~/Library/Logs/Claude/mcp*.log`
2. Verify the path in `claude_desktop_config.json` is correct and absolute
3. Make sure the server is built (`npm run build`)
4. Ensure all environment variables are set correctly
5. Restart Claude Desktop

## Security Considerations

- This server requires access to sensitive Amazon API credentials
- Never share your client secret or refresh token
- Consider using a dedicated IAM user with minimal permissions
- Review Amazon's security best practices for the Selling Partner API

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgements

- This project utilizes the Model Context Protocol developed by Anthropic
- Built for the Amazon Selling Partner API and Data Kiosk API
