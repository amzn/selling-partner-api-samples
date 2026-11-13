import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Mirrors the numeric validation logic from public/app.js:
 *
 * if (inputType === "number") {
 *   const strValue = input.value.trim();
 *   if (strValue !== "") {
 *     const num = Number(strValue);
 *     if (isNaN(num)) {
 *       // Show error: "Must be a valid number"
 *       isValid = false;
 *     }
 *   }
 * }
 *
 * Returns an error message if the value is non-numeric for a number-type field,
 * or null if the value is valid.
 */
function validateNumericField(value: string): string | null {
  const strValue = value.trim();
  if (strValue !== "") {
    const num = Number(strValue);
    if (isNaN(num)) {
      return "Must be a valid number";
    }
  }
  return null;
}

/**
 * Arbitrary that generates non-numeric strings that are non-empty after trimming
 * and produce NaN when passed to Number().
 */
const arbNonNumericString = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim() !== "" && isNaN(Number(s.trim())));

/**
 * Arbitrary that generates valid numeric strings (integers, decimals, negative, scientific notation).
 */
const arbValidNumericString = fc.oneof(
  fc.integer().map(String),
  fc.float({ noNaN: true, noDefaultInfinity: true }).map(String),
  fc.integer().map((n) => `-${Math.abs(n)}`),
  fc
    .tuple(fc.float({ min: Math.fround(1), max: Math.fround(9.5), noNaN: true, noDefaultInfinity: true }), fc.integer({ min: -10, max: 10 }))
    .map(([base, exp]) => `${base}e${exp}`),
);

describe("Numeric Field Validation Property Tests", () => {
  /**
   * Property 6: Numeric field validation rejects non-numeric input
   * **Validates: Requirements 5.5**
   *
   * For any form field backed by a schema property of type "integer" or "number",
   * if the entered value is not a valid numeric string, validation SHALL fail
   * and display an error for that field.
   */

  it("Property 6a: Non-numeric strings are rejected with an error", () => {
    fc.assert(
      fc.property(arbNonNumericString, (value) => {
        const error = validateNumericField(value);
        expect(error).toBe("Must be a valid number");
      }),
      {
        numRuns: 100,
        examples: [["12abc"], ["abc"], ["1.2.3"], ["e5"], [" abc "]],
      },
    );
  });

  it("Property 6b: Valid numeric strings are accepted without error", () => {
    fc.assert(
      fc.property(arbValidNumericString, (value) => {
        const error = validateNumericField(value);
        expect(error).toBeNull();
      }),
      {
        numRuns: 100,
        examples: [["0"], ["42"], ["-7"], ["3.14"], ["1e10"], ["1.5e-3"]],
      },
    );
  });

  it("Property 6c: Empty and whitespace-only strings pass validation (no error)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("", " ", "  ", "\t", "\n", "  \t  "),
        (value) => {
          const error = validateNumericField(value);
          expect(error).toBeNull();
        },
      ),
      { numRuns: 20 },
    );
  });
});
