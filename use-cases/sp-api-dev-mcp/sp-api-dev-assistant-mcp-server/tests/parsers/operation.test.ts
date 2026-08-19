import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  isRateLimit,
  validateRateLimit,
} from "../../src/tools/code-generation-tools/models/operation.js";

/**
 * Property-based tests for RateLimit model extensions.
 *
 * Uses fast-check to generate valid and invalid RateLimit objects
 * and verify the type guard and validation function behavior.
 */

/** Arbitrary for positive finite numbers (valid rate limit values) */
const positiveNumber = fc.double({
  min: 0.001,
  max: 1e6,
  noNaN: true,
  noDefaultInfinity: true,
});

/** Arbitrary for non-positive numbers (invalid rate limit values) */
const nonPositiveNumber = fc.oneof(
  fc.constant(0),
  fc.double({ min: -1e6, max: -0.001, noNaN: true, noDefaultInfinity: true }),
);

/** Arbitrary for non-number values */
const nonNumber = fc.oneof(
  fc.string(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.array(fc.integer()),
);

describe("RateLimit Property Tests", () => {
  /**
   * Property 1: Type guard accepts extended RateLimit objects
   *
   * For any RateLimit with valid requestsPerSecond/requestsPerMinute and
   * optionally valid burst/intervalInSeconds, isRateLimit returns true.
   *
   * **Validates: Requirements 1.1, 1.2, 1.5**
   */
  describe("Property 1: Type guard accepts extended RateLimit objects", () => {
    it("should accept RateLimit with valid base fields and optional valid burst/intervalInSeconds", () => {
      const rateLimitArb = fc
        .record(
          {
            requestsPerSecond: positiveNumber,
            requestsPerMinute: positiveNumber,
            burst: positiveNumber,
            intervalInSeconds: positiveNumber,
          },
          { requiredKeys: [] },
        )
        .filter(
          (obj) =>
            obj.requestsPerSecond !== undefined ||
            obj.requestsPerMinute !== undefined,
        );

      fc.assert(
        fc.property(rateLimitArb, (rateLimit) => {
          expect(isRateLimit(rateLimit)).toBe(true);
        }),
        { numRuns: 200 },
      );
    });
  });

  /**
   * Property 2: Validation rejects invalid burst and intervalInSeconds
   *
   * For any object where burst is present but not a positive number,
   * or intervalInSeconds is present but not a positive number,
   * validateRateLimit returns non-empty errors.
   *
   * **Validates: Requirements 1.3, 1.4, 1.6**
   */
  describe("Property 2: Validation rejects invalid burst and intervalInSeconds", () => {
    it("should reject objects with invalid burst values", () => {
      const invalidBurstArb = fc
        .record({
          requestsPerSecond: positiveNumber,
          burst: fc.oneof(
            nonPositiveNumber,
            nonNumber.filter((v) => v !== undefined),
          ),
        })
        .filter((obj) => obj.burst !== undefined);

      fc.assert(
        fc.property(invalidBurstArb, (obj) => {
          const errors = validateRateLimit(obj);
          expect(errors.length).toBeGreaterThan(0);
          expect(errors.some((e: string) => e.includes("burst"))).toBe(true);
        }),
        { numRuns: 200 },
      );
    });

    it("should reject objects with invalid intervalInSeconds values", () => {
      const invalidIntervalArb = fc
        .record({
          requestsPerSecond: positiveNumber,
          intervalInSeconds: fc.oneof(
            nonPositiveNumber,
            nonNumber.filter((v) => v !== undefined),
          ),
        })
        .filter((obj) => obj.intervalInSeconds !== undefined);

      fc.assert(
        fc.property(invalidIntervalArb, (obj) => {
          const errors = validateRateLimit(obj);
          expect(errors.length).toBeGreaterThan(0);
          expect(
            errors.some((e: string) => e.includes("intervalInSeconds")),
          ).toBe(true);
        }),
        { numRuns: 200 },
      );
    });
  });

  /**
   * Property 8: Backward compatibility of existing RateLimit objects
   *
   * For any RateLimit with only requestsPerSecond or requestsPerMinute
   * (no burst/intervalInSeconds), isRateLimit returns true and
   * validateRateLimit returns empty array.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  describe("Property 8: Backward compatibility", () => {
    it("should accept and validate RateLimit objects with only original fields", () => {
      const legacyRateLimitArb = fc
        .record(
          {
            requestsPerSecond: positiveNumber,
            requestsPerMinute: positiveNumber,
          },
          { requiredKeys: [] },
        )
        .filter(
          (obj) =>
            obj.requestsPerSecond !== undefined ||
            obj.requestsPerMinute !== undefined,
        );

      fc.assert(
        fc.property(legacyRateLimitArb, (rateLimit) => {
          expect(isRateLimit(rateLimit)).toBe(true);
          expect(validateRateLimit(rateLimit)).toEqual([]);
        }),
        { numRuns: 200 },
      );
    });
  });
});
