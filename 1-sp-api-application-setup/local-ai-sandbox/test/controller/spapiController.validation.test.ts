import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { readFileSync } from "fs";
import { resolve } from "path";

// Mock dependencies before importing the controller
vi.mock("../../src/service/validationEngine.js", () => ({
  validateRequest: vi.fn(),
}));

vi.mock("../../src/agent-definition/agenticResponseRegistry.js", () => ({}));

vi.mock("../../src/registry/operationRegistry.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/registry/operationRegistry.js")>();
  const handlers = new Map<string, unknown>();
  const agenticKeys = new Set<string>();
  return {
    ...original,
    buildAgenticResponsePrompt: vi.fn().mockReturnValue("mocked prompt"),
    OPERATIONS_REGISTRY: {
      get: (key: string) => handlers.get(key),
      register: (apiName: string, apiVersion: string, operationId: string, handler: unknown, requiresAgentic = false) => {
        const key = `${apiName}:${apiVersion}:${operationId}`;
        handlers.set(key, handler);
        if (requiresAgentic) agenticKeys.add(key);
      },
      requiresAgenticResponse: (key: string) => agenticKeys.has(key),
      isAllowedInCurrentMode: (_key: string) => true,
      clear: () => {
        handlers.clear();
        agenticKeys.clear();
      },
      set: (key: string, handler: unknown) => handlers.set(key, handler),
      setAgentic: (key: string) => agenticKeys.add(key),
      get size() {
        return handlers.size;
      },
    },
  };
});

vi.mock("../../src/index.js", () => ({
  asyncLocalStorage: {
    run: vi.fn((_store: unknown, fn: () => Promise<void>) => fn()),
  },
}));

vi.mock("../../src/modelProvider.js", () => ({
  model: {},
}));

const mockAgentInvoke = vi.fn();
vi.mock("@strands-agents/sdk", () => {
  return {
    Agent: class MockAgent {
      invoke = mockAgentInvoke;
    },
  };
});

vi.mock("../../src/util.js", () => ({
  printMetricsAndTraces: vi.fn(),
}));

import { createResponse } from "../../src/controller/spapiController.js";
import { validateRequest } from "../../src/service/validationEngine.js";
import { OPERATIONS_REGISTRY } from "../../src/registry/operationRegistry.js";
import { identifyApiName, identifyApiVersion } from "../../src/service/apiSchemaIdentificationService.js";

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    path: "/orders/v0/orders/123-456",
    url: "/orders/v0/orders/123-456",
    originalUrl: "/orders/v0/orders/123-456",
    body: { someField: "value" },
    query: { status: "active" },
    headers: {},
    header: vi.fn().mockReturnValue("mock-token"),
    ...overrides,
  } as unknown as Request;
}

function createMockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("spapiController validation integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (OPERATIONS_REGISTRY as unknown as { clear: () => void }).clear();
    
  });

  it("calls validateRequest (unified entry point) with the Express request", async () => {
    const mockValidateRequest = vi.mocked(validateRequest);

    mockValidateRequest.mockResolvedValue({
      pass: true,
      operationId: "testOp",
      apiName: "Orders",
      apiVersion: "v0",
      pathParams: { orderId: "123" },
      queryParams: { status: "active" },
      body: undefined,
      resolvedEntities: {},
      operation: { operationId: "testOp" },
    });

    // Set up operation handler
    const mockOperationHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      operationId: "testOp",
      apiName: "Orders",
      apiVersion: "v0",
      pathParams: { orderId: "123" },
      queryParams: { status: "active" },
      body: undefined,
      operation: { operationId: "testOp" },
      resolvedEntities: {},
      data: {},
    });
    (OPERATIONS_REGISTRY as unknown as { set: (k: string, v: unknown) => void }).set("Orders:v0:testOp", mockOperationHandler);

    // Set up agent definition
    (OPERATIONS_REGISTRY as unknown as { setAgentic: (k: string) => void }).setAgentic("Orders:v0:testOp");

    mockAgentInvoke.mockResolvedValue({
      structuredOutput: { statusCode: 200, body: JSON.stringify({ message: "ok" }) },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    await createResponse(req, res);

    expect(mockValidateRequest).toHaveBeenCalledOnce();
    expect(mockValidateRequest).toHaveBeenCalledWith(req);
  });

  it("returns error without agent invocation when validation fails", async () => {
    const mockValidateRequest = vi.mocked(validateRequest);

    mockValidateRequest.mockResolvedValue({
      pass: false,
      statusCode: 404,
      body: { errors: [{ code: "NotFound", message: "Order not found" }] },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    await createResponse(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      errors: [{ code: "NotFound", message: "Order not found" }],
    });
    // Agent invoke should NOT have been called
    expect(mockAgentInvoke).not.toHaveBeenCalled();
  });

  it("proceeds to operation handler when validation passes", async () => {
    const mockValidateRequest = vi.mocked(validateRequest);

    mockValidateRequest.mockResolvedValue({
      pass: true,
      operationId: "testOp",
      apiName: "Orders",
      apiVersion: "v0",
      pathParams: { orderId: "123" },
      queryParams: {},
      body: undefined,
      resolvedEntities: {},
      operation: { operationId: "testOp" },
    });

    const mockOperationHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      operationId: "testOp",
      apiName: "Orders",
      apiVersion: "v0",
      pathParams: { orderId: "123" },
      queryParams: {},
      body: undefined,
      operation: { operationId: "testOp" },
      resolvedEntities: {},
      data: { body: { result: "ok" } },
    });
    (OPERATIONS_REGISTRY as unknown as { set: (k: string, v: unknown) => void }).set("Orders:v0:testOp", mockOperationHandler);

    const req = createMockRequest();
    const res = createMockResponse();

    await createResponse(req, res);

    // Operation handler should have been called
    expect(mockOperationHandler).toHaveBeenCalledWith(expect.objectContaining({ operationId: "testOp" }), req);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ result: "ok" });
  });

  it("passes operationId, pathParams, queryParams, and resolvedEntities from unified result to operation handler", async () => {
    const mockValidateRequest = vi.mocked(validateRequest);

    const validationResult = {
      pass: true as const,
      operationId: "getOrder",
      apiName: "Orders",
      apiVersion: "v0",
      pathParams: { orderId: "ORD-789" },
      queryParams: { marketplace: "US" },
      body: { customField: "bodyValue" },
      resolvedEntities: { order: { orderId: "ORD-789", status: "Shipped" } },
      operation: { operationId: "getOrder", responses: { "200": {} } },
    };

    mockValidateRequest.mockResolvedValue(validationResult);

    const mockOperationHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      operationId: "getOrder",
      apiName: "Orders",
      apiVersion: "v0",
      pathParams: { orderId: "ORD-789" },
      queryParams: { marketplace: "US" },
      body: { customField: "bodyValue" },
      operation: { operationId: "getOrder", responses: { "200": {} } },
      resolvedEntities: { order: { orderId: "ORD-789", status: "Shipped" } },
      data: { body: { orderId: "ORD-789" } },
    });
    (OPERATIONS_REGISTRY as unknown as { set: (k: string, v: unknown) => void }).set("Orders:v0:getOrder", mockOperationHandler);

    const req = createMockRequest({
      method: "GET",
      path: "/orders/v0/orders/ORD-789",
      url: "/orders/v0/orders/ORD-789",
      originalUrl: "/orders/v0/orders/ORD-789",
      body: { customField: "bodyValue" },
    });
    const res = createMockResponse();

    await createResponse(req, res);

    // Verify operation handler received the validation result and express request
    expect(mockOperationHandler).toHaveBeenCalledWith(validationResult, req);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ orderId: "ORD-789" });
  });

  it("returns 404 with no body when unified result has no body", async () => {
    const mockValidateRequest = vi.mocked(validateRequest);

    mockValidateRequest.mockResolvedValue({
      pass: false,
      statusCode: 404,
    });

    const req = createMockRequest();
    const res = createMockResponse();

    await createResponse(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("returns 400 with error details when schema validation fails", async () => {
    const mockValidateRequest = vi.mocked(validateRequest);

    mockValidateRequest.mockResolvedValue({
      pass: false,
      statusCode: 400,
      body: { errors: [{ code: "SchemaValidationError", message: "Invalid request: missing required parameter" }] },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    await createResponse(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ errors: [{ code: "SchemaValidationError", message: "Invalid request: missing required parameter" }] });
    expect(mockAgentInvoke).not.toHaveBeenCalled();
  });

  it("returns pipeline rule failure without invoking agent", async () => {
    const mockValidateRequest = vi.mocked(validateRequest);

    mockValidateRequest.mockResolvedValue({
      pass: false,
      statusCode: 400,
      body: { errors: [{ code: "MutualExclusivity", message: "Parameters are mutually exclusive" }] },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    await createResponse(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      errors: [{ code: "MutualExclusivity", message: "Parameters are mutually exclusive" }],
    });
    expect(mockAgentInvoke).not.toHaveBeenCalled();
  });

  it("returns pipeline rule failure with 404 without invoking agent", async () => {
    const mockValidateRequest = vi.mocked(validateRequest);

    mockValidateRequest.mockResolvedValue({
      pass: false,
      statusCode: 404,
      body: { errors: [{ code: "NotFound", message: "Order with id 'ORD-999' not found" }] },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    await createResponse(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      errors: [{ code: "NotFound", message: "Order with id 'ORD-999' not found" }],
    });
    expect(mockAgentInvoke).not.toHaveBeenCalled();
  });

  it("passes the full operation object from unified result to operation handler (not just { operationId })", async () => {
    const mockValidateRequest = vi.mocked(validateRequest);

    // A rich operation object with response schemas, parameters, and metadata
    const fullOperationObject = {
      operationId: "getOrder",
      summary: "Returns the order that you specify",
      description: "Returns the order that you specify, including order items.",
      tags: ["orders"],
      parameters: [
        {
          name: "orderId",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "An Amazon-defined order identifier.",
        },
        {
          name: "marketplaceIds",
          in: "query",
          required: false,
          schema: { type: "array", items: { type: "string" } },
          description: "A list of MarketplaceId values.",
        },
      ],
      responses: {
        "200": {
          description: "Success.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  payload: {
                    type: "object",
                    properties: {
                      AmazonOrderId: { type: "string" },
                      OrderStatus: { type: "string", enum: ["Pending", "Unshipped", "Shipped", "Canceled"] },
                      OrderTotal: {
                        type: "object",
                        properties: {
                          CurrencyCode: { type: "string" },
                          Amount: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "404": {
          description: "The resource specified does not exist.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  errors: { type: "array", items: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } } },
                },
              },
            },
          },
        },
      },
    };

    const validationResult = {
      pass: true as const,
      operationId: "getOrder",
      apiName: "Orders",
      apiVersion: "v0",
      pathParams: { orderId: "ORDER-555" },
      queryParams: { marketplaceIds: ["ATVPDKIKX0DER"] },
      body: undefined,
      resolvedEntities: { order: { orderId: "ORDER-555", status: "Shipped" } },
      operation: fullOperationObject,
    };

    mockValidateRequest.mockResolvedValue(validationResult);

    const mockOperationHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      operationId: "getOrder",
      apiName: "Orders",
      apiVersion: "v0",
      pathParams: { orderId: "ORDER-555" },
      queryParams: { marketplaceIds: ["ATVPDKIKX0DER"] },
      body: undefined,
      operation: fullOperationObject,
      resolvedEntities: { order: { orderId: "ORDER-555", status: "Shipped" } },
      data: { body: { orderId: "ORDER-555" } },
    });
    (OPERATIONS_REGISTRY as unknown as { set: (k: string, v: unknown) => void }).set("Orders:v0:getOrder", mockOperationHandler);

    const req = createMockRequest({ method: "GET", path: "/orders/v0/orders/ORDER-555" });
    const res = createMockResponse();

    await createResponse(req, res);

    // Verify operation handler was called with the full validation result
    expect(mockOperationHandler).toHaveBeenCalledOnce();
    const [handlerValidationResult] = mockOperationHandler.mock.calls[0];

    // The operation field must be the full operation object, not a simple wrapper
    expect(handlerValidationResult.operation).toBe(fullOperationObject);
    expect(handlerValidationResult.operation).toEqual(fullOperationObject);

    // Verify it contains response schemas
    expect(handlerValidationResult.operation.responses).toBeDefined();
    expect(handlerValidationResult.operation.responses["200"]).toBeDefined();
    expect(handlerValidationResult.operation.responses["200"].content["application/json"].schema.properties.payload).toBeDefined();

    // Verify it contains parameter definitions
    expect(handlerValidationResult.operation.parameters).toBeDefined();
    expect(handlerValidationResult.operation.parameters).toHaveLength(2);
    expect(handlerValidationResult.operation.parameters[0].name).toBe("orderId");
    expect(handlerValidationResult.operation.parameters[1].name).toBe("marketplaceIds");

    // Verify the operationId is part of the operation object itself
    expect(handlerValidationResult.operation.operationId).toBe("getOrder");

    // Verify other context fields are still passed correctly alongside operation
    expect(handlerValidationResult.pathParams).toEqual({ orderId: "ORDER-555" });
    expect(handlerValidationResult.queryParams).toEqual({ marketplaceIds: ["ATVPDKIKX0DER"] });
    expect(handlerValidationResult.resolvedEntities).toEqual({ order: { orderId: "ORDER-555", status: "Shipped" } });

    // Verify correct response
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ orderId: "ORDER-555" });
  });

  it("does not import or call requestValidationService.validateRequest or identifyApiName/identifyApiVersion from apiSchemaIdentificationService", () => {
    const controllerSource = readFileSync(resolve(__dirname, "../../src/controller/spapiController.ts"), "utf-8");

    // Controller should NOT import from requestValidationService
    expect(controllerSource).not.toContain("requestValidationService");

    // Controller should NOT directly import identifyApiName or identifyApiVersion from apiSchemaIdentificationService
    expect(controllerSource).not.toContain("identifyApiName");
    expect(controllerSource).not.toContain("identifyApiVersion");
    expect(controllerSource).not.toContain("apiSchemaIdentificationService");

    // Controller SHOULD import validateRequest from validationEngine
    expect(controllerSource).toContain('import { validateRequest } from "../service/validationEngine.js"');
  });
});

