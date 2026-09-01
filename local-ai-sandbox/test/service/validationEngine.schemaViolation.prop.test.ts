import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import type { Request } from "express";

/**
 * Property 21: Schema violation returns 400 with error details
 *
 * Generate requests that match a known SP-API model path but violate the OpenAPI schema
 * (invalid query params, missing required params, invalid body); verify the result is
 * `{ pass: false, statusCode: 400, body: { errors: <non-empty string> } }`
 *
 * **Validates: Requirements 12.4**
 */

// Mock openapi-enforcer to simulate schema validation failures
const mockEnforcerRequest = vi.fn();
vi.mock("openapi-enforcer", () => ({
  default: vi.fn(() =>
    Promise.resolve({
      request: mockEnforcerRequest,
    }),
  ),
}));

// Mock apiSchemaIdentificationService to return a model file name (simulating a recognized path)
vi.mock("../../src/service/apiSchemaIdentificationService.js", () => ({
  identifyApiModel: vi.fn(() => "ordersV0.json"),
  identifyApiName: vi.fn(() => "Orders"),
  identifyApiVersion: vi.fn(() => "v0"),
}));

// Mock the validation registry so pipeline lookup returns no rules (we only test schema stage)
vi.mock("../../src/validation/validationRegistry.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/validation/validationRegistry.js")>();
  return {
    ...original,
    VALIDATION_REGISTRY: new Map(),
  };
});

describe("Feature: deterministic-validation-system, Property 21: Schema violation returns 400 with error details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Property 21: Schema violation always returns pass:false, statusCode:400, body with non-empty errors string", async () => {
    // Dynamically import validateRequest after mocks are set up
    const { validateRequest } = await import("../../src/service/validationEngine.js");

    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary non-empty error strings to verify they're passed through
        fc.string({ minLength: 1, maxLength: 200 }),
        // Generate an HTTP method
        fc.constantFrom("GET", "POST", "PUT", "DELETE", "PATCH"),
        // Generate a path that would match a known SP-API model
        fc.constantFrom("/orders/v0/orders/123-456", "/orders/v0/orders", "/orders/v0/orders/abc/shipment"),
        async (errorMessage, method, path) => {
          // Set up the enforcer mock to return a schema validation error
          const errorObject = {
            toString: () => errorMessage,
          };
          mockEnforcerRequest.mockReturnValue([undefined, errorObject]);

          // Build a minimal Express-like request object
          const request = {
            method,
            path,
            query: {},
            headers: {},
            body: {},
          } as unknown as Request;

          const result = await validateRequest(request);

          // Verify the result structure
          expect(result.pass).toBe(false);

          if (!result.pass) {
            expect(result.statusCode).toBe(400);
            expect(result.body).toBeDefined();
            expect(result.body).toHaveProperty("errors");

            const body = result.body as { errors: Array<{ code: string; message: string }> };
            expect(Array.isArray(body.errors)).toBe(true);
            expect(body.errors.length).toBeGreaterThan(0);
            expect(body.errors[0].code).toBe("SchemaValidationError");
            if (errorMessage.trim().length > 0) expect(body.errors[0].message.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 21: The error string from enforcer is passed through (normalized) in the response body", async () => {
    const { validateRequest } = await import("../../src/service/validationEngine.js");

    await fc.assert(
      fc.asyncProperty(
        // Generate error strings with various whitespace patterns to test normalization
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        async (errorMessage) => {
          const errorObject = {
            toString: () => errorMessage,
          };
          mockEnforcerRequest.mockReturnValue([undefined, errorObject]);

          const request = {
            method: "GET",
            path: "/orders/v0/orders/test-id",
            query: {},
            headers: {},
            body: {},
          } as unknown as Request;

          const result = await validateRequest(request);

          expect(result.pass).toBe(false);

          if (!result.pass) {
            expect(result.statusCode).toBe(400);

            const body = result.body as { errors: Array<{ code: string; message: string }> };
            // The engine normalizes whitespace: replaces \s+ with single space and trims
            const expectedNormalized = errorMessage.replace(/\s+/g, " ").trim();
            expect(body.errors[0].message).toBe(expectedNormalized);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
