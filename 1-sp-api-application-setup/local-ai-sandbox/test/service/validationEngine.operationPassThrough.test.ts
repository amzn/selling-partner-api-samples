import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request } from "express";

// Mock openapi-enforcer
const mockEnforcerRequest = vi.fn();
const mockEnforcer = vi.fn();
vi.mock("openapi-enforcer", () => ({
  default: (...args: unknown[]) => mockEnforcer(...args),
}));

// Mock apiSchemaIdentificationService
const mockIdentifyApiModel = vi.fn();
const mockIdentifyApiName = vi.fn();
const mockIdentifyApiVersion = vi.fn();
vi.mock("../../src/service/apiSchemaIdentificationService.js", () => ({
  identifyApiModel: (...args: unknown[]) => mockIdentifyApiModel(...args),
  identifyApiName: (...args: unknown[]) => mockIdentifyApiName(...args),
  identifyApiVersion: (...args: unknown[]) => mockIdentifyApiVersion(...args),
}));

// Mock the validation registry to return empty pipeline (isolate schema validation behavior)
vi.mock("../../src/validation/validationRegistry.js", () => {
  const emptyPipelineMap = new Map<string, never[]>();
  return {
    buildValidationKey: (apiName: string, apiVersion: string, operationId: string) => `${apiName}:${apiVersion}:${operationId}`,
    VALIDATION_REGISTRY: new Proxy(emptyPipelineMap, {
      get(target, prop) {
        if (prop === "get") return () => [];
        return Reflect.get(target, prop);
      },
    }),
  };
});

// Mock the Context singleton
vi.mock("../../src/database/Context.js", () => ({
  Context: {
    get instance() {
      return { db: { data: {} } };
    },
  },
  Api: {},
}));

import { validateRequest } from "../../src/service/validationEngine.js";

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    path: "/orders/v0/orders/123-456",
    query: {},
    headers: {},
    body: undefined,
    ...overrides,
  } as unknown as Request;
}