describe("identifyApiVersion model filename parsing", () => {
  it('parses ordersV0.json model to version "v0"', () => {
    expect(identifyApiVersion("/orders/v0/orders/123")).toBe("v0");
  });

  it('parses orders_2026-01-01.json model to version "2026-01-01"', () => {
    expect(identifyApiVersion("/orders/2026-01-01/orders/456")).toBe("2026-01-01");
  });

  it('parses catalogItems_2022-04-01.json model to version "2022-04-01"', () => {
    expect(identifyApiVersion("/catalog/2022-04-01/items")).toBe("2022-04-01");
  });

  it('parses listingsItems_2021-08-01.json model to version "2021-08-01"', () => {
    expect(identifyApiVersion("/listings/2021-08-01/items/SKU1")).toBe("2021-08-01");
  });

  it('parses fbaInventory_v1.json model to version "v1"', () => {
    expect(identifyApiVersion("/fba/inventory/v1/items/SKU1")).toBe("v1");
  });

  it('parses externalFulfillmentShipments_2024-09-11.json model to version "2024-09-11"', () => {
    expect(identifyApiVersion("/externalFulfillment/2024-09-11/shipments/SHIP1")).toBe("2024-09-11");
  });

  it('parses externalFulfillmentReturns_2024-09-11.json model to version "2024-09-11"', () => {
    expect(identifyApiVersion("/externalFulfillment/2024-09-11/returns/RET1")).toBe("2024-09-11");
  });

  it('parses externalFulfillmentInventory_2024-09-11.json model to version "2024-09-11"', () => {
    expect(identifyApiVersion("/externalFulfillment/inventory/2024-09-11/inventories")).toBe("2024-09-11");
  });

  it("returns undefined for unknown paths with no matching model", () => {
    expect(identifyApiVersion("/unknown/path")).toBeUndefined();
  });
});
