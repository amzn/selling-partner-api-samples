import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeValidation } from "../../src/service/validationEngine.js";
import { RequestContext, ValidationFail, ValidationPass, ValidationPipeline } from "../../src/validation/validationTypes.js";
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
  for (const api of Object.values(Api)) {
    mockDbData[api] = {};
  }
  VALIDATION_REGISTRY.clear();
});

const TEST_API_NAME = "TestApi";
const TEST_API_VERSION = "v1";

describe("resolvedEntities behavior", () => {
  describe("entityExistence handler returns resolved entity data", () => {
    it("returns resolved entity data on flat pass", async () => {
      const operationId = "__resolvedEntities_flat__";
      const pipeline: ValidationPipeline = [
        {
          checkType: "entityExistence",
          entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path", entityLabel: "order" },
          failAction: { statusCode: 404, code: "NotFound", message: "Order not found" },
        },
      ];
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, operationId), pipeline);

      mockDbData[Api.ORDERS] = {
        "order-100": { orderId: "order-100", status: "Shipped", amount: 99.99 },
      };

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId,
        method: "GET",
        pathParams: { orderId: "order-100" },
        queryParams: {},
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
      const passResult = result as ValidationPass;
      expect(passResult.resolvedEntities).toHaveProperty("order");
      expect(passResult.resolvedEntities["order"]).toEqual({ orderId: "order-100", status: "Shipped", amount: 99.99 });
    });

    it("returns both parent and child on nested pass", async () => {
      const operationId = "__resolvedEntities_nested__";
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
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, operationId), pipeline);

      mockDbData[Api.EXT_FULFILLMENT_SHIPMENTS] = {
        "ship-001": { shipmentId: "ship-001", carrier: "UPS", packages: [{ id: "pkg-A", weight: 5 }, { id: "pkg-B", weight: 10 }] },
      };

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId,
        method: "GET",
        pathParams: { shipmentId: "ship-001", packageId: "pkg-A" },
        queryParams: {},
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
      const passResult = result as ValidationPass;
      expect(passResult.resolvedEntities).toHaveProperty("shipment");
      expect(passResult.resolvedEntities).toHaveProperty("package");
      expect(passResult.resolvedEntities["shipment"]).toEqual({ shipmentId: "ship-001", carrier: "UPS", packages: [{ id: "pkg-A", weight: 5 }, { id: "pkg-B", weight: 10 }] });
      expect(passResult.resolvedEntities["package"]).toEqual({ id: "pkg-A", weight: 5 });
    });

    it("returns empty resolvedEntities when entity ID is absent", async () => {
      const operationId = "__resolvedEntities_absent_id__";
      const pipeline: ValidationPipeline = [
        {
          checkType: "entityExistence",
          entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path", entityLabel: "order" },
          failAction: { statusCode: 404, code: "NotFound", message: "Order not found" },
        },
      ];
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, operationId), pipeline);

      mockDbData[Api.ORDERS] = { "order-xyz": { orderId: "order-xyz" } };

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId,
        method: "GET",
        pathParams: {},
        queryParams: {},
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
      const passResult = result as ValidationPass;
      expect(passResult.resolvedEntities).toEqual({});
    });
  });

  describe("executeValidation accumulates resolvedEntities", () => {
    it("accumulates resolvedEntities across multiple passing entity rules", async () => {
      const operationId = "__resolvedEntities_accumulate__";
      const pipeline: ValidationPipeline = [
        {
          checkType: "entityExistence",
          entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path", entityLabel: "order" },
          failAction: { statusCode: 404, code: "NotFound", message: "Order not found" },
        },
        {
          checkType: "entityExistence",
          entity: { api: Api.LISTINGS, paramName: "sku", paramSource: "query", entityLabel: "listing" },
          failAction: { statusCode: 404, code: "NotFound", message: "Listing not found" },
        },
      ];
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, operationId), pipeline);

      mockDbData[Api.ORDERS] = {
        "order-200": { orderId: "order-200", status: "Pending" },
      };
      mockDbData[Api.LISTINGS] = {
        "SKU-ABC": { sku: "SKU-ABC", title: "Widget" },
      };

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId,
        method: "GET",
        pathParams: { orderId: "order-200" },
        queryParams: { sku: "SKU-ABC" },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
      const passResult = result as ValidationPass;
      expect(passResult.resolvedEntities).toHaveProperty("order");
      expect(passResult.resolvedEntities).toHaveProperty("listing");
      expect(passResult.resolvedEntities["order"]).toEqual({ orderId: "order-200", status: "Pending" });
      expect(passResult.resolvedEntities["listing"]).toEqual({ sku: "SKU-ABC", title: "Widget" });
    });

    it("returns empty resolvedEntities for pipelines with only parameter constraint rules", async () => {
      const operationId = "__resolvedEntities_param_only__";
      const pipeline: ValidationPipeline = [
        {
          checkType: "atLeastOneRequired",
          params: [
            { name: "keywords", source: "query" },
            { name: "identifiers", source: "query" },
          ],
          failAction: { statusCode: 400, code: "InvalidInput", message: "At least one required" },
        },
        {
          checkType: "mutualExclusivity",
          params: [
            { name: "filterA", source: "query" },
            { name: "filterB", source: "query" },
          ],
          failAction: { statusCode: 400, code: "InvalidInput", message: "Mutually exclusive" },
        },
      ];
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, operationId), pipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId,
        method: "GET",
        pathParams: {},
        queryParams: { keywords: "laptop", filterA: "value" },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
      const passResult = result as ValidationPass;
      expect(passResult.resolvedEntities).toEqual({});
    });

    it("returns failure when no pipeline is registered", async () => {
      const context: RequestContext = {
        apiName: "UnknownApi",
        apiVersion: "v99",
        operationId: "unregisteredOperation_xyz_99999",
        method: "GET",
        pathParams: {},
        queryParams: {},
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const failResult = result as ValidationFail;
      expect(failResult.statusCode).toBe(501);
      expect(failResult.body?.errors[0].code).toBe("NoValidationPipeline");
    });
  });

  describe("businessRule handler reads from resolvedEntities", () => {
    it("reads entity from resolvedEntities instead of re-querying DB when available", async () => {
      const operationId = "__resolvedEntities_business_rule__";
      // Pipeline: entityExistence resolves order, then businessRule uses it
      const pipeline: ValidationPipeline = [
        {
          checkType: "entityExistence",
          entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path", entityLabel: "order" },
          failAction: { statusCode: 404, code: "NotFound", message: "Order not found" },
        },
        {
          checkType: "businessRule",
          entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path" },
          condition: { field: "fulfillment.fulfilledBy", operator: "eq", value: "AMAZON" },
          failAction: { statusCode: 400, code: "InvalidInput", message: "FBA orders cannot confirm shipment" },
        },
      ];
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, operationId), pipeline);

      // Put entity in DB with MERCHANT fulfillment (should pass business rule)
      mockDbData[Api.ORDERS] = {
        "order-300": { orderId: "order-300", fulfillment: { fulfilledBy: "MERCHANT" } },
      };

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId,
        method: "POST",
        pathParams: { orderId: "order-300" },
        queryParams: {},
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);

      // Now remove the entity from the DB — the business rule should still work
      // because it reads from resolvedEntities populated by the prior entityExistence rule
      mockDbData[Api.ORDERS] = {};

      const result2 = await executeValidation(context);
      // Without resolvedEntities, the entityExistence rule itself will fail (404)
      // because the entity is no longer in the DB
      expect(result2.pass).toBe(false);
    });

    it("businessRule uses resolvedEntities data and correctly evaluates condition", async () => {
      const operationId = "__resolvedEntities_biz_eval__";
      // Pipeline: entityExistence resolves order, then businessRule checks it
      const pipeline: ValidationPipeline = [
        {
          checkType: "entityExistence",
          entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path", entityLabel: "order" },
          failAction: { statusCode: 404, code: "NotFound", message: "Order not found" },
        },
        {
          checkType: "businessRule",
          entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path" },
          condition: { field: "fulfillment.fulfilledBy", operator: "eq", value: "AMAZON" },
          failAction: { statusCode: 400, code: "InvalidInput", message: "FBA orders cannot confirm shipment" },
        },
      ];
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, operationId), pipeline);

      // Entity is FBA — business rule condition IS satisfied → should fail
      mockDbData[Api.ORDERS] = {
        "order-400": { orderId: "order-400", fulfillment: { fulfilledBy: "AMAZON" } },
      };

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId,
        method: "POST",
        pathParams: { orderId: "order-400" },
        queryParams: {},
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
    });
  });

  describe("last-write-wins semantics", () => {
    it("later entity existence rule overwrites earlier entry with same label", async () => {
      const operationId = "__resolvedEntities_lastwrite__";
      // Two entityExistence rules with the same entityLabel "order" but pointing to different APIs/entities
      const pipeline: ValidationPipeline = [
        {
          checkType: "entityExistence",
          entity: { api: Api.ORDERS, paramName: "orderId", paramSource: "path", entityLabel: "order" },
          failAction: { statusCode: 404, code: "NotFound", message: "Order not found" },
        },
        {
          checkType: "entityExistence",
          entity: { api: Api.LISTINGS, paramName: "listingId", paramSource: "query", entityLabel: "order" },
          failAction: { statusCode: 404, code: "NotFound", message: "Listing not found" },
        },
      ];
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, operationId), pipeline);

      mockDbData[Api.ORDERS] = {
        "order-first": { orderId: "order-first", source: "first-rule" },
      };
      mockDbData[Api.LISTINGS] = {
        "listing-second": { listingId: "listing-second", source: "second-rule" },
      };

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId,
        method: "GET",
        pathParams: { orderId: "order-first" },
        queryParams: { listingId: "listing-second" },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
      const passResult = result as ValidationPass;
      // The second rule overwrites the "order" key with its entity data
      expect(passResult.resolvedEntities["order"]).toEqual({ listingId: "listing-second", source: "second-rule" });
      // Confirm that the first rule's data is NOT present
      expect(passResult.resolvedEntities["order"]).not.toHaveProperty("orderId");
    });
  });
});
