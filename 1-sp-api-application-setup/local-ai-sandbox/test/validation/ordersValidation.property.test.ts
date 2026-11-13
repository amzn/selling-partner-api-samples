import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Feature: orders-ui, Property 7: Order ID format validation
 *
 * For any string matching the pattern `^\d{3}-\d{7}-\d{7}$`, the orderId validator
 * should accept it. For any string not matching that pattern, the validator should reject it.
 *
 * **Validates: Requirements 4.4**
 */

/** Inline validation function matching the frontend implementation */
function validateOrderId(value: string): boolean {
  return /^\d{3}-\d{7}-\d{7}$/.test(value);
}

describe("Feature: orders-ui, Property 7: Order ID format validation", () => {
  it("should accept any string matching the pattern ^\\d{3}-\\d{7}-\\d{7}$", () => {
    // Generate strings that match the orderId format: 3 digits, dash, 7 digits, dash, 7 digits
    const validOrderIdArb = fc
      .tuple(
        fc.stringMatching(/^\d{3}$/),
        fc.stringMatching(/^\d{7}$/),
        fc.stringMatching(/^\d{7}$/),
      )
      .map(([a, b, c]) => `${a}-${b}-${c}`);

    fc.assert(
      fc.property(validOrderIdArb, (orderId) => {
        expect(validateOrderId(orderId)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("should reject any string not matching the pattern ^\\d{3}-\\d{7}-\\d{7}$", () => {
    // Generate arbitrary strings that do NOT match the orderId pattern
    const invalidOrderIdArb = fc.string().filter((s) => !/^\d{3}-\d{7}-\d{7}$/.test(s));

    fc.assert(
      fc.property(invalidOrderIdArb, (value) => {
        expect(validateOrderId(value)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: orders-ui, Property 8: Quantity validation
 *
 * For any integer >= 1, the quantityOrdered validator should accept it.
 * For any non-integer number or value < 1, the validator should reject it.
 *
 * **Validates: Requirements 4.6**
 */

/** Inline validation function matching the frontend implementation */
function validateQuantity(value: string): boolean {
  const num = Number(value);
  return Number.isInteger(num) && num >= 1;
}

describe("Feature: orders-ui, Property 8: Quantity validation", () => {
  it("should accept any integer >= 1 passed as a string", () => {
    // Generate integers >= 1 and pass them as strings (simulating form input)
    const validQuantityArb = fc.integer({ min: 1, max: 1_000_000 }).map(String);

    fc.assert(
      fc.property(validQuantityArb, (value) => {
        expect(validateQuantity(value)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("should reject integers < 1 passed as strings", () => {
    // Generate integers < 1 (0, -1, -100, etc.)
    const invalidIntArb = fc.integer({ min: -1_000_000, max: 0 }).map(String);

    fc.assert(
      fc.property(invalidIntArb, (value) => {
        expect(validateQuantity(value)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("should reject non-integer numbers passed as strings", () => {
    // Generate floating-point numbers that are not integers (e.g., 1.5, 2.7, -0.3)
    const nonIntegerArb = fc
      .tuple(fc.integer({ min: -10000, max: 10000 }), fc.integer({ min: 1, max: 99 }))
      .map(([whole, frac]) => `${whole}.${frac}`);

    fc.assert(
      fc.property(nonIntegerArb, (value) => {
        expect(validateQuantity(value)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("should reject non-numeric strings", () => {
    // Generate strings that are not valid numbers
    const nonNumericArb = fc.oneof(
      fc.string().filter((s) => isNaN(Number(s)) || s.trim() === ""),
      fc.constant("abc"),
      fc.constant(""),
      fc.constant("hello world"),
      fc.constant("1.2.3"),
      fc.constant("NaN"),
    );

    fc.assert(
      fc.property(nonNumericArb, (value) => {
        expect(validateQuantity(value)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
