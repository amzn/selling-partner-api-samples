import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeValidation } from "../../src/service/validationEngine.js";
import { RequestContext, ValidationPipeline } from "../../src/validation/validationTypes.js";
import { VALIDATION_REGISTRY } from "../../src/validation/validationRegistry.js";
import { Api } from "../../src/database/Context.js";
import { buildKey } from "../../src/registry/operationRegistry.js";

// Mock the validation registry so we can inject test pipelines
vi.mock("../../src/validation/validationRegistry.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/validation/validationRegistry.js")>();
  return {
    ...original,
    VALIDATION_REGISTRY: new Map(),
  };
});

// Mock the Context singleton so database access uses a controlled mock
vi.mock("../../src/database/Context.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/database/Context.js")>();
  const data: Record<string, Record<string, unknown>> = {
    [original.Api.ORDERS]: {
      "order-123": { orderId: "order-123", status: "Shipped" },
      "order-456": { orderId: "order-456", status: "Pending" },
    },
    [original.Api.LISTINGS]: {},
    [original.Api.INVENTORY]: {},
    [original.Api.EXT_FULFILLMENT_INVENTORY]: {},
    [original.Api.EXT_FULFILLMENT_RETURNS]: {},
    [original.Api.EXT_FULFILLMENT_SHIPMENTS]: {},
    [original.Api.CATALOG]: {},
    [original.Api.PRICING]: {},
    [original.Api.REPORTS]: {},
  };
  return {
    ...original,
    Context: {
      get instance() {
        return {
          engine: {
            get: (api: string, key: string) => data[api]?.[key] ?? null,
          },
        };
      },
    },
  };
});

describe("buildKey", () => {
  it('returns "Orders:v0:confirmShipment" for apiName="Orders", apiVersion="v0", operationId="confirmShipment"', () => {
    expect(buildKey("Orders", "v0", "confirmShipment")).toBe("Orders:v0:confirmShipment");
  });

  it('returns "Orders:2026-01-01:getOrder" for apiName="Orders", apiVersion="2026-01-01", operationId="getOrder"', () => {
    expect(buildKey("Orders", "2026-01-01", "getOrder")).toBe("Orders:2026-01-01:getOrder");
  });

  it("handles empty strings", () => {
    expect(buildKey("", "", "")).toBe("::");
    expect(buildKey("Orders", "", "getOrder")).toBe("Orders::getOrder");
    expect(buildKey("", "v0", "")).toBe(":v0:");
  });

  it("handles special characters in components", () => {
    expect(buildKey("Catalog Items", "2022-04-01", "searchCatalogItems")).toBe("Catalog Items:2022-04-01:searchCatalogItems");
    expect(buildKey("External Fulfillment Shipments", "2024-09-11", "getShipment")).toBe(
      "External Fulfillment Shipments:2024-09-11:getShipment",
    );
  });

  it("preserves colons within components (no escaping)", () => {
    // Edge case: if a component itself contains a colon, it still concatenates with colons
    expect(buildKey("Api:Name", "v:1", "op:Id")).toBe("Api:Name:v:1:op:Id");
  });
});

