import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  Operation,
  RateLimit,
  isOperation,
} from "../../src/tools/code-generation-tools/models/operation";

/**
 * Feature: code-generation-tools-filtering-enhancements
 * Property-based tests for Operation model with rate limit support
 */

/**
 * Arbitrary generator for RateLimit
 */
const rateLimitArbitrary = fc.oneof(
  fc.constant(null),
  fc
    .record({
      requestsPerSecond: fc.option(
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        { nil: undefined },
      ),
      requestsPerMinute: fc.option(
        fc.double({ min: 1, max: 6000, noNaN: true }),
        { nil: undefined },
      ),
    })
    .filter(
      (rl) =>
        rl.requestsPerSecond !== undefined ||
        rl.requestsPerMinute !== undefined,
    ),
);

/**
 * Arbitrary generator for Parameter
 */
const parameterArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }),
  description: fc.string({ minLength: 0, maxLength: 100 }),
  type: fc.string({ minLength: 1, maxLength: 20 }),
  required: fc.boolean(),
});

/**
 * Arbitrary generator for Operation
 */
const operationArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  callMethod: fc.string({ minLength: 1, maxLength: 100 }),
  inputParameters: fc.option(fc.array(parameterArbitrary, { maxLength: 10 }), {
    nil: undefined,
  }),
  returnedModel: fc.string({ minLength: 1, maxLength: 50 }),
  rateLimit: rateLimitArbitrary,
});

