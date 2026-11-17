import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

// Mock DB functions
const mockGet = vi.fn<(api: string, key: string) => Record<string, unknown> | null>().mockReturnValue(null);
const mockPut = vi.fn();

vi.mock("../../src/database/Context.js", () => ({
  Api: { EXT_FULFILLMENT_INVENTORY: "extFulfillmentInventory" },
  Context: {
    get instance() {
      return { engine: { get: mockGet, put: mockPut } };
    },
  },
}));

import { batchInventoryHandler } from "../../src/operation/extFulfillmentInventoryOperations.js";

interface SubRequest {
  uri: string;
  method?: string;
  body?: Record<string, unknown>;
}

function makeValidationResult(requests: SubRequest[]): UnifiedValidationPass {
  return {
    pass: true,
    operationId: "batchInventory",
    apiName: "External Fulfillment Inventory",
    apiVersion: "2024-09-11",
    pathParams: {},
    queryParams: {},
    body: { requests },
    resolvedEntities: {},
    operation: {},
  };
}

describe("batchInventoryHandler — unit tests for edge cases and error conditions", () => {
  beforeEach(() => {
    mockGet.mockReturnValue(null);
    mockPut.mockReset();
  });

  // **Validates: Requirements 1.5**
  describe("empty URI", () => {
    it("should return statusCode 400 with INVALID_REQUEST for an empty URI string", async () => {
      const result = await batchInventoryHandler(makeValidationResult([{ uri: "" }]), {} as any);
      const responses = (result.data as any).body.responses;

      expect(responses).toHaveLength(1);
      expect(responses[0].status.statusCode).toBe(400);
      expect(responses[0].body.actionableErrors[0].errorType).toBe("INVALID_REQUEST");
    });
  });

  // **Validates: Requirements 1.6**
  describe("missing locationId or skuId in URI", () => {
    it("should return 400 INVALID_REQUEST when skuId is missing", async () => {
      const result = await batchInventoryHandler(makeValidationResult([{ uri: "/inventory/update?locationId=LOC1" }]), {} as any);
      const responses = (result.data as any).body.responses;

      expect(responses).toHaveLength(1);
      expect(responses[0].status.statusCode).toBe(400);
      expect(responses[0].body.actionableErrors[0].errorType).toBe("INVALID_REQUEST");
      expect(responses[0].body.actionableErrors[0].errorSubType).toContain("locationId and skuId");
    });

    it("should return 400 INVALID_REQUEST when locationId is missing", async () => {
      const result = await batchInventoryHandler(makeValidationResult([{ uri: "/inventory/fetch?skuId=SKU1" }]), {} as any);
      const responses = (result.data as any).body.responses;

      expect(responses).toHaveLength(1);
      expect(responses[0].status.statusCode).toBe(400);
      expect(responses[0].body.actionableErrors[0].errorType).toBe("INVALID_REQUEST");
    });

    it("should return 400 INVALID_REQUEST when both locationId and skuId are missing", async () => {
      const result = await batchInventoryHandler(makeValidationResult([{ uri: "/inventory/update" }]), {} as any);
      const responses = (result.data as any).body.responses;

      expect(responses).toHaveLength(1);
      expect(responses[0].status.statusCode).toBe(400);
      expect(responses[0].body.actionableErrors[0].errorType).toBe("INVALID_REQUEST");
    });
  });

  // **Validates: Requirements 2.5**
  describe("negative quantity", () => {
    it("should return 400 INVALID_INPUT with 'Quantity must be non-negative'", async () => {
      const result = await batchInventoryHandler(
        makeValidationResult([
          {
            uri: "/inventory/update?locationId=LOC1&skuId=SKU1",
            body: { quantity: -5, clientSequenceNumber: 1 },
          },
        ]),
        {} as any,
      );
      const responses = (result.data as any).body.responses;

      expect(responses).toHaveLength(1);
      expect(responses[0].status.statusCode).toBe(400);
      expect(responses[0].body.actionableErrors[0].errorType).toBe("INVALID_INPUT");
      expect(responses[0].body.actionableErrors[0].errorSubType).toBe("Quantity must be non-negative");
    });
  });

  // **Validates: Requirements 2.6**
  describe("floating-point quantity", () => {
    it("should return 400 INVALID_INPUT with 'Quantity must be an integer'", async () => {
      const result = await batchInventoryHandler(
        makeValidationResult([
          {
            uri: "/inventory/update?locationId=LOC1&skuId=SKU1",
            body: { quantity: 3.14, clientSequenceNumber: 1 },
          },
        ]),
        {} as any,
      );
      const responses = (result.data as any).body.responses;

      expect(responses).toHaveLength(1);
      expect(responses[0].status.statusCode).toBe(400);
      expect(responses[0].body.actionableErrors[0].errorType).toBe("INVALID_INPUT");
      expect(responses[0].body.actionableErrors[0].errorSubType).toBe("Quantity must be an integer");
    });
  });

  // **Validates: Requirements 2.7**
  describe("missing quantity field", () => {
    it("should return 400 INVALID_INPUT with 'Quantity is required for update operations'", async () => {
      const result = await batchInventoryHandler(
        makeValidationResult([
          {
            uri: "/inventory/update?locationId=LOC1&skuId=SKU1",
            body: { clientSequenceNumber: 1 },
          },
        ]),
        {} as any,
      );
      const responses = (result.data as any).body.responses;

      expect(responses).toHaveLength(1);
      expect(responses[0].status.statusCode).toBe(400);
      expect(responses[0].body.actionableErrors[0].errorType).toBe("INVALID_INPUT");
      expect(responses[0].body.actionableErrors[0].errorSubType).toBe("Quantity is required for update operations");
    });
  });

  // **Validates: Requirements 2.8**
  describe("missing clientSequenceNumber", () => {
    it("should return 400 INVALID_INPUT with 'clientSequenceNumber is required for update operations'", async () => {
      const result = await batchInventoryHandler(
        makeValidationResult([
          {
            uri: "/inventory/update?locationId=LOC1&skuId=SKU1",
            body: { quantity: 10 },
          },
        ]),
        {} as any,
      );
      const responses = (result.data as any).body.responses;

      expect(responses).toHaveLength(1);
      expect(responses[0].status.statusCode).toBe(400);
      expect(responses[0].body.actionableErrors[0].errorType).toBe("INVALID_INPUT");
      expect(responses[0].body.actionableErrors[0].errorSubType).toBe("clientSequenceNumber is required for update operations");
    });
  });

  // **Validates: Requirements 2.3**
  describe("success response format", () => {
    it("should return statusCode 200 with all required fields present", async () => {
      const result = await batchInventoryHandler(
        makeValidationResult([
          {
            uri: "/inventory/update?locationId=LOC1&skuId=SKU1",
            body: {
              quantity: 50,
              clientSequenceNumber: 1,
              marketplaceAttributes: { marketplaceId: "ATVPDKIKX0DER", channelName: "DEFAULT" },
            },
          },
        ]),
        {} as any,
      );
      const responses = (result.data as any).body.responses;

      expect(responses).toHaveLength(1);
      const resp = responses[0];

      expect(resp.status.statusCode).toBe(200);
      expect(resp.status.reasonPhrase).toBe("Success");
      expect(resp.body.locationId).toBe("LOC1");
      expect(resp.body.skuId).toBe("SKU1");
      expect(resp.body.sellableQuantity).toBe(50);
      expect(resp.body.reservedQuantity).toBe(0);
      expect(resp.body.clientSequenceNumber).toBe(1);
      expect(resp.body.marketplaceAttributes).toEqual({ marketplaceId: "ATVPDKIKX0DER", channelName: "DEFAULT" });
      expect(resp.body.actionableErrors).toEqual([]);
    });

    it("should include all required fields even when marketplaceAttributes is undefined", async () => {
      const result = await batchInventoryHandler(
        makeValidationResult([
          {
            uri: "/inventory/update?locationId=LOC1&skuId=SKU1",
            body: { quantity: 10, clientSequenceNumber: 1 },
          },
        ]),
        {} as any,
      );
      const responses = (result.data as any).body.responses;
      const resp = responses[0];

      expect(resp.status.statusCode).toBe(200);
      expect(resp.body).toHaveProperty("locationId");
      expect(resp.body).toHaveProperty("skuId");
      expect(resp.body).toHaveProperty("sellableQuantity");
      expect(resp.body).toHaveProperty("reservedQuantity");
      expect(resp.body).toHaveProperty("clientSequenceNumber");
      expect(resp.body).toHaveProperty("marketplaceAttributes");
      expect(resp.body).toHaveProperty("actionableErrors");
      expect(resp.body.actionableErrors).toEqual([]);
    });
  });

  // **Validates: Requirements 6.4**
  describe("unexpected error handling (statusCode 500, INTERNAL_ERROR)", () => {
    it("should return per-item 500 INTERNAL_ERROR when DB put throws", async () => {
      mockPut.mockImplementationOnce(() => {
        throw new Error("Simulated DB failure");
      });

      const result = await batchInventoryHandler(
        makeValidationResult([
          {
            uri: "/inventory/update?locationId=LOC1&skuId=SKU1",
            body: { quantity: 10, clientSequenceNumber: 1 },
          },
        ]),
        {} as any,
      );
      const responses = (result.data as any).body.responses;

      expect(responses).toHaveLength(1);
      expect(responses[0].status.statusCode).toBe(500);
      expect(responses[0].status.reasonPhrase).toBe("Internal Server Error");
      expect(responses[0].body.actionableErrors[0].errorType).toBe("INTERNAL_ERROR");
      expect(responses[0].body.actionableErrors[0].errorSubType).toBe("Unexpected processing failure");
    });

    it("should isolate errors — other items in the batch still process correctly", async () => {
      // First call to mockPut throws, second succeeds
      mockPut.mockImplementationOnce(() => {
        throw new Error("Simulated DB failure");
      });

      const result = await batchInventoryHandler(
        makeValidationResult([
          {
            uri: "/inventory/update?locationId=LOC1&skuId=SKU1",
            body: { quantity: 10, clientSequenceNumber: 1 },
          },
          {
            uri: "/inventory/update?locationId=LOC2&skuId=SKU2",
            body: { quantity: 20, clientSequenceNumber: 2 },
          },
        ]),
        {} as any,
      );
      const responses = (result.data as any).body.responses;

      expect(responses).toHaveLength(2);
      // First item should have errored
      expect(responses[0].status.statusCode).toBe(500);
      expect(responses[0].body.actionableErrors[0].errorType).toBe("INTERNAL_ERROR");
      // Second item should have succeeded
      expect(responses[1].status.statusCode).toBe(200);
      expect(responses[1].body.locationId).toBe("LOC2");
      expect(responses[1].body.skuId).toBe("SKU2");
      expect(responses[1].body.sellableQuantity).toBe(20);
    });

    it("should return per-item 500 INTERNAL_ERROR when DB get throws during fetch", async () => {
      mockGet.mockImplementationOnce(() => {
        throw new Error("Simulated DB read failure");
      });

      const result = await batchInventoryHandler(
        makeValidationResult([
          {
            uri: "/inventory/fetch?locationId=LOC1&skuId=SKU1",
          },
        ]),
        {} as any,
      );
      const responses = (result.data as any).body.responses;

      expect(responses).toHaveLength(1);
      expect(responses[0].status.statusCode).toBe(500);
      expect(responses[0].body.actionableErrors[0].errorType).toBe("INTERNAL_ERROR");
    });
  });
});