describe("Three-part composite key lookup via executeValidation", () => {
  beforeEach(() => {
    VALIDATION_REGISTRY.clear();
  });

  it("finds the correct pipeline for a known apiName + apiVersion + operationId", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.ORDERS,
          paramName: "orderId",
          paramSource: "path",
          entityLabel: "order",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Order not found",
        },
      },
    ];

    VALIDATION_REGISTRY.set(buildKey("Orders", "v0", "getOrder"), pipeline);

    // Request with an existing order should pass
    const context: RequestContext = {
      apiName: "Orders",
      apiVersion: "v0",
      operationId: "getOrder",
      method: "GET",
      pathParams: { orderId: "order-123" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(true);
  });

  it("returns pass when apiVersion does not match but apiName and operationId are known", async () => {
    const pipeline: ValidationPipeline = [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.ORDERS,
          paramName: "orderId",
          paramSource: "path",
          entityLabel: "order",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Order not found",
        },
      },
    ];

    // Register pipeline only for v0
    VALIDATION_REGISTRY.set(buildKey("Orders", "v0", "getOrder"), pipeline);

    // Request with unknown apiVersion — should fail (no pipeline found)
    const context: RequestContext = {
      apiName: "Orders",
      apiVersion: "2099-01-01",
      operationId: "getOrder",
      method: "GET",
      pathParams: { orderId: "nonexistent-order" },
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.statusCode).toBe(501);
      expect(result.body?.errors[0].code).toBe("NoValidationPipeline");
    }
  });

  it("same operationId under different apiName:apiVersion combos resolves to different pipelines", async () => {
    // Pipeline for Orders:v0:getOrder — uses entityExistence with "order" label
    const pipelineV0: ValidationPipeline = [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.ORDERS,
          paramName: "orderId",
          paramSource: "path",
          entityLabel: "order",
        },
        failAction: {
          statusCode: 404,
          code: "NotFoundV0",
          message: "Order not found (v0)",
        },
      },
    ];

    // Pipeline for Orders:2026-01-01:getOrder — uses atLeastOneRequired as a distinct pipeline
    const pipeline2026: ValidationPipeline = [
      {
        checkType: "atLeastOneRequired",
        params: [{ name: "orderId", source: "path" }],
        failAction: {
          statusCode: 400,
          code: "MissingParam2026",
          message: "orderId is required (2026-01-01)",
        },
      },
    ];

    VALIDATION_REGISTRY.set(buildKey("Orders", "v0", "getOrder"), pipelineV0);
    VALIDATION_REGISTRY.set(buildKey("Orders", "2026-01-01", "getOrder"), pipeline2026);

    // Verify the registry has distinct entries
    expect(VALIDATION_REGISTRY.get(buildKey("Orders", "v0", "getOrder"))).toBe(pipelineV0);
    expect(VALIDATION_REGISTRY.get(buildKey("Orders", "2026-01-01", "getOrder"))).toBe(pipeline2026);
    expect(VALIDATION_REGISTRY.get(buildKey("Orders", "v0", "getOrder"))).not.toBe(pipeline2026);

    // Execute v0 with a non-existent order — should fail with NotFoundV0
    const contextV0: RequestContext = {
      apiName: "Orders",
      apiVersion: "v0",
      operationId: "getOrder",
      method: "GET",
      pathParams: { orderId: "nonexistent" },
      queryParams: {},
      body: undefined,
    };

    const resultV0 = await executeValidation(contextV0);
    expect(resultV0.pass).toBe(false);
    if (!resultV0.pass) {
      expect(resultV0.statusCode).toBe(404);
      expect(resultV0.body.errors[0].code).toBe("NotFoundV0");
    }

    // Execute 2026-01-01 with orderId present — should pass (atLeastOneRequired satisfied)
    const context2026: RequestContext = {
      apiName: "Orders",
      apiVersion: "2026-01-01",
      operationId: "getOrder",
      method: "GET",
      pathParams: { orderId: "any-value" },
      queryParams: {},
      body: undefined,
    };

    const result2026 = await executeValidation(context2026);
    expect(result2026.pass).toBe(true);

    // Execute 2026-01-01 without orderId — should fail with MissingParam2026
    const context2026NoId: RequestContext = {
      apiName: "Orders",
      apiVersion: "2026-01-01",
      operationId: "getOrder",
      method: "GET",
      pathParams: {},
      queryParams: {},
      body: undefined,
    };

    const result2026NoId = await executeValidation(context2026NoId);
    expect(result2026NoId.pass).toBe(false);
    if (!result2026NoId.pass) {
      expect(result2026NoId.statusCode).toBe(400);
      expect(result2026NoId.body.errors[0].code).toBe("MissingParam2026");
    }
  });

  it("different apiName with same apiVersion and operationId resolves to different pipelines", async () => {
    // Two distinct APIs with same version and operationId
    const pipelineOrdersGet: ValidationPipeline = [
      {
        checkType: "atLeastOneRequired",
        params: [{ name: "orderId", source: "path" }],
        failAction: {
          statusCode: 400,
          code: "OrdersPipelineCode",
          message: "Orders pipeline triggered",
        },
      },
    ];

    const pipelineListingsGet: ValidationPipeline = [
      {
        checkType: "atLeastOneRequired",
        params: [{ name: "sku", source: "path" }],
        failAction: {
          statusCode: 400,
          code: "ListingsPipelineCode",
          message: "Listings pipeline triggered",
        },
      },
    ];

    VALIDATION_REGISTRY.set(buildKey("Orders", "v1", "getItem"), pipelineOrdersGet);
    VALIDATION_REGISTRY.set(buildKey("Listings", "v1", "getItem"), pipelineListingsGet);

    // Orders:v1:getItem without orderId should fail with OrdersPipelineCode
    const ordersContext: RequestContext = {
      apiName: "Orders",
      apiVersion: "v1",
      operationId: "getItem",
      method: "GET",
      pathParams: {},
      queryParams: {},
      body: undefined,
    };

    const ordersResult = await executeValidation(ordersContext);
    expect(ordersResult.pass).toBe(false);
    if (!ordersResult.pass) {
      expect(ordersResult.body.errors[0].code).toBe("OrdersPipelineCode");
    }

    // Listings:v1:getItem without sku should fail with ListingsPipelineCode
    const listingsContext: RequestContext = {
      apiName: "Listings",
      apiVersion: "v1",
      operationId: "getItem",
      method: "GET",
      pathParams: {},
      queryParams: {},
      body: undefined,
    };

    const listingsResult = await executeValidation(listingsContext);
    expect(listingsResult.pass).toBe(false);
    if (!listingsResult.pass) {
      expect(listingsResult.body.errors[0].code).toBe("ListingsPipelineCode");
    }
  });
});
