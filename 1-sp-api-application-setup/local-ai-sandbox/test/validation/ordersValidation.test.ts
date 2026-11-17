import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeValidation } from "../../src/service/validationEngine.js";
import { RequestContext, ValidationFail, ValidationPass } from "../../src/validation/validationTypes.js";
import { Api } from "../../src/database/Context.js";
import { VALIDATION_REGISTRY } from "../../src/validation/validationRegistry.js";

// Mutable mock database state — tests can populate this before assertions
const mockDbData: Record<string, Record<string, unknown>> = {};

// Mock the Context singleton so database access uses our mutable mockDbData
vi.mock("../../src/database/Context.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/database/Context.js")>();
  return {
    ...original,
    Context: {
      get instance() {
        return {
          engine: {
            get: (api: string, key: string) => mockDbData[api]?.[key] ?? null,
          },
        };
      },
    },
  };
});

beforeEach(() => {
  // Reset all API partitions in mock database
  for (const api of Object.values(Api)) {
    mockDbData[api] = {};
  }
});

// --- searchOrders validation pipeline integration tests ---

describe("searchOrders validation pipeline", () => {
  function buildSearchOrdersContext(queryParams: Record<string, string | undefined>): RequestContext {
    const filteredParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        filteredParams[key] = value;
      }
    }
    return {
      apiName: "Orders",
      apiVersion: "2026-01-01",
      operationId: "searchOrders",
      method: "GET",
      pathParams: {},
      queryParams: filteredParams,
      body: undefined,
    };
  }

  it("returns 400 when both createdAfter and lastUpdatedAfter are present (mutualExclusivity)", async () => {
    const context = buildSearchOrdersContext({
      createdAfter: "2024-01-01T00:00:00Z",
      lastUpdatedAfter: "2024-02-01T00:00:00Z",
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].code).toBe("InvalidInput");
    expect(fail.body.errors[0].message).toContain("mutually exclusive");
  });

  it("returns 400 when no date filters are present (atLeastOneRequired)", async () => {
    const context = buildSearchOrdersContext({});

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].code).toBe("InvalidInput");
  });

  it("passes with valid single date filter (createdAfter only)", async () => {
    const context = buildSearchOrdersContext({
      createdAfter: "2024-01-01T00:00:00Z",
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("passes with valid single date filter (lastUpdatedAfter only)", async () => {
    const context = buildSearchOrdersContext({
      lastUpdatedAfter: "2024-03-15T00:00:00Z",
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("returns 400 when createdAfter is after createdBefore (invalid date ordering)", async () => {
    const context = buildSearchOrdersContext({
      createdAfter: "2024-06-01T00:00:00Z",
      createdBefore: "2024-01-01T00:00:00Z",
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].code).toBe("InvalidInput");
    expect(fail.body.errors[0].message).toContain("createdAfter");
    expect(fail.body.errors[0].message).toContain("createdBefore");
  });

  it("returns 400 when createdAfter contains an unparseable date value", async () => {
    const context = buildSearchOrdersContext({
      createdAfter: "not-a-date",
      createdBefore: "2024-06-01T00:00:00Z",
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].code).toBe("InvalidInput");
    expect(fail.body.errors[0].message).toContain("unparseable date");
  });

  it("returns 400 when createdBefore contains an unparseable date value", async () => {
    const context = buildSearchOrdersContext({
      createdAfter: "2024-01-01T00:00:00Z",
      createdBefore: "invalid-date-string",
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].code).toBe("InvalidInput");
    expect(fail.body.errors[0].message).toContain("unparseable date");
  });

  it("passes when createdBefore is absent (skips date comparison)", async () => {
    const context = buildSearchOrdersContext({
      createdAfter: "2024-01-01T00:00:00Z",
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
    const pass = result as ValidationPass;
    expect(pass.resolvedEntities).toBeDefined();
  });

  it("passes when createdAfter equals createdBefore (beforeOrEqual)", async () => {
    const context = buildSearchOrdersContext({
      createdAfter: "2024-03-15T00:00:00Z",
      createdBefore: "2024-03-15T00:00:00Z",
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("passes when createdAfter is before createdBefore", async () => {
    const context = buildSearchOrdersContext({
      createdAfter: "2024-01-01T00:00:00Z",
      createdBefore: "2024-06-01T00:00:00Z",
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("returns 400 when lastUpdatedAfter is after lastUpdatedBefore (invalid date ordering)", async () => {
    const context = buildSearchOrdersContext({
      lastUpdatedAfter: "2024-06-01T00:00:00Z",
      lastUpdatedBefore: "2024-01-01T00:00:00Z",
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].code).toBe("InvalidInput");
    expect(fail.body.errors[0].message).toContain("lastUpdatedAfter");
    expect(fail.body.errors[0].message).toContain("lastUpdatedBefore");
  });

  it("passes when lastUpdatedBefore is absent (skips date comparison)", async () => {
    const context = buildSearchOrdersContext({
      lastUpdatedAfter: "2024-01-01T00:00:00Z",
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
    const pass = result as ValidationPass;
    expect(pass.resolvedEntities).toBeDefined();
  });
});


// --- getOrder validation pipeline integration tests ---

describe("getOrder validation pipeline", () => {
  const TEST_ORDER_ID = "test-order-get-001";
  const TEST_ORDER = {
    orderId: TEST_ORDER_ID,
    fulfillment: { fulfilledBy: "MERCHANT", fulfillmentStatus: "SHIPPED" },
  };

  it("returns 404 when order does not exist", async () => {
    mockDbData[Api.ORDERS] = {};

    const context: RequestContext = {
      apiName: "Orders",
      apiVersion: "2026-01-01",
      operationId: "getOrder",
      method: "GET",
      pathParams: { orderId: "nonexistent-order-id" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);

    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(404);
    expect(fail.body.errors[0].code).toBe("NotFound");
    expect(fail.body.errors[0].message).toContain("order");
    expect(fail.body.errors[0].message).toContain("nonexistent-order-id");
  });

  it("passes with resolved entity when order exists", async () => {
    mockDbData[Api.ORDERS] = { [TEST_ORDER_ID]: TEST_ORDER };

    const context: RequestContext = {
      apiName: "Orders",
      apiVersion: "2026-01-01",
      operationId: "getOrder",
      method: "GET",
      pathParams: { orderId: TEST_ORDER_ID },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);

    expect(result.pass).toBe(true);
    const pass = result as ValidationPass;
    expect(pass.resolvedEntities).toBeDefined();
    expect(pass.resolvedEntities["order"]).toBeDefined();
    expect(pass.resolvedEntities["order"].orderId).toBe(TEST_ORDER_ID);
  });

  it("pipeline has exactly 1 rule (entityExistence)", async () => {
    // Import the registry to check pipeline structure
    const { VALIDATION_REGISTRY } = await import("../../src/validation/validationRegistry.js");
    const pipeline = VALIDATION_REGISTRY.get("Orders:2026-01-01:getOrder");

    expect(pipeline).toBeDefined();
    expect(pipeline!.length).toBe(1);
    expect(pipeline![0].checkType).toBe("entityExistence");
  });
});


// --- confirmShipment orderItemId and quantity validation integration tests ---

describe("confirmShipment orderItemId and quantity validation", () => {
  const TEST_ORDER_ID = "test-order-confirm-001";

  const VALID_ORDER = {
    orderId: TEST_ORDER_ID,
    fulfillment: { fulfilledBy: "MERCHANT", fulfillmentStatus: "UNSHIPPED" },
    orderItems: [
      { orderItemId: "item-001", quantityOrdered: 5 },
      { orderItemId: "item-002", quantityOrdered: 3 },
    ],
  };

  function buildConfirmShipmentContext(orderId: string, body?: Record<string, unknown>): RequestContext {
    return {
      apiName: "Orders",
      apiVersion: "v0",
      operationId: "confirmShipment",
      method: "POST",
      pathParams: { orderId },
      queryParams: {},
      body,
    };
  }

  it("returns 400 InvalidInput when orderItemId is not present in the resolved order", async () => {
    mockDbData[Api.ORDERS] = { [TEST_ORDER_ID]: VALID_ORDER };

    const context = buildConfirmShipmentContext(TEST_ORDER_ID, {
      packageDetail: {
        orderItems: [{ orderItemId: "nonexistent-item-999", quantity: 1 }],
      },
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].code).toBe("InvalidInput");
    expect(fail.body.errors[0].message).toContain("nonexistent-item-999");
    expect(fail.body.errors[0].message).toContain("not found");
  });

  it("returns 400 InvalidInput when quantity exceeds quantityOrdered", async () => {
    mockDbData[Api.ORDERS] = { [TEST_ORDER_ID]: VALID_ORDER };

    const context = buildConfirmShipmentContext(TEST_ORDER_ID, {
      packageDetail: {
        orderItems: [{ orderItemId: "item-001", quantity: 10 }],
      },
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].code).toBe("InvalidInput");
    expect(fail.body.errors[0].message).toContain("item-001");
    expect(fail.body.errors[0].message).toContain("exceeds");
  });

  it("passes validation with valid orderItemId and quantity ≤ quantityOrdered", async () => {
    mockDbData[Api.ORDERS] = { [TEST_ORDER_ID]: VALID_ORDER };

    const context = buildConfirmShipmentContext(TEST_ORDER_ID, {
      packageDetail: {
        orderItems: [
          { orderItemId: "item-001", quantity: 3 },
          { orderItemId: "item-002", quantity: 2 },
        ],
      },
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
    const pass = result as ValidationPass;
    expect(pass.resolvedEntities).toBeDefined();
    expect(pass.resolvedEntities["order"]).toBeDefined();
    expect(pass.resolvedEntities["order"].orderId).toBe(TEST_ORDER_ID);
  });

  it("short-circuits with 404 when order does not exist (entityExistence fails before orderItemId/quantity checks)", async () => {
    mockDbData[Api.ORDERS] = {};

    const context = buildConfirmShipmentContext("nonexistent-order", {
      packageDetail: {
        orderItems: [{ orderItemId: "any-item", quantity: 1 }],
      },
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(404);
    expect(fail.body.errors[0].code).toBe("NotFound");
  });

  it("short-circuits with 400 FBA error when order is FBA (fails before orderItemId/quantity checks)", async () => {
    const fbaOrder = {
      orderId: TEST_ORDER_ID,
      fulfillment: { fulfilledBy: "AMAZON", fulfillmentStatus: "UNSHIPPED" },
      orderItems: [{ orderItemId: "item-001", quantityOrdered: 5 }],
    };
    mockDbData[Api.ORDERS] = { [TEST_ORDER_ID]: fbaOrder };

    const context = buildConfirmShipmentContext(TEST_ORDER_ID, {
      packageDetail: {
        orderItems: [{ orderItemId: "item-001", quantity: 1 }],
      },
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].code).toBe("InvalidInput");
    expect(fail.body.errors[0].message).toContain("FBA");
  });

  it("short-circuits with 400 status error when order has non-shippable status (fails before orderItemId/quantity checks)", async () => {
    const shippedOrder = {
      orderId: TEST_ORDER_ID,
      fulfillment: { fulfilledBy: "MERCHANT", fulfillmentStatus: "SHIPPED" },
      orderItems: [{ orderItemId: "item-001", quantityOrdered: 5 }],
    };
    mockDbData[Api.ORDERS] = { [TEST_ORDER_ID]: shippedOrder };

    const context = buildConfirmShipmentContext(TEST_ORDER_ID, {
      packageDetail: {
        orderItems: [{ orderItemId: "item-001", quantity: 1 }],
      },
    });

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].code).toBe("InvalidInput");
    expect(fail.body.errors[0].message).toContain("UNSHIPPED");
    expect(fail.body.errors[0].message).toContain("PARTIALLY_SHIPPED");
  });

  it("confirmShipment pipeline has 5 rules in correct order: entityExistence, businessRule(FBA), businessRule(status), orderItemExistence, quantityLimit", () => {
    const pipeline = VALIDATION_REGISTRY.get("Orders:v0:confirmShipment");

    expect(pipeline).toBeDefined();
    expect(pipeline!.length).toBe(5);
    expect(pipeline![0].checkType).toBe("entityExistence");
    expect(pipeline![1].checkType).toBe("businessRule");
    expect(pipeline![2].checkType).toBe("businessRule");
    expect(pipeline![3].checkType).toBe("orderItemExistence");
    expect(pipeline![4].checkType).toBe("quantityLimit");
  });
});
