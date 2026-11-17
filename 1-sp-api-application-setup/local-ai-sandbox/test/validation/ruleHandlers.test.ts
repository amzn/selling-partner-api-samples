import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeValidation } from "../../src/service/validationEngine.js";
import { RequestContext, ValidationFail, ValidationPipeline } from "../../src/validation/validationTypes.js";
import { VALIDATION_REGISTRY } from "../../src/validation/validationRegistry.js";
import { Api } from "../../src/database/Context.js";
import { buildKey } from "../../src/registry/operationRegistry.js";

// Mutable mock database state — tests can populate this before assertions
const mockDbData: Record<string, Record<string, unknown>> = {};

// Mock the validation registry so we can inject test pipelines
vi.mock("../../src/validation/validationRegistry.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/validation/validationRegistry.js")>();
  return {
    ...original,
    VALIDATION_REGISTRY: new Map(),
  };
});

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
  VALIDATION_REGISTRY.clear();
});

// Test helper constants for composite key
const TEST_API_NAME = "TestApi";
const TEST_API_VERSION = "v1";

// --- entityExistence handler tests ---

describe("entityExistence handler", () => {
  const TEST_OP = "__test_entityExistence__";

  it("passes when entity exists (flat lookup)", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "entityExistence",
        entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path", entityLabel: "order" },
        failAction: { statusCode: 404, code: "NotFound", message: "Order not found" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.ORDERS] = { "order-123": { orderId: "order-123" } };

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: { orderId: "order-123" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("returns 404 when entity does not exist (flat lookup)", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "entityExistence",
        entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path", entityLabel: "order" },
        failAction: { statusCode: 404, code: "NotFound", message: "Order not found" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.ORDERS] = {};

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: { orderId: "nonexistent-123" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(404);
    expect(fail.body.errors[0].message).toContain("order");
    expect(fail.body.errors[0].message).toContain("nonexistent-123");
  });

  it("passes when parent and child both exist (nested)", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "entityExistence",
        entity: { api: Api.EXT_FULFILLMENT_SHIPMENTS, paramName: "shipmentId", paramSource: "path", entityLabel: "shipment" },
        nested: {
          childParamName: "packageId",
          childParamSource: "path",
          childCollection: "packages",
          childIdField: "id",
          childLabel: "package",
        },
        failAction: { statusCode: 404, code: "NotFound", message: "Not found" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.EXT_FULFILLMENT_SHIPMENTS] = {
      "ship-001": { shipmentId: "ship-001", packages: [{ id: "pkg-001" }, { id: "pkg-002" }] },
    };

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: { shipmentId: "ship-001", packageId: "pkg-001" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("returns 404 for missing parent (nested)", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "entityExistence",
        entity: { api: Api.EXT_FULFILLMENT_SHIPMENTS, paramName: "shipmentId", paramSource: "path", entityLabel: "shipment" },
        nested: {
          childParamName: "packageId",
          childParamSource: "path",
          childCollection: "packages",
          childIdField: "id",
          childLabel: "package",
        },
        failAction: { statusCode: 404, code: "NotFound", message: "Not found" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.EXT_FULFILLMENT_SHIPMENTS] = {};

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: { shipmentId: "ship-nonexistent", packageId: "pkg-001" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(404);
    expect(fail.body.errors[0].message).toContain("shipment");
  });

  it("returns 404 for missing child (nested)", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "entityExistence",
        entity: { api: Api.EXT_FULFILLMENT_SHIPMENTS, paramName: "shipmentId", paramSource: "path", entityLabel: "shipment" },
        nested: {
          childParamName: "packageId",
          childParamSource: "path",
          childCollection: "packages",
          childIdField: "id",
          childLabel: "package",
        },
        failAction: { statusCode: 404, code: "NotFound", message: "Not found" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.EXT_FULFILLMENT_SHIPMENTS] = {
      "ship-001": { shipmentId: "ship-001", packages: [{ id: "pkg-002" }] },
    };

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: { shipmentId: "ship-001", packageId: "pkg-nonexistent" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(404);
    expect(fail.body.errors[0].message).toContain("package");
  });

  it("passes when entity ID param is not provided", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "entityExistence",
        entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path", entityLabel: "order" },
        failAction: { statusCode: 404, code: "NotFound", message: "Order not found" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.ORDERS] = {};

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: {},
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });
});

// --- mutualExclusivity handler tests ---

describe("mutualExclusivity handler", () => {
  const TEST_OP = "__test_mutualExclusivity__";

  it("passes when exactly one param is present", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "mutualExclusivity",
        params: [
          { name: "createdAfter", source: "query" },
          { name: "lastUpdatedAfter", source: "query" },
        ],
        failAction: { statusCode: 400, code: "InvalidInput", message: "Mutually exclusive" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: {},
      queryParams: { createdAfter: "2024-01-01" },
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("fails with 400 when zero params are present", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "mutualExclusivity",
        params: [
          { name: "createdAfter", source: "query" },
          { name: "lastUpdatedAfter", source: "query" },
        ],
        failAction: { statusCode: 400, code: "InvalidInput", message: "Mutually exclusive" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: {},
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].message).toContain("createdAfter");
    expect(fail.body.errors[0].message).toContain("lastUpdatedAfter");
  });

  it("fails with 400 when multiple params are present", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "mutualExclusivity",
        params: [
          { name: "createdAfter", source: "query" },
          { name: "lastUpdatedAfter", source: "query" },
        ],
        failAction: { statusCode: 400, code: "InvalidInput", message: "Mutually exclusive" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: {},
      queryParams: { createdAfter: "2024-01-01", lastUpdatedAfter: "2024-02-01" },
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].message).toContain("createdAfter");
    expect(fail.body.errors[0].message).toContain("lastUpdatedAfter");
  });

  it("treats empty string param as absent", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "mutualExclusivity",
        params: [
          { name: "paramA", source: "query" },
          { name: "paramB", source: "query" },
        ],
        failAction: { statusCode: 400, code: "InvalidInput", message: "Mutually exclusive" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: {},
      queryParams: { paramA: "value", paramB: "" },
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });
});

// --- atLeastOneRequired handler tests ---

describe("atLeastOneRequired handler", () => {
  const TEST_OP = "__test_atLeastOneRequired__";

  it("passes when at least one param is present", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "atLeastOneRequired",
        params: [
          { name: "keywords", source: "query" },
          { name: "identifiers", source: "query" },
          { name: "brandNames", source: "query" },
        ],
        failAction: { statusCode: 400, code: "InvalidInput", message: "At least one required" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: {},
      queryParams: { keywords: "laptop" },
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("passes when multiple params are present", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "atLeastOneRequired",
        params: [
          { name: "keywords", source: "query" },
          { name: "identifiers", source: "query" },
        ],
        failAction: { statusCode: 400, code: "InvalidInput", message: "At least one required" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: {},
      queryParams: { keywords: "laptop", identifiers: "B001" },
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("fails with 400 when no params are present", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "atLeastOneRequired",
        params: [
          { name: "keywords", source: "query" },
          { name: "identifiers", source: "query" },
          { name: "brandNames", source: "query" },
        ],
        failAction: { statusCode: 400, code: "InvalidInput", message: "At least one required" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: {},
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].message).toContain("keywords");
    expect(fail.body.errors[0].message).toContain("identifiers");
    expect(fail.body.errors[0].message).toContain("brandNames");
  });

  it("treats empty string params as absent", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "atLeastOneRequired",
        params: [
          { name: "keywords", source: "query" },
          { name: "identifiers", source: "query" },
        ],
        failAction: { statusCode: 400, code: "InvalidInput", message: "At least one required" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: {},
      queryParams: { keywords: "", identifiers: "" },
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
  });
});

// --- conditionalExclusion handler tests ---

describe("conditionalExclusion handler", () => {
  const TEST_OP = "__test_conditionalExclusion__";

  it("passes when trigger is absent", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "conditionalExclusion",
        trigger: { name: "createdAfter", source: "query" },
        forbidden: [{ name: "lastUpdatedAfter", source: "query" }],
        failAction: { statusCode: 400, code: "InvalidInput", message: "Conditional exclusion violated" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: {},
      queryParams: { lastUpdatedAfter: "2024-01-01" },
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("passes when trigger is present but forbidden params are absent", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "conditionalExclusion",
        trigger: { name: "createdAfter", source: "query" },
        forbidden: [
          { name: "lastUpdatedAfter", source: "query" },
          { name: "anotherParam", source: "query" },
        ],
        failAction: { statusCode: 400, code: "InvalidInput", message: "Conditional exclusion violated" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: {},
      queryParams: { createdAfter: "2024-01-01" },
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("fails with 400 when trigger is present and forbidden param is also present", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "conditionalExclusion",
        trigger: { name: "createdAfter", source: "query" },
        forbidden: [{ name: "lastUpdatedAfter", source: "query" }],
        failAction: { statusCode: 400, code: "InvalidInput", message: "Conditional exclusion violated" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: {},
      queryParams: { createdAfter: "2024-01-01", lastUpdatedAfter: "2024-02-01" },
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].message).toContain("createdAfter");
    expect(fail.body.errors[0].message).toContain("lastUpdatedAfter");
  });

  it("passes when trigger is empty string (treated as absent)", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "conditionalExclusion",
        trigger: { name: "createdAfter", source: "query" },
        forbidden: [{ name: "lastUpdatedAfter", source: "query" }],
        failAction: { statusCode: 400, code: "InvalidInput", message: "Conditional exclusion violated" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "GET",
      pathParams: {},
      queryParams: { createdAfter: "", lastUpdatedAfter: "2024-02-01" },
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });
});

// --- businessRule handler tests ---

describe("businessRule handler", () => {
  const TEST_OP = "__test_businessRule__";

  it("fails when condition with 'eq' operator is satisfied (constraint violated)", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "businessRule",
        entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path" },
        condition: { field: "fulfillment.fulfilledBy", operator: "eq", value: "AMAZON" },
        failAction: { statusCode: 400, code: "InvalidInput", message: "FBA orders cannot confirm shipment" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.ORDERS] = {
      "order-123": { orderId: "order-123", fulfillment: { fulfilledBy: "AMAZON" } },
    };

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "POST",
      pathParams: { orderId: "order-123" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].code).toBe("InvalidInput");
  });

  it("passes when condition with 'eq' operator is NOT satisfied", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "businessRule",
        entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path" },
        condition: { field: "fulfillment.fulfilledBy", operator: "eq", value: "AMAZON" },
        failAction: { statusCode: 400, code: "InvalidInput", message: "FBA orders cannot confirm shipment" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.ORDERS] = {
      "order-123": { orderId: "order-123", fulfillment: { fulfilledBy: "MERCHANT" } },
    };

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "POST",
      pathParams: { orderId: "order-123" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("fails when condition with 'neq' operator is satisfied", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "businessRule",
        entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path" },
        condition: { field: "status", operator: "neq", value: "SHIPPED" },
        failAction: { statusCode: 400, code: "InvalidInput", message: "Only shipped orders allowed" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.ORDERS] = {
      "order-456": { orderId: "order-456", status: "PENDING" },
    };

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "POST",
      pathParams: { orderId: "order-456" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
  });

  it("passes when condition with 'neq' operator is NOT satisfied", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "businessRule",
        entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path" },
        condition: { field: "status", operator: "neq", value: "SHIPPED" },
        failAction: { statusCode: 400, code: "InvalidInput", message: "Only shipped orders allowed" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.ORDERS] = {
      "order-456": { orderId: "order-456", status: "SHIPPED" },
    };

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "POST",
      pathParams: { orderId: "order-456" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("fails when condition with 'in' operator is satisfied", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "businessRule",
        entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path" },
        condition: { field: "status", operator: "in", value: ["CANCELLED", "RETURNED"] },
        failAction: { statusCode: 400, code: "InvalidInput", message: "Cannot process cancelled/returned orders" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.ORDERS] = {
      "order-789": { orderId: "order-789", status: "CANCELLED" },
    };

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "POST",
      pathParams: { orderId: "order-789" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
  });

  it("passes when condition with 'in' operator is NOT satisfied", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "businessRule",
        entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path" },
        condition: { field: "status", operator: "in", value: ["CANCELLED", "RETURNED"] },
        failAction: { statusCode: 400, code: "InvalidInput", message: "Cannot process cancelled/returned orders" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.ORDERS] = {
      "order-789": { orderId: "order-789", status: "SHIPPED" },
    };

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "POST",
      pathParams: { orderId: "order-789" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("fails when condition with 'notIn' operator is satisfied", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "businessRule",
        entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path" },
        condition: { field: "status", operator: "notIn", value: ["SHIPPED", "DELIVERED"] },
        failAction: { statusCode: 400, code: "InvalidInput", message: "Order must be shipped or delivered" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.ORDERS] = {
      "order-abc": { orderId: "order-abc", status: "PENDING" },
    };

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "POST",
      pathParams: { orderId: "order-abc" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
  });

  it("passes when condition with 'notIn' operator is NOT satisfied", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "businessRule",
        entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path" },
        condition: { field: "status", operator: "notIn", value: ["SHIPPED", "DELIVERED"] },
        failAction: { statusCode: 400, code: "InvalidInput", message: "Order must be shipped or delivered" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.ORDERS] = {
      "order-abc": { orderId: "order-abc", status: "SHIPPED" },
    };

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "POST",
      pathParams: { orderId: "order-abc" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("skips evaluation (passes) when entity is not found in database", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "businessRule",
        entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path" },
        condition: { field: "fulfillment.fulfilledBy", operator: "eq", value: "AMAZON" },
        failAction: { statusCode: 400, code: "InvalidInput", message: "FBA orders cannot confirm shipment" },
      },
    ];
    VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), pipeline);

    mockDbData[Api.ORDERS] = {};

    const context: RequestContext = {
      apiName: TEST_API_NAME,
      apiVersion: TEST_API_VERSION,
      operationId: TEST_OP,
      method: "POST",
      pathParams: { orderId: "nonexistent-order" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });
});
