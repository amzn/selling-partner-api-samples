# SP-API MCP Server Documentation

This document describes the Model Context Protocol (MCP) server for interacting with Amazon's Selling Partner API through natural language.

**Developers utilizing this sample solution are solely responsible for its implementation, usage patterns, and must ensure full compliance with all applicable Amazon Selling Partner API Terms of Service, Acceptable Use Policy (AUP), Data Protection Policy (DPP), and any other relevant Amazon policies and agreements. This sample code is provided 'as-is' without any warranties or guarantees.**

## Overview

The SP-API MCP Server connects Large Language Models to Amazon's Selling Partner API ecosystem. Through conversational interfaces, developers and sellers can explore and execute SP-API operations using natural language.

The server provides:
- Natural language API exploration and execution
- Automatic parameter validation and response formatting
- Code generation in multiple languages
- OAuth2 token management and request signing
- Complete SP-API endpoint documentation


## Data Protection & Privacy
Users must implement appropriate security measures to protect SP-API credentials and any data accessed through this integration. Handle all seller and customer data in accordance with Amazon's Data Protection Policy and applicable privacy laws. Do not store sensitive data in logs or temporary files.

## Architecture 

The server uses a modular TypeScript architecture:

```
src/
  index.ts                # Server entry point
  auth/                   # Authentication
  catalog/                # API definitions
  tools/                  # Execution tools  
  types/                  # Type definitions
  utils/                  # Utilities
  config/                 # Configuration
```

### Core Components

1. **MCP Server Core** (`src/index.ts`)
   - Initializes the Model Context Protocol server
   - Registers and manages available tools
   - Handles client communication via stdio transport

2. **Authentication System** (`src/auth/`)
   - Manages OAuth2 token lifecycle
   - Signs requests with proper SP-API authentication headers
   - Handles token refresh automatically

3. **API Catalog System** (`src/catalog/`)
   - Loads and processes OpenAPI/Swagger definitions
   - Creates structured catalog of all SP-API endpoints
   - Provides intelligent endpoint discovery and parameter validation

4. **Tool System** (`src/tools/`)
   - Execute API Tool: Executes authenticated SP-API requests
   - Explore Catalog Tool: Provides endpoint discovery and documentation

## Prerequisites

Before setting up the SP-API MCP Server, ensure you have:

- Node.js 16 or higher
- Amazon Selling Partner API Credentials:
  - Client ID and Client Secret from Amazon Developer Console
  - Refresh Token from the SP-API authorization flow
  - Proper SP-API application permissions
- SP-API Model Files
- MCP-compatible client

## Installation

1. Clone both repositories at the same folder level:
```bash
# Clone the models repository first
git clone https://github.com/amzn/selling-partner-api-models.git

# Clone the samples repository  
git clone https://github.com/amzn/selling-partner-api-samples.git

```

2. Install and build:
```bash
# Navigate to the MCP server
cd selling-partner-api-samples/use-cases/sp-api-mcp-server

# Install and build
npm install
npm run build
```

## Configuration

Configure the SP-API MCP Server by setting environment variables directly in your MCP client's configuration file:

```json
{
  "mcpServers": {
    "amazon-sp-api": {
      "command": "node",
      "args": ["/path/to/selling-partner-api-samples/use-cases/sp-api-mcp-server/build/index.js"],
      "env": {
        // Required Variables
        "SP_API_CLIENT_ID": "your_client_id",
        "SP_API_CLIENT_SECRET": "your_client_secret",
        "SP_API_REFRESH_TOKEN": "your_refresh_token",
        "SP_API_BASE_URL": "https://sellingpartnerapi-na.amazon.com",
        "CATALOG_PATH": "/absolute/path/to/selling-partner-api-models/models",
        
        // Optional Variables
        "MAX_RESPONSE_TOKENS": "25000",
        "LOG_LEVEL": "info",
        "SP_API_OAUTH_URL": "https://api.amazon.com/auth/o2/token"
      }
    }
  }
}
```

### Environment Variables Explained

**Required Variables:**
- `SP_API_CLIENT_ID`: Your Amazon SP-API client ID from Amazon Developer Console
- `SP_API_CLIENT_SECRET`: Your Amazon SP-API client secret from Amazon Developer Console  
- `SP_API_REFRESH_TOKEN`: Your Amazon SP-API refresh token from either Amazon Developer Console(self-authentication) or OAuth authorization flow
- `SP_API_BASE_URL`: Amazon SP-API base URL for your marketplace (e.g., `https://sellingpartnerapi-na.amazon.com`)
- `CATALOG_PATH`: **Absolute path to the models subdirectory within the cloned selling-partner-api-models repository**

**CATALOG_PATH Example:**
If you cloned the repositories to `/home/user/projects/`, then:
```json
"CATALOG_PATH": "/home/user/projects/selling-partner-api-models/models"
```

**Optional Variables:**
- `MAX_RESPONSE_TOKENS`: Maximum tokens for API responses (default: 25000)
- `LOG_LEVEL`: Logging level - `debug`, `info`, `warn`, or `error` (default: info)
- `SP_API_OAUTH_URL`: Amazon OAuth endpoint (default: https://api.amazon.com/auth/o2/token)

## Development

For development work:

```bash
npm run dev    # Start with hot reloading
npm test      # Run tests
npm run lint  # Check code style
npm run format # Format code
```
