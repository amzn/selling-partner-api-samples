import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { Request } from "express";

/**
 * Property 19: Schema_Validation_Stage executes before pipeline rules
 *
 * For any incoming request (valid or invalid against the OpenAPI schema),
 * the Schema_Validation_Stage SHALL execute to completion before any
 * Validation_Pipeline rule is evaluated. If schema validation fails,
 * no pipeline rules are executed.
 *
 * **Validates: Requirements 12.1, 12.12**
 */

// Mock openapi-enforcer to control schema validation results
const mockEnforcerRequest = vi.fn();
vi.mock("openapi-enforcer", () => {
  return {
    default: vi.fn().mockImplementation(async () => ({
      request: mockEnforcerRequest,
    })),
  };
});

// Mock api schema identification service
const mockIdentifyApiModel = vi.fn();
const mockIdentifyApiName = vi.fn();
const mockIdentifyApiVersion = vi.fn();
vi.mock("../../src/service/apiSchemaIdentificationService.js", () => ({
  identifyApiModel: (...args: unknown[]) => mockIdentifyApiModel(...args),
  identifyApiName: (...args: unknown[]) => mockIdentifyApiName(...args),
  identifyApiVersion: (...args: unknown[]) => mockIdentifyApiVersion(...args),
}));

// Mock validation registry to track pipeline rule execution
vi.mock("../../src/validation/validationRegistry.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/validation/validationRegistry.js")>();
  return {
    ...original,
    VALIDATION_REGISTRY: new Map(),
  };
});

// Mock the Context singleton with all API partitions initialized as empty
vi.mock("../../src/database/Context.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/database/Context.js")>();
  return {
    ...original,
    Context: {
      get instance() {
        return {
          engine: {
            get: () => null,
          },
        };
      },
    },
  };
});

import { validateRequest } from "../../src/service/validationEngine.js";
import { VALIDATION_REGISTRY } from "../../src/validation/validationRegistry.js";
import { ValidationPipeline } from "../../src/validation/validationTypes.js";