describe("Property Tests: Rate Limit Field Presence", () => {
  /**
   * Property 7: Rate Limit Field Presence
   * Validates: Requirements 3.1, 3.3
   *
   * For any operation returned by the get-operations tool, the operation object
   * should contain a rateLimit field (which may be null if rate limit information
   * is unavailable).
   */
  it("Property 7: all operations have rateLimit field (null or RateLimit object)", () => {
    fc.assert(
      fc.property(operationArbitrary, (operation) => {
        // Every operation must have a rateLimit field
        expect(operation).toHaveProperty("rateLimit");

        // The rateLimit field must be either null or a valid RateLimit object
        if (operation.rateLimit !== null) {
          expect(typeof operation.rateLimit).toBe("object");

          // Must have at least one rate limit field
          const hasRequestsPerSecond =
            operation.rateLimit.requestsPerSecond !== undefined;
          const hasRequestsPerMinute =
            operation.rateLimit.requestsPerMinute !== undefined;
          expect(hasRequestsPerSecond || hasRequestsPerMinute).toBe(true);

          // If present, must be positive numbers
          if (hasRequestsPerSecond) {
            expect(typeof operation.rateLimit.requestsPerSecond).toBe("number");
            expect(operation.rateLimit.requestsPerSecond).toBeGreaterThan(0);
          }

          if (hasRequestsPerMinute) {
            expect(typeof operation.rateLimit.requestsPerMinute).toBe("number");
            expect(operation.rateLimit.requestsPerMinute).toBeGreaterThan(0);
          }
        }

        // The operation should pass the type guard
        expect(isOperation(operation)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("Property 7: operations with null rateLimit are valid", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ minLength: 0, maxLength: 200 }),
          callMethod: fc.string({ minLength: 1, maxLength: 100 }),
          inputParameters: fc.option(
            fc.array(parameterArbitrary, { maxLength: 10 }),
            { nil: undefined },
          ),
          returnedModel: fc.string({ minLength: 1, maxLength: 50 }),
          rateLimit: fc.constant(null),
        }),
        (operation) => {
          expect(operation.rateLimit).toBeNull();
          expect(isOperation(operation)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 7: operations with valid rateLimit object are valid", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ minLength: 0, maxLength: 200 }),
          callMethod: fc.string({ minLength: 1, maxLength: 100 }),
          inputParameters: fc.option(
            fc.array(parameterArbitrary, { maxLength: 10 }),
            { nil: undefined },
          ),
          returnedModel: fc.string({ minLength: 1, maxLength: 50 }),
          rateLimit: fc
            .record({
              requestsPerSecond: fc.option(
                fc.double({ min: 0.01, max: 100, noNaN: true }),
                { nil: undefined },
              ),
              requestsPerMinute: fc.option(
                fc.double({ min: 1, max: 6000, noNaN: true }),
                { nil: undefined },
              ),
            })
            .filter(
              (rl) =>
                rl.requestsPerSecond !== undefined ||
                rl.requestsPerMinute !== undefined,
            ),
        }),
        (operation) => {
          expect(operation.rateLimit).not.toBeNull();
          expect(typeof operation.rateLimit).toBe("object");
          expect(isOperation(operation)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 7: operations without rateLimit field are invalid", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ minLength: 0, maxLength: 200 }),
          callMethod: fc.string({ minLength: 1, maxLength: 100 }),
          returnedModel: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (operation) => {
          // Operation without rateLimit field should fail type guard
          expect(isOperation(operation)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Property Tests: Rate Limit Structure", () => {
  /**
   * Property 8: Rate Limit Structure
   * Validates: Requirements 3.4
   *
   * For any operation where rateLimit is not null, the rateLimit object should
   * contain at least one of requestsPerSecond or requestsPerMinute as a positive number.
   */
  it("Property 8: non-null rateLimit has at least one positive rate field", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ minLength: 0, maxLength: 200 }),
          callMethod: fc.string({ minLength: 1, maxLength: 100 }),
          inputParameters: fc.option(
            fc.array(parameterArbitrary, { maxLength: 10 }),
            { nil: undefined },
          ),
          returnedModel: fc.string({ minLength: 1, maxLength: 50 }),
          rateLimit: fc
            .record({
              requestsPerSecond: fc.option(
                fc.double({ min: 0.01, max: 100, noNaN: true }),
                { nil: undefined },
              ),
              requestsPerMinute: fc.option(
                fc.double({ min: 1, max: 6000, noNaN: true }),
                { nil: undefined },
              ),
            })
            .filter(
              (rl) =>
                rl.requestsPerSecond !== undefined ||
                rl.requestsPerMinute !== undefined,
            ),
        }),
        (operation) => {
          expect(operation.rateLimit).not.toBeNull();

          const hasRequestsPerSecond =
            operation.rateLimit!.requestsPerSecond !== undefined;
          const hasRequestsPerMinute =
            operation.rateLimit!.requestsPerMinute !== undefined;

          // Must have at least one field
          expect(hasRequestsPerSecond || hasRequestsPerMinute).toBe(true);

          // If requestsPerSecond is present, it must be positive
          if (hasRequestsPerSecond) {
            expect(operation.rateLimit!.requestsPerSecond).toBeGreaterThan(0);
          }

          // If requestsPerMinute is present, it must be positive
          if (hasRequestsPerMinute) {
            expect(operation.rateLimit!.requestsPerMinute).toBeGreaterThan(0);
          }

          // Operation should be valid
          expect(isOperation(operation)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 8: rateLimit with only requestsPerSecond is valid", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ minLength: 0, maxLength: 200 }),
          callMethod: fc.string({ minLength: 1, maxLength: 100 }),
          returnedModel: fc.string({ minLength: 1, maxLength: 50 }),
          rateLimit: fc.record({
            requestsPerSecond: fc.double({ min: 0.01, max: 100, noNaN: true }),
          }),
        }),
        (operation) => {
          expect(operation.rateLimit!.requestsPerSecond).toBeGreaterThan(0);
          expect(operation.rateLimit!.requestsPerMinute).toBeUndefined();
          expect(isOperation(operation)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 8: rateLimit with only requestsPerMinute is valid", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ minLength: 0, maxLength: 200 }),
          callMethod: fc.string({ minLength: 1, maxLength: 100 }),
          returnedModel: fc.string({ minLength: 1, maxLength: 50 }),
          rateLimit: fc.record({
            requestsPerMinute: fc.double({ min: 1, max: 6000, noNaN: true }),
          }),
        }),
        (operation) => {
          expect(operation.rateLimit!.requestsPerMinute).toBeGreaterThan(0);
          expect(operation.rateLimit!.requestsPerSecond).toBeUndefined();
          expect(isOperation(operation)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 8: rateLimit with both fields is valid", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ minLength: 0, maxLength: 200 }),
          callMethod: fc.string({ minLength: 1, maxLength: 100 }),
          returnedModel: fc.string({ minLength: 1, maxLength: 50 }),
          rateLimit: fc.record({
            requestsPerSecond: fc.double({ min: 0.01, max: 100, noNaN: true }),
            requestsPerMinute: fc.double({ min: 1, max: 6000, noNaN: true }),
          }),
        }),
        (operation) => {
          expect(operation.rateLimit!.requestsPerSecond).toBeGreaterThan(0);
          expect(operation.rateLimit!.requestsPerMinute).toBeGreaterThan(0);
          expect(isOperation(operation)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 8: rateLimit with zero or negative values is invalid", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ minLength: 0, maxLength: 200 }),
          callMethod: fc.string({ minLength: 1, maxLength: 100 }),
          returnedModel: fc.string({ minLength: 1, maxLength: 50 }),
          rateLimit: fc.oneof(
            fc.record({ requestsPerSecond: fc.constant(0) }),
            fc.record({
              requestsPerSecond: fc.double({ max: -0.01, noNaN: true }),
            }),
            fc.record({ requestsPerMinute: fc.constant(0) }),
            fc.record({
              requestsPerMinute: fc.double({ max: -0.01, noNaN: true }),
            }),
          ),
        }),
        (operation) => {
          // Operation with invalid rate limit should fail type guard
          expect(isOperation(operation)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 8: rateLimit with no fields is invalid", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ minLength: 0, maxLength: 200 }),
          callMethod: fc.string({ minLength: 1, maxLength: 100 }),
          returnedModel: fc.string({ minLength: 1, maxLength: 50 }),
          rateLimit: fc.constant({}),
        }),
        (operation) => {
          // Operation with empty rate limit object should fail type guard
          expect(isOperation(operation)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
