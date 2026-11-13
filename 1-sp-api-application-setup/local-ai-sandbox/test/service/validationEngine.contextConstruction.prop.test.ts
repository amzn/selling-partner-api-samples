import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { Request } from "express";

/**
 * Property 22: Successful schema validation constructs correct RequestContext
 *
 * Generate valid requests against known SP-API models; verify the unified pass result
 * contains the correct operationId, apiName, apiVersion, pathParams, and queryParams
 * as extracted by the openapi-enforcer.
 *
 * **Validates: Requirements 12.5, 12.6**
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

// Mock apiSchemaIdentificationService to return model file, apiName, and apiVersion
vi.mock("../../src/service/apiSchemaIdentificationService.js", () => ({
  identifyApiModel: (...args: unknown[]) => mockIdentifyApiModel(...args),
  identifyApiName: (...args: unknown[]) => mockIdentifyApiName(...args),
  identifyApiVersion: (...args: unknown[]) => mockIdentifyApiVersion(...args),
}));

// Mock the validation registry to have an empty pipeline (so it passes through)
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

// Mock the Context singleton (needed for pipeline execution even though no pipeline exists)
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

describe("Feature: deterministic-validation-system, Property 22: Successful schema validation constructs correct RequestContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Property 22: Successful schema validation returns correct operationId, apiName, apiVersion, pathParams, and queryParams", async () => {
    // Arbitraries for the fields returned by the enforcer and identification service
    const operationIdArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{1,29}$/);
    const apiNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,29}$/);
    const apiVersionArb = fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,14}$/);
    const pathParamsArb = fc.dictionary(
      fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/),
      fc.string({ minLength: 1, maxLength: 30 }),
      { minKeys: 0, maxKeys: 4 },
    );
    const queryParamsArb = fc.dictionary(
      fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/),
      fc.string({ minLength: 1, maxLength: 30 }),
      { minKeys: 0, maxKeys: 4 },
    );

    await fc.assert(
      fc.asyncProperty(operationIdArb, apiNameArb, apiVersionArb, pathParamsArb, queryParamsArb, async (operationId, apiName, apiVersion, pathParams, queryParams) => {
        // Configure mocks for this iteration
        mockIdentifyApiModel.mockReturnValue("testModel.json");
        mockIdentifyApiName.mockReturnValue(apiName);
        mockIdentifyApiVersion.mockReturnValue(apiVersion);

        // Mock openapi-enforcer to return a successful validation result
        mockEnforcerRequest.mockReturnValue([
          {
            operation: { operationId },
            path: pathParams,
            query: queryParams,
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

        // Verify the fields match what the enforcer/identification service returned
        expect(passResult.operationId).toBe(operationId);
        expect(passResult.apiName).toBe(apiName);
        expect(passResult.apiVersion).toBe(apiVersion);
        expect(passResult.pathParams).toEqual(pathParams);
        expect(passResult.queryParams).toEqual(queryParams);
        // No pipeline registered, so resolvedEntities should be empty
        expect(passResult.resolvedEntities).toEqual({});
      }),
      { numRuns: 100 },
    );
  });
});
