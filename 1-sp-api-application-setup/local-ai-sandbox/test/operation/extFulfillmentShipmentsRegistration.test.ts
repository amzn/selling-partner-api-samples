import { describe, it, expect } from "vitest";
import { OPERATIONS_REGISTRY } from "../../src/registry/operationRegistry.js";
import { VALIDATION_REGISTRY } from "../../src/validation/validationRegistry.js";

describe("External Fulfillment Shipments registration", () => {
  const operations = [
    "getShipments",
    "getShipment",
    "processShipment",
    "createPackages",
    "updatePackage",
    "updatePackageStatus",
    "retrieveShippingOptions",
    "generateInvoice",
    "retrieveInvoice",
    "generateShipLabels",
  ];

  it.each(operations)("registers %s handler", (operationId) => {
    const key = `External Fulfillment Shipments:2024-09-11:${operationId}`;
    expect(OPERATIONS_REGISTRY.get(key)).toBeDefined();
  });

  // The default test environment has MODE: "Seller", so isAllowedInCurrentMode returns true.
  // Vendor mode restriction is enforced by the `supportedModes: ["Seller"]` registration —
  // all 10 handlers are registered with only ["Seller"], meaning they return false for Vendor.
  it.each(operations)("%s is allowed in Seller mode", (operationId) => {
    const key = `External Fulfillment Shipments:2024-09-11:${operationId}`;
    expect(OPERATIONS_REGISTRY.isAllowedInCurrentMode(key)).toBe(true);
  });

  it("getShipments validation pipeline has marketplaceIdValidation rule", () => {
    const pipeline = VALIDATION_REGISTRY.get("External Fulfillment Shipments:2024-09-11:getShipments");
    expect(pipeline).toBeDefined();
    expect(pipeline).toEqual([
      {
        checkType: "marketplaceIdValidation",
        marketplaceIdsParam: { name: "marketplaceId", source: "query" },
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "The marketplace ID is not valid for the configured region",
        },
      },
    ]);
  });
});
