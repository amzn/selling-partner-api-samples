// Main entry point for vendor server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerVendorTools } from "./tools/vendorTools.js";
import { checkEnvironment, registerGeneralTools } from "common";

// Create server instance with vendor-specific name
const server = new McpServer({
  name: "amazon-vendor-analytics",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

registerGeneralTools(server);

// Register only vendor-specific tools
registerVendorTools(server);

// Main function to run the server
async function main() {
  try {
    // Set up environment check first
    checkEnvironment();
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Amazon Vendor Analytics MCP Server running on stdio");
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