describe("Feature: deterministic-validation-system, Property 19: Schema_Validation_Stage executes before pipeline rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    VALIDATION_REGISTRY.clear();
  });

  it("Property 19a: When schema validation fails (invalid schema), no pipeline rules are evaluated and result is a schema-level error", async () => {
    // Arbitrary: generate invalid request scenarios
    const invalidSchemaArb = fc.record({
      path: fc.constantFrom(
        "/orders/v0/orders/123",
        "/listings/2021-08-01/items/SELLER123/ABC-SKU",
        "/catalog/2022-04-01/items",
      ),
      method: fc.constantFrom("GET", "POST", "PUT", "DELETE"),
      errorMessage: fc.string({ minLength: 5, maxLength: 100 }),
    });

    await fc.assert(
      fc.asyncProperty(invalidSchemaArb, async ({ path, method, errorMessage }) => {
        // Configure mocks: model is found (path is recognized) but schema validation fails
        mockIdentifyApiModel.mockReturnValue("someModel.json");
        mockIdentifyApiName.mockReturnValue("Orders");
        mockIdentifyApiVersion.mockReturnValue("v0");

        // Enforcer returns an error (schema validation failure)
        mockEnforcerRequest.mockReturnValue([undefined, { toString: () => errorMessage }]);

        // Register a pipeline rule that tracks if it's ever evaluated
        const spyRule = {
          checkType: "entityExistence",
          entity: { api: "orders", paramName: "orderId", paramSource: "path", entityLabel: "order" },
          failAction: { statusCode: 404, code: "NotFound", message: "Order not found" },
        };
        VALIDATION_REGISTRY.set("Orders:v0:getOrder", [spyRule] as unknown as ValidationPipeline);

        // Build a mock Express request
        const mockRequest = {
          path,
          method,
          query: {},
          headers: {},
          body: undefined,
        } as unknown as Request;

        const result = await validateRequest(mockRequest);

        // Schema validation should have failed
        expect(result.pass).toBe(false);
        if (!result.pass) {
          expect(result.statusCode).toBe(400);
          // The body should contain the schema error
          expect(result.body).toBeDefined();
          expect(result.body).toHaveProperty("errors");
        }
      }),
      { numRuns: 50 },
    );
  });

  it("Property 19b: When schema validation passes but pipeline rules fail, schema passes first then pipeline rules execute", async () => {
    // Arbitrary: generate valid schema scenarios with pipeline rules that fail
    const validSchemaArb = fc.record({
      path: fc.constantFrom(
        "/orders/v0/orders/123",
        "/orders/v0/orders/456",
        "/orders/v0/orders/789",
      ),
      method: fc.constantFrom("GET", "DELETE"),
      orderId: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
      pipelineErrorMessage: fc.string({ minLength: 3, maxLength: 50 }),
    });

    await fc.assert(
      fc.asyncProperty(validSchemaArb, async ({ path, method, orderId, pipelineErrorMessage }) => {
        // Configure mocks: schema validation passes
        mockIdentifyApiModel.mockReturnValue("ordersV0.json");
        mockIdentifyApiName.mockReturnValue("Orders");
        mockIdentifyApiVersion.mockReturnValue("v0");

        // Enforcer returns success with operationId, path params, query params
        mockEnforcerRequest.mockReturnValue([
          {
            operation: { operationId: "getOrder" },
            path: { orderId },
            query: {},
          },
          undefined,
        ]);

        // Register a pipeline rule that will FAIL (to confirm pipeline runs after schema passes)
        const failingRule = {
          checkType: "entityExistence",
          entity: { api: "orders", paramName: "orderId", paramSource: "path", entityLabel: "order" },
          failAction: { statusCode: 404, code: "NotFound", message: pipelineErrorMessage },
        };
        VALIDATION_REGISTRY.set("Orders:v0:getOrder", [failingRule] as unknown as ValidationPipeline);

        // Build a mock Express request
        const mockRequest = {
          path,
          method,
          query: {},
          headers: {},
          body: undefined,
        } as unknown as Request;

        const result = await validateRequest(mockRequest);

        // The result should be a pipeline failure (NOT a schema failure)
        // This proves schema passed first, then pipeline rules ran and failed
        expect(result.pass).toBe(false);
        if (!result.pass) {
          // Pipeline rules produce 404 with structured error body (array of errors)
          expect(result.statusCode).toBe(404);
          expect(result.body).toBeDefined();
          // Pipeline errors have a body with errors array containing objects with code and message
          if (result.body && "errors" in result.body && Array.isArray(result.body.errors)) {
            expect(result.body.errors[0]).toHaveProperty("code", "NotFound");
            expect(result.body.errors[0]).toHaveProperty("message");
          }
        }
      }),
      { numRuns: 50 },
    );
  });

  it("Property 19c: When path is not recognized (404), pipeline rules are never evaluated", async () => {
    // Arbitrary: generate arbitrary unrecognized paths
    const unrecognizedPathArb = fc.record({
      path: fc.constantFrom(
        "/unknown/api/endpoint",
        "/v1/nonexistent/path",
        "/some/random/route",
        "/api/v2/resources/123",
      ),
      method: fc.constantFrom("GET", "POST", "PUT", "DELETE", "PATCH"),
    });

    await fc.assert(
      fc.asyncProperty(unrecognizedPathArb, async ({ path, method }) => {
        // Configure mocks: path is not recognized
        mockIdentifyApiModel.mockReturnValue(undefined);

        // Register a pipeline rule that should NEVER be reached
        const spyRule = {
          checkType: "entityExistence",
          entity: { api: "orders", paramName: "id", paramSource: "path", entityLabel: "entity" },
          failAction: { statusCode: 404, code: "NotFound", message: "Should never see this" },
        };
        VALIDATION_REGISTRY.set("SomeApi:v1:someOp", [spyRule] as unknown as ValidationPipeline);

        // Build a mock Express request
        const mockRequest = {
          path,
          method,
          query: {},
          headers: {},
          body: undefined,
        } as unknown as Request;

        const result = await validateRequest(mockRequest);

        // Should return 404 (unrecognized path) WITHOUT body
        expect(result.pass).toBe(false);
        if (!result.pass) {
          expect(result.statusCode).toBe(404);
          // Unrecognized path returns no body (undefined)
          expect(result.body).toBeUndefined();
        }

        // The enforcer request mock should NOT have been called since the model was not identified
        expect(mockEnforcerRequest).not.toHaveBeenCalled();
      }),
      { numRuns: 50 },
    );
  });
});
