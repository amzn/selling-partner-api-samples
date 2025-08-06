# Amazon SP-API MCP Server

A Model Context Protocol (MCP) server that enables natural language interaction with Amazon's Selling Partner API through MCP Client.

**This MCP server example runs locally in your test environment and provides a foundation for development and experimentation. Developers utilizing this sample solution are responsible for its implementation, usage patterns, and ensuring compliance with Amazon's Acceptable Use Policy (AUP) and Data Protection Policy (DPP).**

## Description

The Amazon SP-API MCP Server bridges the gap between Large Languange Model's natural language capabilities and Amazon's comprehensive Selling Partner API ecosystem. This server allows developers, sellers, and businesses to interact with SP-API endpoints through conversational interfaces, making complex API operations accessible through simple natural language requests.

### Key Capabilities

- **Natural Language API Exploration**: Discover and understand SP-API endpoints through conversational queries
- **Intelligent Request Execution**: Execute authenticated SP-API calls with automatic parameter validation and formatting
- **Smart Response Processing**: Get structured, human-readable responses with insights and next-step recommendations
- **Code Generation**: Generate ready-to-use code snippets in multiple programming languages
- **Real-time Authentication**: Automatic OAuth2 token management and request signing
- **Comprehensive Catalog**: Built-in knowledge of all SP-API endpoints with detailed parameter information

## Architecture

The MCP server is built with a modular TypeScript architecture designed for scalability and maintainability:

```
├── src/
│   ├── index.ts                 # Main MCP server entry point
│   ├── auth/
│   │   └── sp-api-auth.ts      # OAuth2 authentication & request signing
│   ├── catalog/
│   │   ├── catalog-loader.ts    # API catalog management
│   │   ├── cache/
│   │   │   └── catalog-cache.ts # Caching layer for performance
│   │   └── swagger/
│   │       ├── swagger-loader.ts    # OpenAPI/Swagger processing
│   │       ├── catalog-mapper.ts    # Schema to catalog mapping
│   │       ├── reference-resolver.ts # JSON reference resolution
│   │       └── schema-processor.ts  # Schema validation & processing
│   ├── tools/
│   │   ├── execute-api-tool.ts     # API execution tool
│   │   └── explore-catalog-tool.ts # Catalog exploration tool
│   ├── types/
│   │   ├── api-catalog.ts      # Type definitions for API catalog
│   │   └── swagger-types.ts    # OpenAPI/Swagger type definitions
│   ├── utils/
│   │   └── logger.ts          # Structured logging utility
│   └── config/
│       └── index.ts           # Configuration management
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
   - **Execute API Tool**: Executes authenticated SP-API requests with response processing
   - **Explore Catalog Tool**: Provides endpoint discovery and documentation

5. **Type System** (`src/types/`)
   - Comprehensive TypeScript definitions for all API structures
   - Ensures type safety across the entire application

## Getting Started

### Prerequisites

Before setting up the Amazon SP-API MCP Server, ensure you have:

- **Node.js 16+**: Required for running the TypeScript/JavaScript server
- **Amazon Selling Partner API Credentials**: 
  - Client ID and Client Secret from Amazon Developer Console
  - Refresh Token from the SP-API authorization flow
  - Proper SP-API application permissions
- **MCP Client**: Any Model Context Protocol client (Claude Desktop or other MCP-compatible applications)

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/amzn/selling-partner-api-samples.git
   cd selling-partner-api-samples/use-cases/sp-api-mcp-server
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Server**
   ```bash
   npm run build
   ```

4. **Configure Environment Variables**
   
   Create a `.env` file in the root directory:
   ```bash
   # Required SP-API Credentials
   SP_API_CLIENT_ID=your_client_id_here
   SP_API_CLIENT_SECRET=your_client_secret_here  
   SP_API_REFRESH_TOKEN=your_refresh_token_here
   
   # Optional Configuration
   SP_API_BASE_URL=https://sellingpartnerapi-na.amazon.com  # Default for North America
   SP_API_OAUTH_URL=https://api.amazon.com/auth/o2/token   # OAuth endpoint
   LOG_LEVEL=info                                          # Logging level
   CATALOG_PATH=./swagger                                  # Path to Swagger files
   MAX_RESPONSE_TOKENS=25000                               # Max tokens for API response truncation
   NODE_ENV=production                                     # Environment
   ```

#### Configuration Options

- **`MAX_RESPONSE_TOKENS`** (Optional, default: 25000): Controls the maximum number of tokens allowed in API catalog responses before truncation occurs. When exploring complex endpoints like `orders_getOrders`, responses exceeding this limit will be truncated with suggestions for progressive exploration using depth parameters or reference extraction.
  
  **Usage examples:**
  ```bash
  # Use default 25,000 token limit
  MAX_RESPONSE_TOKENS=25000
  
  # Increase limit for more detailed responses
  MAX_RESPONSE_TOKENS=50000
  
  # Reduce limit for more concise responses
  MAX_RESPONSE_TOKENS=10000
  ```

### MCP Client Configuration

Add the MCP server to your MCP client configuration. Below are examples for popular clients:

#### Claude Desktop

**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "amazon-sp-api": {
      "command": "node",
      "args": [
        "/absolute/path/to/amazon-sp-api-mcp-server/build/index.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

#### Other MCP Clients

For other MCP-compatible clients (Continue, Cline, etc.), configure the server with:
- **Command**: `node`
- **Args**: `["/path/to/build/index.js"]`
- **Transport**: stdio (standard input/output)

### Verification

1. **Test the Build**
   ```bash
   npm run start
   ```
   You should see logs indicating successful server initialization.

2. **Restart your MCP client** and verify the server appears in the MCP section.

3. **Test Basic Functionality** by asking Claude:
   ```
   "What SP-API categories are available?"
   "Show me information about the Orders API"
   ```

### Development Setup

For development with hot-reloading:

```bash
# Install development dependencies
npm install

# Run in development mode  
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```
