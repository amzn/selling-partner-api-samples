import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { Request } from "express";

/**
 * Property 24: Operation object pass-through identity
 *
 * For any request that passes OpenAPI schema validation, the unified pass result
 * SHALL contain an `operation` field whose value is the exact same operation object
 * returned by the openapi-enforcer result, without any filtering, transformation,
 * or modification of its properties. The operation object SHALL be passed through
 * as-is from the enforcer's `value.operation` to the unified pass result's `operation` field.
 *
 * **Validates: Requirements 13.1, 13.5**
 */

// Mock openapi-enforcer — use vi.hoisted to make variables available in hoisted vi.mock factories
const { mockEnforcerRequest, mockIdentifyApiModel, mockIdentifyApiName, mockIdentifyApiVersion } = vi.hoisted(() => ({
  mockEnforcerRequest: vi.fn(),
  mockIdentifyApiModel: vi.fn(),
  mockIdentifyApiName: vi.fn(),
  mockIdentifyApiVersion: vi.fn(),
}));

vi.mock("openapi-enforcer", () => ({
  default: vi.fn().mockResolvedValue({
    request: mockEnforcerRequest,
  }),
}));

// Mock apiSchemaIdentificationService
vi.mock("../../src/service/apiSchemaIdentificationService.js", () => ({
  identifyApiModel: (...args: unknown[]) => mockIdentifyApiModel(...args),
  identifyApiName: (...args: unknown[]) => mockIdentifyApiName(...args),
  identifyApiVersion: (...args: unknown[]) => mockIdentifyApiVersion(...args),
}));

// Mock the validation registry to have an empty pipeline (so requests pass through)
vi.mock("../../src/validation/validationRegistry.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/validation/validationRegistry.js")>();
  const emptyPipelineMap = new Map<string, never[]>();
  return {
    ...original,
    VALIDATION_REGISTRY: new Proxy(emptyPipelineMap, {
      get(target, prop) {
        if (prop === "get") return () => [];
        return Reflect.get(target, prop);
      },
    }),
  };
});

// Mock the Context singleton
vi.mock("../../src/database/Context.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/database/Context.js")>();
  return {
    ...original,
    Context: {
      get instance() {
        return {
          db: {
            data: {},
          },
        };
      },
    },
  };
});

import { validateRequest } from "../../src/service/validationEngine.js";
import { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

describe("Feature: deterministic-validation-system, Property 24: Operation object pass-through identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Property 24: The unified pass result contains the exact same operation object returned by openapi-enforcer without filtering or transformation", async () => {
    // Generate arbitrary operation objects with varying shapes and properties
    const operationObjectArb = fc.record({
      operationId: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{1,29}$/),
      responses: fc.dictionary(
        fc.constantFrom("200", "201", "400", "404", "500"),
        fc.record({
          description: fc.string({ minLength: 1, maxLength: 50 }),
          content: fc.constant({ "application/json": { schema: { type: "object" } } }),
        }),
        { minKeys: 1, maxKeys: 3 },
      ),
      parameters: fc.array(
        fc.record({
          name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/),
          in: fc.constantFrom("path", "query", "header"),
          required: fc.boolean(),
          schema: fc.record({ type: fc.constantFrom("string", "integer", "boolean") }),
        }),
        { minLength: 0, maxLength: 5 },
      ),
      summary: fc.option(fc.string({ minLength: 1, maxLength: 60 }), { nil: undefined }),
      description: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
      tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }), { nil: undefined }),
      deprecated: fc.option(fc.boolean(), { nil: undefined }),
    });

    await fc.assert(
      fc.asyncProperty(operationObjectArb, async (operationObject) => {
        // Configure mocks for a successful schema validation
        mockIdentifyApiModel.mockReturnValue("testModel.json");
        mockIdentifyApiName.mockReturnValue("TestApi");
        mockIdentifyApiVersion.mockReturnValue("v1");

        // The enforcer returns the generated operation object as value.operation
        mockEnforcerRequest.mockReturnValue([
          {
            operation: operationObject,
            path: {},
            query: {},
          },
          undefined, // no error
        ]);

        // Build a minimal Express-like request object
        const mockRequest = {
          path: "/test/api/path",
          method: "GET",
          query: {},
          headers: {},
          body: undefined,
        } as unknown as Request;

        const result = await validateRequest(mockRequest);

        // Verify the result is a pass
        expect(result.pass).toBe(true);

        const passResult = result as UnifiedValidationPass;

        // The operation field must be the exact same reference (identity check)
        expect(passResult.operation).toBe(operationObject);

        // Also verify deep equality — no properties were removed or modified
        expect(passResult.operation).toEqual(operationObject);
      }),
      { numRuns: 100 },
    );
  });

  it("Property 24b: Operation objects with nested complex structures are passed through without transformation", async () => {
    // Generate operation objects with deeper/more complex nested structures
    const complexOperationArb = fc.record({
      operationId: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{1,19}$/),
      responses: fc.constant({
        "200": {
          description: "Success",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  items: { type: "array", items: { type: "object" } },
                  pagination: { type: "object", properties: { nextToken: { type: "string" } } },
                },
              },
            },
          },
        },
      }),
      "x-custom-metadata": fc.dictionary(
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/),
        fc.jsonValue(),
        { minKeys: 0, maxKeys: 3 },
      ),
      security: fc.option(
        fc.array(fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.array(fc.string({ minLength: 1, maxLength: 10 }))), { minLength: 1, maxLength: 2 }),
        { nil: undefined },
      ),
      requestBody: fc.option(
        fc.record({
          required: fc.boolean(),
          content: fc.constant({ "application/json": { schema: { type: "object" } } }),
        }),
        { nil: undefined },
      ),
    });

    await fc.assert(
      fc.asyncProperty(complexOperationArb, async (operationObject) => {
        mockIdentifyApiModel.mockReturnValue("testModel.json");
        mockIdentifyApiName.mockReturnValue("SomeApi");
        mockIdentifyApiVersion.mockReturnValue("2024-01-01");

        mockEnforcerRequest.mockReturnValue([
          {
            operation: operationObject,
            path: { resourceId: "res-123" },
            query: { limit: "10" },
          },
          undefined,
        ]);

        const mockRequest = {
          path: "/some/api/path",
          method: "POST",
          query: { limit: "10" },
          headers: {},
          body: { name: "test" },
        } as unknown as Request;

        const result = await validateRequest(mockRequest);

        expect(result.pass).toBe(true);

        const passResult = result as UnifiedValidationPass;

        // Exact same reference — no transformation
        expect(passResult.operation).toBe(operationObject);
        expect(passResult.operation).toEqual(operationObject);
      }),
      { numRuns: 100 },
    );
  });
});
