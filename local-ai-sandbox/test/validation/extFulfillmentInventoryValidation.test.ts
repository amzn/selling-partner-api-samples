import { describe, it, expect } from "vitest";
import { OPERATIONS_REGISTRY } from "../../src/registry/operationRegistry.js";
import { VALIDATION_REGISTRY } from "../../src/validation/validationRegistry.js";

describe("External Fulfillment Inventory registration", () => {
  const key = "External Fulfillment Inventory:2024-09-11:batchInventory";

  it("registers batchInventory handler in the operation registry", () => {
    expect(OPERATIONS_REGISTRY.get(key)).toBeDefined();
  });

  it("batchInventory is allowed in Seller mode", () => {
    // Default test env has MODE: "Seller"
    expect(OPERATIONS_REGISTRY.isAllowedInCurrentMode(key)).toBe(true);
  });

  it("validation pipeline contains batchSizeLimit rule with maxItems: 10", () => {
    const pipeline = VALIDATION_REGISTRY.get(key);
    expect(pipeline).toBeDefined();
    expect(pipeline).toEqual([
      {
        checkType: "batchSizeLimit",
        arrayParam: { name: "requests", source: "body" },
        maxItems: 10,
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Batch size exceeds maximum of 10 items",
        },
      },
    ]);
  });
});
