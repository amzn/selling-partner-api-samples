import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

// Use vi.hoisted so the mock fn is available when vi.mock factories execute (hoisted to top)
const { mockEnforcerRequest } = vi.hoisted(() => ({
  mockEnforcerRequest: vi.fn(),
}));

// Mock openapi-enforcer to capture how it's called
vi.mock("openapi-enforcer", () => ({
  default: vi.fn().mockResolvedValue({
    request: mockEnforcerRequest,
  }),
}));

// Mock apiSchemaIdentificationService to always recognize the path
vi.mock("../../src/service/apiSchemaIdentificationService.js", () => ({
  identifyApiModel: vi.fn().mockReturnValue("ordersV0.json"),
  identifyApiName: vi.fn().mockReturnValue("Orders"),
  identifyApiVersion: vi.fn().mockReturnValue("v0"),
}));

// Mock the validation registry to return an empty pipeline (so we only test schema validation stage)
vi.mock("../../src/validation/validationRegistry.js", () => {
  const emptyPipelineMap = new Map<string, never[]>();
  return {
    buildValidationKey: vi.fn().mockReturnValue("Orders:v0:testOp"),
    VALIDATION_REGISTRY: new Proxy(emptyPipelineMap, {
      get(target, prop) {
        if (prop === "get") return () => [];
        return Reflect.get(target, prop);
      },
    }),
  };
});

// Mock Context to avoid database dependency
vi.mock("../../src/database/Context.js", () => ({
  Context: {
    get instance() {
      return { db: { data: {} } };
    },
  },
}));

import { validateRequest } from "../../src/service/validationEngine.js";
import { Request } from "express";

/**
 * Property 23: GET/DELETE requests exclude body from schema validation
 *
 * Generate GET and DELETE requests with arbitrary body content; verify the
 * Schema_Validation_Stage does not include the body in the enforcer call
 * (body is ignored and validation succeeds based on path/query alone).
 *
 * Generate POST/PUT/PATCH requests; verify body IS included in the enforcer
 * validation call.
 *
 * **Validates: Requirements 12.11**
 */
describe("Feature: deterministic-validation-system, Property 23: GET/DELETE requests exclude body from schema validation", () => {
  beforeEach(() => {
    mockEnforcerRequest.mockReset();
    // Default: enforcer.request returns a successful result
    mockEnforcerRequest.mockReturnValue([
      {
        operation: { operationId: "testOperation" },
        path: {},
        query: {},
      },
      undefined,
    ]);
  });

  it("Property 23a: GET/DELETE requests do NOT include body in enforcer call", async () => {
    const methodArb = fc.constantFrom("GET" as const, "DELETE" as const);
    const bodyArb = fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.jsonValue());

    await fc.assert(
      fc.asyncProperty(methodArb, bodyArb, async (method, body) => {
        mockEnforcerRequest.mockReturnValue([
          {
            operation: { operationId: "testOperation" },
            path: {},
            query: {},
          },
          undefined,
        ]);

        const mockRequest = {
          method,
          path: "/orders/v0/orders",
          query: {},
          headers: {},
          body,
        } as unknown as Request;

        await validateRequest(mockRequest);

        // Verify the enforcer request was called
        expect(mockEnforcerRequest).toHaveBeenCalled();

        // Get the arguments passed to enforcer.request()
        const callArgs = mockEnforcerRequest.mock.calls[mockEnforcerRequest.mock.calls.length - 1][0];

        // For GET/DELETE, the body field should NOT be present in the call
        expect(callArgs).not.toHaveProperty("body");
        expect(callArgs.method).toBe(method);

        mockEnforcerRequest.mockClear();
      }),
      { numRuns: 100 },
    );
  });

  it("Property 23b: POST/PUT/PATCH requests DO include body in enforcer call", async () => {
    const methodArb = fc.constantFrom("POST" as const, "PUT" as const, "PATCH" as const);
    const bodyArb = fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.jsonValue());

    await fc.assert(
      fc.asyncProperty(methodArb, bodyArb, async (method, body) => {
        mockEnforcerRequest.mockReturnValue([
          {
            operation: { operationId: "testOperation" },
            path: {},
            query: {},
          },
          undefined,
        ]);

        const mockRequest = {
          method,
          path: "/orders/v0/orders",
          query: {},
          headers: {},
          body,
        } as unknown as Request;

        await validateRequest(mockRequest);

        // Verify the enforcer request was called
        expect(mockEnforcerRequest).toHaveBeenCalled();

        // Get the arguments passed to enforcer.request()
        const callArgs = mockEnforcerRequest.mock.calls[mockEnforcerRequest.mock.calls.length - 1][0];

        // For POST/PUT/PATCH, the body field SHOULD be present in the call
        expect(callArgs).toHaveProperty("body");
        expect(callArgs.method).toBe(method);

        mockEnforcerRequest.mockClear();
      }),
      { numRuns: 100 },
    );
  });
});
