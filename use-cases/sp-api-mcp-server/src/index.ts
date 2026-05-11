#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from "./utils/logger.js";
import { CatalogLoader } from "./catalog/catalog-loader.js";
import { ExecuteApiTool } from "./tools/execute-api-tool.js";
import { ExploreCatalogTool, exploreCatalogSchema } from "./tools/explore-catalog-tool.js";
import { createAuthenticatorFromEnv } from "./auth/sp-api-auth.js";
import * as dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

// Create server instance
const server = new McpServer({
  name: "amazon-sp-api",
  version: "0.1.0"
});

// Main function
async function main() {
  try {
    logger.info('Starting Amazon SP-API MCP Server...');
    
    // Initialize catalog
    const catalogLoader = new CatalogLoader();
    const catalog = await catalogLoader.loadCatalog();
    
    // Initialize authenticator
    const authenticator = createAuthenticatorFromEnv();
    
    // Initialize tools
    const executeTool = new ExecuteApiTool(catalog, authenticator);
    const exploreTool = new ExploreCatalogTool(catalog);
    
    // Register execute-sp-api tool
    server.tool(
      "execute-sp-api",
      "Execute Amazon Selling Partner API requests with specified endpoint and parameters",
      {
        endpoint: z.string().describe("The specific SP-API endpoint to use (required)"),
        parameters: z.record(z.any()).describe("Complete set of API parameters"),
        method: z.enum(["GET", "POST", "PUT", "DELETE"]).optional().describe("HTTP method"),
        additionalHeaders: z.record(z.string()).optional().describe("Additional request headers"),
        rawMode: z.boolean().optional().default(false).describe("Return raw response if true"),
        generateCode: z.boolean().optional().default(false).describe("Generate code snippet if true"),
        region: z.string().optional().default("us-east-1").describe("AWS region for the request")
      },
      async (params) => {
        const result = await executeTool.execute(params);
        return {
          content: [
            {
              type: "text",
              text: result
            }
          ]
        };
      }
    );
    
    // Register explore-sp-api-catalog tool
    server.tool(
      "explore-sp-api-catalog",
      "Get information about SP-API endpoints and parameters",
      exploreCatalogSchema.shape,
      async (params) => {
        const result = await exploreTool.execute(params);
        return {
          content: [
            {
              type: "text",
              text: result
            }
          ]
        };
      }
    );
    
    // Connect to transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info('Amazon SP-API MCP Server running successfully');
  } catch (error) {
    logger.error('Fatal error in main():', error);
    process.exit(1);
  }
}

main();