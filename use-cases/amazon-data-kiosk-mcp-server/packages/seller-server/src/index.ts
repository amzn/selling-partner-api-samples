#!/usr/bin/env node
// Main entry point for seller server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSalesTools } from "./tools/salesTools.js";
import { registerEconomicsTools } from "./tools/economicsTools.js";
import { registerGeneralTools } from "common";
import { checkEnvironment } from "common";

// Create server instance with seller-specific name
const server = new McpServer({
  name: "amazon-seller-analytics",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Register only seller-specific tools
registerGeneralTools(server);
registerSalesTools(server);
registerEconomicsTools(server);

// Main function to run the server
async function main() {
  try {
    // Set up environment check first
    checkEnvironment();
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Amazon Seller Analytics MCP Server running on stdio");
  } catch (error) {
    console.error("Fatal error in main():", error);
    process.exit(1);
  }
}

// Run the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
