import { SPAPIMigrationAssistantTool } from "../../src/tools/migration-assistant-tools/migration-tools";

describe("SPAPIMigrationAssistantTool", () => {
  let migrationAssistant: SPAPIMigrationAssistantTool;

  beforeEach(() => {
    migrationAssistant = new SPAPIMigrationAssistantTool();
  });

  describe("migrationAssistant", () => {
    it("should return error for unsupported migration path", async () => {
      const result = await migrationAssistant.migrationAssistant({
        source_version: "orders-v1",
        target_version: "orders-v2",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unsupported migration path");
    });

    it("should return general guidance when no source code provided", async () => {
      const result = await migrationAssistant.migrationAssistant({
        source_version: "orders-v0",
        target_version: "orders-2026-01-01",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Migration Guide");
      expect(result.content[0].text).toContain("API Method Mapping");
      expect(result.content[0].text).toContain("Attribute Mappings");
    });

    it("should analyze code when source code provided", async () => {
      const sourceCode = `
        const response = await getOrders({
          marketplaceIds: ['ATVPDKIKX0DER'],
          createdAfter: '2025-01-01T00:00:00Z'
        });
        
        const buyerEmail = response.orders[0].BuyerEmail;
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "orders-v0",
        target_version: "orders-2026-01-01",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Migration Analysis");
      expect(result.content[0].text).toContain("Refactored Code");
    });

    it("should return analysis only when analysis_only is true", async () => {
      const sourceCode = `
        const response = await getOrders({
          marketplaceIds: ['ATVPDKIKX0DER']
        });
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "orders-v0",
        target_version: "orders-2026-01-01",
        analysis_only: true,
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Analysis Report");
      expect(result.content[0].text).not.toContain("Refactored Code");
    });

    it("should detect deprecated API methods", async () => {
      const sourceCode = `
        const buyerInfo = await getOrderBuyerInfo(orderId);
        const address = await getOrderAddress(orderId);
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "orders-v0",
        target_version: "orders-2026-01-01",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("getOrderBuyerInfo");
      expect(result.content[0].text).toContain("getOrderAddress");
    });

    it("should detect attribute mappings", async () => {
      const sourceCode = `
        const email = order.BuyerEmail;
        const name = order.BuyerName;
        const status = order.OrderStatus;
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "orders-v0",
        target_version: "orders-2026-01-01",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("BuyerEmail");
      expect(result.content[0].text).toContain("Order.fulfillment.fulfillmentStatus");
    });
  });
});
