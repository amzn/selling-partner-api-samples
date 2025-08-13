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

1. Clone the repository:
```bash
git clone https://github.com/amzn/selling-partner-api-samples.git
cd selling-partner-api-samples/use-cases/sp-api-mcp-server
```

2. Download API models:
```bash
# Clone the models repository
git clone https://github.com/amzn/selling-partner-api-models.git

# Create swagger directory
mkdir swagger

# Copy all models
cp -r selling-partner-api-models/models/* ./swagger/

# Alternative: Copy specific models (recommended)
# cp -r selling-partner-api-models/models/orders-api-model ./swagger/
# cp -r selling-partner-api-models/models/catalog-items-api-model ./swagger/
```

3. Install and build:
```bash
npm install
npm run build
```

## Configuration

The SP-API MCP Server is configured through your MCP client configuration file. You can set environment variables in two ways:

### Method 1: Environment Variables (.env file)

Create a `.env` file in the root directory with the following variables:

**Required Variables:**
```bash
# SP-API Authentication (Required)
SP_API_CLIENT_ID=your_client_id
SP_API_CLIENT_SECRET=your_client_secret  
SP_API_REFRESH_TOKEN=your_refresh_token

# API Endpoint (Required)
SP_API_BASE_URL=https://sellingpartnerapi-na.amazon.com
```

**Optional Variables:**
```bash
# Server Configuration (Optional)
MAX_RESPONSE_TOKENS=25000    # Controls response truncation
CATALOG_PATH=./swagger       # Path to API model files
LOG_LEVEL=info              # Logging detail (debug|info|warn|error)
SP_API_OAUTH_URL=https://api.amazon.com/auth/o2/token  # OAuth endpoint
```

### Method 2: Direct Configuration in MCP Client

Set environment variables directly in your MCP client's configuration file:

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
        
        // Optional Variables
        "MAX_RESPONSE_TOKENS": "25000",
        "CATALOG_PATH": "./swagger",
        "LOG_LEVEL": "info",
        "SP_API_OAUTH_URL": "https://api.amazon.com/auth/o2/token"
      }
    }
  }
}
```

## Development

For development work:

```bash
npm run dev    # Start with hot reloading
npm test      # Run tests
npm run lint  # Check code style
npm run format # Format code
```
