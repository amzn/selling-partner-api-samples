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

describe("Schema Validation (performSchemaValidation via validateRequest)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("valid path recognition and pass result", () => {
    it("returns pass with operationId, apiName, apiVersion, pathParams for /orders/v0/orders/123-456", async () => {
      mockIdentifyApiModel.mockReturnValue("ordersV0.json");
      mockIdentifyApiName.mockReturnValue("Orders");
      mockIdentifyApiVersion.mockReturnValue("v0");

      const enforcerInstance = { request: mockEnforcerRequest };
      mockEnforcer.mockResolvedValue(enforcerInstance);
      mockEnforcerRequest.mockReturnValue([
        {
          operation: { operationId: "getOrder" },
          path: { orderId: "123-456" },
          query: {},
        },
        undefined,
      ]);

      const request = createMockRequest({ path: "/orders/v0/orders/123-456" });
      const result = await validateRequest(request);

      expect(result.pass).toBe(true);
      if (result.pass) {
        expect(result.operationId).toBe("getOrder");
        expect(result.apiName).toBe("Orders");
        expect(result.apiVersion).toBe("v0");
        expect(result.pathParams).toEqual({ orderId: "123-456" });
      }
    });
  });

  describe("unrecognized path returns 404 with no errors", () => {
    it("returns { pass: false, statusCode: 404 } with no body for /unknown/endpoint", async () => {
      mockIdentifyApiModel.mockReturnValue(undefined);

      const request = createMockRequest({ path: "/unknown/endpoint" });
      const result = await validateRequest(request);

      expect(result.pass).toBe(false);
      if (!result.pass) {
        expect(result.statusCode).toBe(404);
        expect(result.body).toBeUndefined();
      }
    });
  });

  describe("valid path but invalid query params returns 400 with errors", () => {
    it("returns { pass: false, statusCode: 400, errors: { errors: <string> } }", async () => {
      mockIdentifyApiModel.mockReturnValue("ordersV0.json");

      const enforcerInstance = { request: mockEnforcerRequest };
      mockEnforcer.mockResolvedValue(enforcerInstance);

      const mockError = {
        toString: () => "Request has one or more errors:\n  Invalid query parameter 'marketplaceIds'",
      };
      mockEnforcerRequest.mockReturnValue([undefined, mockError]);

      const request = createMockRequest({
        path: "/orders/v0/orders/123-456",
        query: { invalidParam: "bad" },
      });
      const result = await validateRequest(request);

      expect(result.pass).toBe(false);
      if (!result.pass) {
        expect(result.statusCode).toBe(400);
        expect(result.body).toEqual({
          errors: [{ code: "SchemaValidationError", message: expect.stringContaining("Request has one or more errors") }],
        });
      }
    });
  });

  describe("GET request does not include body in enforcer call", () => {
    it("calls enforcer.request without body field for GET", async () => {
      mockIdentifyApiModel.mockReturnValue("ordersV0.json");
      mockIdentifyApiName.mockReturnValue("Orders");
      mockIdentifyApiVersion.mockReturnValue("v0");

      const enforcerInstance = { request: mockEnforcerRequest };
      mockEnforcer.mockResolvedValue(enforcerInstance);
      mockEnforcerRequest.mockReturnValue([
        { operation: { operationId: "getOrder" }, path: {}, query: {} },
        undefined,
      ]);

      const request = createMockRequest({
        method: "GET",
        path: "/orders/v0/orders/123-456",
        body: { someField: "should not be passed" },
      });
      await validateRequest(request);

      expect(mockEnforcerRequest).toHaveBeenCalledTimes(1);
      const callArgs = mockEnforcerRequest.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("body");
      expect(callArgs.method).toBe("GET");
    });
  });

  describe("DELETE request does not include body in enforcer call", () => {
    it("calls enforcer.request without body field for DELETE", async () => {
      mockIdentifyApiModel.mockReturnValue("ordersV0.json");
      mockIdentifyApiName.mockReturnValue("Orders");
      mockIdentifyApiVersion.mockReturnValue("v0");

      const enforcerInstance = { request: mockEnforcerRequest };
      mockEnforcer.mockResolvedValue(enforcerInstance);
      mockEnforcerRequest.mockReturnValue([
        { operation: { operationId: "deleteOrder" }, path: {}, query: {} },
        undefined,
      ]);

      const request = createMockRequest({
        method: "DELETE",
        path: "/orders/v0/orders/123-456",
        body: { someField: "should not be passed" },
      });
      await validateRequest(request);

      expect(mockEnforcerRequest).toHaveBeenCalledTimes(1);
      const callArgs = mockEnforcerRequest.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("body");
      expect(callArgs.method).toBe("DELETE");
    });
  });

  describe("POST request includes body in enforcer call", () => {
    it("calls enforcer.request with body field for POST", async () => {
      mockIdentifyApiModel.mockReturnValue("ordersV0.json");
      mockIdentifyApiName.mockReturnValue("Orders");
      mockIdentifyApiVersion.mockReturnValue("v0");

      const enforcerInstance = { request: mockEnforcerRequest };
      mockEnforcer.mockResolvedValue(enforcerInstance);
      mockEnforcerRequest.mockReturnValue([
        { operation: { operationId: "confirmShipment" }, path: {}, query: {} },
        undefined,
      ]);

      const requestBody = { packageDetail: { trackingNumber: "1Z999" } };
      const request = createMockRequest({
        method: "POST",
        path: "/orders/v0/orders/123-456/shipment/confirm",
        body: requestBody,
      });
      await validateRequest(request);

      expect(mockEnforcerRequest).toHaveBeenCalledTimes(1);
      const callArgs = mockEnforcerRequest.mock.calls[0][0];
      expect(callArgs).toHaveProperty("body");
      expect(callArgs.body).toEqual(requestBody);
      expect(callArgs.method).toBe("POST");
    });
  });

  describe("WSCH006 exception code is suppressed during enforcer loading", () => {
    it("passes exceptionSkipCodes containing WSCH006 to Enforcer", async () => {
      mockIdentifyApiModel.mockReturnValue("ordersV0.json");
      mockIdentifyApiName.mockReturnValue("Orders");
      mockIdentifyApiVersion.mockReturnValue("v0");

      const enforcerInstance = { request: mockEnforcerRequest };
      mockEnforcer.mockResolvedValue(enforcerInstance);
      mockEnforcerRequest.mockReturnValue([
        { operation: { operationId: "getOrder" }, path: {}, query: {} },
        undefined,
      ]);

      const request = createMockRequest({ path: "/orders/v0/orders/123-456" });
      await validateRequest(request);

      expect(mockEnforcer).toHaveBeenCalledWith("./res/models/ordersV0.json", {
        componentOptions: {
          exceptionSkipCodes: ["WSCH006"],
        },
      });
    });
  });

  describe("apiName/apiVersion derivation for multiple paths", () => {
    it('/listings/2021-08-01/items/... → apiName "Listings", apiVersion "2021-08-01"', async () => {
      mockIdentifyApiModel.mockReturnValue("listingsItems_2021-08-01.json");
      mockIdentifyApiName.mockReturnValue("Listings");
      mockIdentifyApiVersion.mockReturnValue("2021-08-01");

      const enforcerInstance = { request: mockEnforcerRequest };
      mockEnforcer.mockResolvedValue(enforcerInstance);
      mockEnforcerRequest.mockReturnValue([
        { operation: { operationId: "getListingsItem" }, path: { sellerId: "SELLER1", sku: "SKU123" }, query: { marketplaceIds: ["ATVPDKIKX0DER"] } },
        undefined,
      ]);

      const request = createMockRequest({
        path: "/listings/2021-08-01/items/SELLER1/SKU123",
        query: { marketplaceIds: "ATVPDKIKX0DER" },
      });
      const result = await validateRequest(request);

      expect(result.pass).toBe(true);
      if (result.pass) {
        expect(result.apiName).toBe("Listings");
        expect(result.apiVersion).toBe("2021-08-01");
      }
    });

    it('/catalog/2022-04-01/items → apiName "Catalog Items", apiVersion "2022-04-01"', async () => {
      mockIdentifyApiModel.mockReturnValue("catalogItems_2022-04-01.json");
      mockIdentifyApiName.mockReturnValue("Catalog Items");
      mockIdentifyApiVersion.mockReturnValue("2022-04-01");

      const enforcerInstance = { request: mockEnforcerRequest };
      mockEnforcer.mockResolvedValue(enforcerInstance);
      mockEnforcerRequest.mockReturnValue([
        { operation: { operationId: "searchCatalogItems" }, path: {}, query: { keywords: ["laptop"], marketplaceIds: ["ATVPDKIKX0DER"] } },
        undefined,
      ]);

      const request = createMockRequest({
        path: "/catalog/2022-04-01/items",
        query: { keywords: "laptop", marketplaceIds: "ATVPDKIKX0DER" },
      });
      const result = await validateRequest(request);

      expect(result.pass).toBe(true);
      if (result.pass) {
        expect(result.apiName).toBe("Catalog Items");
        expect(result.apiVersion).toBe("2022-04-01");
      }
    });
  });
});