describe("Operation Object Pass-Through (Requirements 13.1, 13.2, 13.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("performSchemaValidation returns the full value.operation object on success", () => {
    it("includes the operation object from openapi-enforcer in the unified pass result", async () => {
      const fullOperationObject = {
        operationId: "getOrder",
        responses: {
          "200": {
            description: "Success",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "404": {
            description: "Not Found",
          },
        },
        parameters: [
          { name: "orderId", in: "path", required: true, schema: { type: "string" } },
          { name: "marketplaceIds", in: "query", required: true, schema: { type: "array", items: { type: "string" } } },
        ],
        summary: "Returns the order for the specified order ID",
        tags: ["ordersV0"],
      };

      mockIdentifyApiModel.mockReturnValue("ordersV0.json");
      mockIdentifyApiName.mockReturnValue("Orders");
      mockIdentifyApiVersion.mockReturnValue("v0");

      const enforcerInstance = { request: mockEnforcerRequest };
      mockEnforcer.mockResolvedValue(enforcerInstance);
      mockEnforcerRequest.mockReturnValue([
        {
          operation: fullOperationObject,
          path: { orderId: "123-456" },
          query: { marketplaceIds: ["ATVPDKIKX0DER"] },
        },
        undefined,
      ]);

      const request = createMockRequest({ path: "/orders/v0/orders/123-456" });
      const result = await validateRequest(request);

      expect(result.pass).toBe(true);
      if (result.pass) {
        expect(result.operation).toBe(fullOperationObject);
      }
    });
  });

  describe("operation object is the same reference returned by the enforcer (not copied or filtered)", () => {
    it("returns the exact same object reference without modification", async () => {
      const operationFromEnforcer = {
        operationId: "searchCatalogItems",
        responses: {
          "200": { description: "Success", content: { "application/json": { schema: { "$ref": "#/components/schemas/ItemSearchResults" } } } },
          "400": { description: "Bad Request" },
        },
        parameters: [
          { name: "keywords", in: "query", required: true, schema: { type: "array", items: { type: "string" } } },
          { name: "marketplaceIds", in: "query", required: true, schema: { type: "array", items: { type: "string" } } },
        ],
        description: "Search for catalog items",
        "x-custom-metadata": { rateLimit: 5 },
      };

      mockIdentifyApiModel.mockReturnValue("catalogItems_2022-04-01.json");
      mockIdentifyApiName.mockReturnValue("Catalog Items");
      mockIdentifyApiVersion.mockReturnValue("2022-04-01");

      const enforcerInstance = { request: mockEnforcerRequest };
      mockEnforcer.mockResolvedValue(enforcerInstance);
      mockEnforcerRequest.mockReturnValue([
        {
          operation: operationFromEnforcer,
          path: {},
          query: { keywords: ["laptop"], marketplaceIds: ["ATVPDKIKX0DER"] },
        },
        undefined,
      ]);

      const request = createMockRequest({
        path: "/catalog/2022-04-01/items",
        query: { keywords: "laptop", marketplaceIds: "ATVPDKIKX0DER" },
      });
      const result = await validateRequest(request);

      expect(result.pass).toBe(true);
      if (result.pass) {
        // Verify it is the SAME reference (identity check, not deep equality)
        expect(result.operation).toBe(operationFromEnforcer);
        // Verify no properties were removed or transformed
        expect(result.operation).toStrictEqual(operationFromEnforcer);
      }
    });
  });

  describe("operation object contains expected OpenAPI properties without filtering", () => {
    it("preserves responses, parameters, and operationId properties from the enforcer result", async () => {
      const operationWithFullMetadata = {
        operationId: "getListingsItem",
        responses: {
          "200": {
            description: "Successfully retrieved listings item",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { sku: { type: "string" }, summaries: { type: "array" } },
                },
              },
            },
          },
          "400": { description: "Bad request" },
          "403": { description: "Forbidden" },
          "404": { description: "Not found" },
        },
        parameters: [
          { name: "sellerId", in: "path", required: true, schema: { type: "string" } },
          { name: "sku", in: "path", required: true, schema: { type: "string" } },
          { name: "marketplaceIds", in: "query", required: true, schema: { type: "array" } },
          { name: "includedData", in: "query", required: false, schema: { type: "array" } },
        ],
        security: [{ bearerAuth: [] }],
        deprecated: false,
        summary: "Returns details about a listings item",
      };

      mockIdentifyApiModel.mockReturnValue("listingsItems_2021-08-01.json");
      mockIdentifyApiName.mockReturnValue("Listings");
      mockIdentifyApiVersion.mockReturnValue("2021-08-01");

      const enforcerInstance = { request: mockEnforcerRequest };
      mockEnforcer.mockResolvedValue(enforcerInstance);
      mockEnforcerRequest.mockReturnValue([
        {
          operation: operationWithFullMetadata,
          path: { sellerId: "SELLER1", sku: "ABC-123" },
          query: { marketplaceIds: ["ATVPDKIKX0DER"] },
        },
        undefined,
      ]);

      const request = createMockRequest({
        path: "/listings/2021-08-01/items/SELLER1/ABC-123",
        query: { marketplaceIds: "ATVPDKIKX0DER" },
      });
      const result = await validateRequest(request);

      expect(result.pass).toBe(true);
      if (result.pass) {
        // Verify the operation contains all expected properties
        expect(result.operation).toHaveProperty("operationId", "getListingsItem");
        expect(result.operation).toHaveProperty("responses");
        expect(result.operation).toHaveProperty("parameters");
        expect(result.operation).toHaveProperty("security");
        expect(result.operation).toHaveProperty("deprecated", false);
        expect(result.operation).toHaveProperty("summary");

        // Verify responses contain multiple status codes
        expect(Object.keys(result.operation.responses)).toEqual(["200", "400", "403", "404"]);

        // Verify parameters array is fully preserved
        expect(result.operation.parameters).toHaveLength(4);
        expect(result.operation.parameters[0]).toEqual({ name: "sellerId", in: "path", required: true, schema: { type: "string" } });
      }
    });

    it("preserves custom/extension properties (x- prefixed) on the operation object", async () => {
      const operationWithExtensions = {
        operationId: "confirmShipment",
        responses: { "204": { description: "No Content" } },
        parameters: [{ name: "orderId", in: "path", required: true, schema: { type: "string" } }],
        "x-amzn-rate-limit": { burst: 10, sustained: 5 },
        "x-amzn-api-sandbox": { static: [{ request: {}, response: {} }] },
      };

      mockIdentifyApiModel.mockReturnValue("ordersV0.json");
      mockIdentifyApiName.mockReturnValue("Orders");
      mockIdentifyApiVersion.mockReturnValue("v0");

      const enforcerInstance = { request: mockEnforcerRequest };
      mockEnforcer.mockResolvedValue(enforcerInstance);
      mockEnforcerRequest.mockReturnValue([
        {
          operation: operationWithExtensions,
          path: { orderId: "111-222-333" },
          query: {},
        },
        undefined,
      ]);

      const request = createMockRequest({
        method: "POST",
        path: "/orders/v0/orders/111-222-333/shipment/confirm",
        body: { packageDetail: {} },
      });
      const result = await validateRequest(request);

      expect(result.pass).toBe(true);
      if (result.pass) {
        expect(result.operation).toHaveProperty("x-amzn-rate-limit");
        expect(result.operation["x-amzn-rate-limit"]).toEqual({ burst: 10, sustained: 5 });
        expect(result.operation).toHaveProperty("x-amzn-api-sandbox");
      }
    });
  });

  describe("operation object is not present in failure results", () => {
    it("does not include operation when schema validation fails (404)", async () => {
      mockIdentifyApiModel.mockReturnValue(undefined);

      const request = createMockRequest({ path: "/unknown/endpoint" });
      const result = await validateRequest(request);

      expect(result.pass).toBe(false);
      if (!result.pass) {
        expect(result).not.toHaveProperty("operation");
      }
    });

    it("does not include operation when schema validation fails (400)", async () => {
      mockIdentifyApiModel.mockReturnValue("ordersV0.json");

      const enforcerInstance = { request: mockEnforcerRequest };
      mockEnforcer.mockResolvedValue(enforcerInstance);
      mockEnforcerRequest.mockReturnValue([undefined, { toString: () => "Schema validation error" }]);

      const request = createMockRequest({ path: "/orders/v0/orders/123" });
      const result = await validateRequest(request);

      expect(result.pass).toBe(false);
      if (!result.pass) {
        expect(result).not.toHaveProperty("operation");
      }
    });
  });
});
