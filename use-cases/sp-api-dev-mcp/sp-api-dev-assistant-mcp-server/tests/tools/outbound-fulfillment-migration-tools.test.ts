import { describe, it, expect, beforeEach } from "vitest";
import { SPAPIMigrationAssistantTool } from "../../src/tools/migration-assistant-tools/migration-tools";
import { join } from "path";

const resourcesDir = join(process.cwd(), "src", "resources");

describe("SPAPIMigrationAssistantTool - Outbound Fulfillment", () => {
  let migrationAssistant: SPAPIMigrationAssistantTool;

  beforeEach(() => {
    migrationAssistant = new SPAPIMigrationAssistantTool(resourcesDir);
  });

  describe("outbound fulfillment migration", () => {
    it("should return error for unsupported migration path", async () => {
      const result = await migrationAssistant.migrationAssistant({
        source_version: "fulfillment-outbound-v1",
        target_version: "fulfillment-outbound-v2",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unsupported migration path");
      expect(result.content[0].text).toContain(
        "fulfillment-outbound-v2020-07-01",
      );
    });

    it("should return general guidance when no source code provided", async () => {
      const result = await migrationAssistant.migrationAssistant({
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain(
        "Fulfillment Outbound API Migration Guide",
      );
      expect(result.content[0].text).toContain("v2020-07-01 → v2025-09-24");
      expect(result.content[0].text).toContain("API Method Mapping");
      expect(result.content[0].text).toContain(
        "Delivery Service Level Mappings",
      );
      expect(result.content[0].text).toContain("Request Body Changes");
    });

    it("should include key changes in general guidance", async () => {
      const result = await migrationAssistant.migrationAssistant({
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      const text = result.content[0].text;
      // Base path change
      expect(text).toContain("/fba/outbound/2020-07-01");
      expect(text).toContain("/fulfillment/outbound/2025-09-24");
      // New header
      expect(text).toContain("x-amzn-fulfillment-service-id");
      // Operation renames
      expect(text).toContain("createOrder");
      expect(text).toContain("getOrder");
      expect(text).toContain("listOrders");
      expect(text).toContain("getOrderPreview");
    });

    it("should include migration benefits in general guidance", async () => {
      const result = await migrationAssistant.migrationAssistant({
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.content[0].text).toContain("Migration Benefits");
      expect(result.content[0].text).toContain("Multi-tenant support");
    });

    it("should include tenancy operations in general guidance", async () => {
      const result = await migrationAssistant.migrationAssistant({
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.content[0].text).toContain("Tenancy Operations");
      expect(result.content[0].text).toContain("createFulfillmentService");
      expect(result.content[0].text).toContain("listFulfillmentServices");
    });

    it("should include notification info in general guidance", async () => {
      const result = await migrationAssistant.migrationAssistant({
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.content[0].text).toContain("Notifications");
      expect(result.content[0].text).toContain("ORDER_STATUS_CHANGED");
      expect(result.content[0].text).toContain("SHIPMENT_STATUS_CHANGED");
      expect(result.content[0].text).toContain(
        "SHIPMENT_PACKAGE_STATUS_CHANGED",
      );
    });

    it("should include code examples in general guidance", async () => {
      const result = await migrationAssistant.migrationAssistant({
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.content[0].text).toContain("Code Examples");
      expect(result.content[0].text).toContain("createFulfillmentOrder");
      expect(result.content[0].text).toContain("Webhook Subscription");
    });

    it("should analyze code when source code provided", async () => {
      const sourceCode = `
        const response = await createFulfillmentOrder({
          sellerFulfillmentOrderId: 'ORDER-123',
          shippingSpeedCategory: 'Standard',
          fulfillmentAction: 'Ship',
          fulfillmentPolicy: 'FillAllAvailable',
          destinationAddress: { name: 'John Doe' },
          items: [{ sellerSKU: 'SKU-001', quantity: 2 }],
          marketplaceId: 'ATVPDKIKX0DER'
        });
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Migration Analysis");
      expect(result.content[0].text).toContain("Refactored Code");
    });

    it("should return analysis only when analysis_only is true", async () => {
      const sourceCode = `
        const response = await createFulfillmentOrder({
          sellerFulfillmentOrderId: 'ORDER-123',
          shippingSpeedCategory: 'Standard'
        });
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
        analysis_only: true,
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Analysis Report");
      expect(result.content[0].text).not.toContain("Refactored Code");
    });

    it("should detect deprecated API methods", async () => {
      const sourceCode = `
        const features = await getFeatures(marketplaceId);
        const inventory = await getFeatureInventory(marketplaceId, featureName);
        const tracking = await getPackageTrackingDetails(packageNumber);
        const returnResult = await createFulfillmentReturn(orderId, items);
        const reasonCodes = await listReturnReasonCodes(sellerSku);
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("getFeatures");
      expect(result.content[0].text).toContain("getFeatureInventory");
      expect(result.content[0].text).toContain("getPackageTrackingDetails");
      expect(result.content[0].text).toContain("createFulfillmentReturn");
      expect(result.content[0].text).toContain("listReturnReasonCodes");
      expect(result.content[0].text).toContain("Deprecated");
    });

    it("should detect delivery service level values", async () => {
      const sourceCode = `
        const order = await createFulfillmentOrder({
          shippingSpeedCategory: 'Standard',
          items: [{ sellerSKU: 'SKU-001' }]
        });

        if (preview.shippingSpeedCategory === 'Expedited') {
          // handle expedited
        }
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Delivery Service Level");
      expect(result.content[0].text).toContain("STANDARD");
      expect(result.content[0].text).toContain("EXPEDITED");
    });

    it("should detect fulfillment action and policy values", async () => {
      const sourceCode = `
        const order = await createFulfillmentOrder({
          fulfillmentAction: 'Ship',
          fulfillmentPolicy: 'FillAllAvailable'
        });
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("SHIP");
      expect(result.content[0].text).toContain("FILL_ALL_AVAILABLE");
    });

    it("should detect fulfillment order status values", async () => {
      const sourceCode = `
        const order = await getFulfillmentOrder(orderId);
        if (order.fulfillmentOrderStatus === 'Complete') {
          // handle complete
        } else if (order.fulfillmentOrderStatus === 'Processing') {
          // handle processing
        }
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Status Value");
      expect(result.content[0].text).toContain("COMPLETE");
      expect(result.content[0].text).toContain("PROCESSING");
    });

    it("should detect payload wrapper usage", async () => {
      const sourceCode = `
        const response = await getFulfillmentOrder(orderId);
        const order = response.payload.fulfillmentOrder;
        const items = response.payload.fulfillmentOrderItems;
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("payload wrapper");
    });

    it("should detect base path usage", async () => {
      const sourceCode = `
        const url = '/fba/outbound/2020-07-01/fulfillmentOrders';
        const response = await fetch(baseUrl + url);
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Base path changed");
      expect(result.content[0].text).toContain(
        "/fulfillment/outbound/2025-09-24",
      );
    });

    it("should detect attribute mappings", async () => {
      const sourceCode = `
        const orderId = order.sellerFulfillmentOrderId;
        const status = order.fulfillmentOrderStatus;
        const speed = order.shippingSpeedCategory;
        const shipments = order.fulfillmentShipments;
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Attribute Mappings");
      expect(result.content[0].text).toContain("orderId");
      expect(result.content[0].text).toContain("status");
      expect(result.content[0].text).toContain("deliveryServiceLevel");
    });

    it("should handle source_files input", async () => {
      const sourceFiles = [
        {
          fileName: "fulfillment-service.ts",
          code: `
            const response = await createFulfillmentOrder({
              sellerFulfillmentOrderId: 'ORDER-123',
              shippingSpeedCategory: 'Standard'
            });
          `,
        },
        {
          fileName: "preview-service.ts",
          code: `
            const preview = await getFulfillmentPreview({
              shippingSpeedCategories: ['Standard', 'Expedited']
            });
          `,
        },
      ];

      const result = await migrationAssistant.migrationAssistant({
        source_files: sourceFiles,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("fulfillment-service.ts");
      expect(result.content[0].text).toContain("preview-service.ts");
    });

    it("should skip files with no migration-relevant findings", async () => {
      const sourceFiles = [
        {
          fileName: "unrelated-service.ts",
          code: `
            function calculateTotal(products) {
              return products.reduce((sum, product) => sum + product.price, 0);
            }
          `,
        },
      ];

      const result = await migrationAssistant.migrationAssistant({
        source_files: sourceFiles,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain(
        "No Fulfillment Outbound API v2020-07-01 usage detected",
      );
    });

    it("should detect query parameter usage", async () => {
      const sourceCode = `
        const orders = await listAllFulfillmentOrders({
          queryStartDate: '2025-01-01T00:00:00Z',
          nextToken: savedToken
        });
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Query Parameter");
    });

    it("should generate refactored code with renamed API methods", async () => {
      const sourceCode = `
        const order = await createFulfillmentOrder(params);
        const details = await getFulfillmentOrder(orderId);
        const list = await listAllFulfillmentOrders({ queryStartDate: date });
        const preview = await getFulfillmentPreview(previewParams);
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      const text = result.content[0].text;
      expect(text).toContain("createOrder");
      expect(text).toContain("getOrder");
      expect(text).toContain("listOrders");
      expect(text).toContain("getOrderPreview");
    });

    it("should include migration checklist in report", async () => {
      const sourceCode = `
        const order = await createFulfillmentOrder({
          sellerFulfillmentOrderId: 'ORDER-123'
        });
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Migration Checklist");
      expect(result.content[0].text).toContain("Testing Recommendations");
    });

    it("should detect getFulfillmentPreview with response structure changes", async () => {
      const sourceCode = `
        const result = await getFulfillmentPreview({
          address: { name: 'John', addressLine1: '123 Main St' },
          items: [{ sellerSku: 'SKU-001', quantity: 1 }],
          shippingSpeedCategories: ['Standard', 'Expedited']
        });

        const previews = result.payload.fulfillmentPreviews;
        previews.forEach(preview => {
          const shipments = preview.fulfillmentPreviewShipments;
          const arrival = shipments[0].earliestArrivalDate;
        });
      `;

      const result = await migrationAssistant.migrationAssistant({
        source_code: sourceCode,
        source_version: "fulfillment-outbound-v2020-07-01",
        target_version: "fulfillment-outbound-2025-09-24",
      });

      expect(result.isError).toBeUndefined();
      const text = result.content[0].text;
      expect(text).toContain("getFulfillmentPreview");
      expect(text).toContain("payload wrapper");
      expect(text).toContain("plannedShipments");
      expect(text).toContain("offers");
    });
  });
});
