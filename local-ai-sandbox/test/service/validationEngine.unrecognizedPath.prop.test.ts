import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { validateRequest } from "../../src/service/validationEngine.js";
import { Request } from "express";

/**
 * Mock openapi-enforcer — should never be reached for unrecognized paths
 */
vi.mock("openapi-enforcer", () => ({
  default: vi.fn().mockRejectedValue(new Error("openapi-enforcer should not be called for unrecognized paths")),
}));

/**
 * Mock apiSchemaIdentificationService to return undefined for identifyApiModel,
 * simulating an unrecognized path that doesn't match any known SP-API model.
 */
vi.mock("../../src/service/apiSchemaIdentificationService.js", () => ({
  identifyApiModel: vi.fn().mockReturnValue(undefined),
  identifyApiName: vi.fn().mockReturnValue(undefined),
  identifyApiVersion: vi.fn().mockReturnValue(undefined),
}));

/**
 * Feature: deterministic-validation-system
 * Property 20: Unrecognized path returns 404 without body
 *
 * For any request whose path does not match any known SP-API model file in the
 * API schema identification service, the unified validation entry point SHALL
 * return a fail result with HTTP 404 and no error body.
 *
 * **Validates: Requirements 12.3**
 */
describe("Feature: deterministic-validation-system, Property 20: Unrecognized path returns 404 without body", () => {
  it("Property 20: Any unrecognized path returns { pass: false, statusCode: 404, body: undefined }", async () => {
    // Generate arbitrary request paths that won't match any known SP-API model path prefix
    const unrecognizedPathArb = fc.oneof(
      // Random alphanumeric path segments
      fc.array(fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/), { minLength: 1, maxLength: 5 }).map((segments) => "/" + segments.join("/")),
      // Paths that look API-like but aren't real SP-API paths
      fc.tuple(fc.constantFrom("/random", "/unknown", "/fake", "/test", "/api", "/v1", "/v2", "/foo"), fc.stringMatching(/^\/[a-zA-Z0-9_-]{1,15}$/)).map(
        ([prefix, suffix]) => prefix + suffix,
      ),
      // Single segment paths
      fc.stringMatching(/^\/[a-zA-Z][a-zA-Z0-9_-]{0,30}$/).filter(
        (path) =>
          !path.includes("/orders/") &&
          !path.includes("/listings/") &&
          !path.includes("/catalog/") &&
          !path.includes("/fba/") &&
          !path.includes("/externalFulfillment/") &&
          !path.includes("/batches/") &&
          !path.includes("/reports/"),
      ),
    );

    const methodArb = fc.constantFrom("GET", "POST", "PUT", "DELETE", "PATCH");

    await fc.assert(
      fc.asyncProperty(unrecognizedPathArb, methodArb, async (path, method) => {
        // Build a minimal Express-like request object
        const mockRequest = {
          path,
          method,
          query: {},
          headers: {},
          body: undefined,
        } as unknown as Request;

        const result = await validateRequest(mockRequest);

        // The unified entry point should return a 404 fail with no body
        expect(result.pass).toBe(false);
        if (!result.pass) {
          expect(result.statusCode).toBe(404);
          expect(result.body).toBeUndefined();
        }
      }),
      { numRuns: 100 },
    );
  });
});
