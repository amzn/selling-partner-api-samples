#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { OrdersApiTool } from "./tools/api-tools/orders-api-tools.js";
import { SPAPIMigrationAssistantTool } from "./tools/migration-assistant-tools/migration-tools.js";
import { CredentialTools } from "./tools/auth-tools/credential-tools.js";
import {
  searchOrdersSchema,
  getOrderSchema,
  cancelOrderSchema,
  updateShipmentStatusSchema,
  updateVerificationStatusSchema,
  confirmShipmentSchema,
  getOrderRegulatedInfoSchema,
} from "./zod-schemas/orders-schemas.js";
import { migrationAssistantSchema } from "./zod-schemas/migration-schemas.js";
import { credentialToolSchema } from "./zod-schemas/credential-schemas.js";
import { config } from "dotenv";

config();

class SPAPIDevAssistantMCPServer {
  private server: McpServer;
  private ordersApiTool: OrdersApiTool;
  private migrationAssistantTool: SPAPIMigrationAssistantTool;
  private credentialTools: CredentialTools;

  constructor() {
    this.server = new McpServer({
      name: "sp-api-dev-assistant-mcp-server",
      version: "0.0.1",
    });

    this.ordersApiTool = new OrdersApiTool();
    this.migrationAssistantTool = new SPAPIMigrationAssistantTool();
    this.credentialTools = new CredentialTools();
    this.setupTools();
  }

  private setupTools(): void {
    // Register Orders API V1 Tools
    this.server.registerTool(
      "search_orders",
      {
        description:
          "Search orders with various filters and include specific data sets. Use this to get orders by date, status, marketplace, etc.",
        inputSchema: searchOrdersSchema,
      },
      async (args: any) => {
        return await this.ordersApiTool.searchOrders(args);
      },
    );

    this.server.registerTool(
      "get_order",
      {
        description:
          "Get detailed information for a specific order by order ID",
        inputSchema: getOrderSchema,
      },
      async (args: any) => {
        return await this.ordersApiTool.getOrder(args);
      },
    );

    this.server.registerTool(
      "cancel_order",
      {
        description: "Cancel a specific order with a reason code",
        inputSchema: cancelOrderSchema,
      },
      async (args: any) => {
        return await this.ordersApiTool.cancelOrder(args);
      },
    );

    // Register Orders API V0 Tools
    this.server.registerTool(
      "update_shipment_status",
      {
        description:
          "Update shipment status for an order (V0 API - for orders that require shipment status updates)",
        inputSchema: updateShipmentStatusSchema,
      },
      async (args: any) => {
        return await this.ordersApiTool.updateShipmentStatus(args);
      },
    );

    this.server.registerTool(
      "update_verification_status",
      {
        description:
          "Update verification status for regulated orders (V0 API - for compliance-related orders)",
        inputSchema: updateVerificationStatusSchema,
      },
      async (args: any) => {
        return await this.ordersApiTool.updateVerificationStatus(args);
      },
    );

    this.server.registerTool(
      "confirm_shipment",
      {
        description:
          "Confirm shipment for an order (V0 API - for orders that require shipment confirmation)",
        inputSchema: confirmShipmentSchema,
      },
      async (args: any) => {
        return await this.ordersApiTool.confirmShipment(args);
      },
    );

    this.server.registerTool(
      "get_order_regulated_info",
      {
        description:
          "Get regulated information for an order (V0 API - for compliance-related orders)",
        inputSchema: getOrderRegulatedInfoSchema,
      },
      async (args: any) => {
        return await this.ordersApiTool.getOrderRegulatedInfo(args);
      },
    );

    // Register Migration Assistant Tool
    this.server.registerTool(
      "migration_assistant",
      {
        description:
          "Assists with API version migrations. Can provide general migration guidance or analyze existing code and generate refactored implementations. When source_code is provided: returns detailed analysis with deprecated endpoints, breaking changes, refactored code, and migration checklist. When source_code is omitted: returns comprehensive migration guide with API mappings, attribute changes, code examples, and best practices. Supported Migrations: Orders API v0 → v2026-01-01",
        inputSchema: migrationAssistantSchema,
      },
      async (args: any) => {
        return await this.migrationAssistantTool.migrationAssistant(args);
      },
    );

    // Register Unified Credential Management Tool
    this.server.registerTool(
      "credentials",
      {
        description:
          "Manage SP-API credentials. Actions: 'configure' to set clientId, clientSecret, refreshToken, baseUrl (region: 'na', 'eu', 'fe' or full URL); 'status' to check current configuration; 'clear' to remove all credentials. Credentials are stored in memory until server restart.",
        inputSchema: credentialToolSchema,
      },
      async (args: any) => {
        return this.credentialTools.handleCredentials(args);
      },
    );
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

try {
  const server = new SPAPIDevAssistantMCPServer();
  await server.run();
} catch (error) {
  process.exit(1);
}
