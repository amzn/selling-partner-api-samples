import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { deriveNotificationType } from "../../src/controller/notificationsManagementController.js";

/**
 * Arbitrary that generates a single PascalCase word (starts with uppercase, followed by lowercase letters).
 */
const arbPascalWord = fc
  .tuple(
    fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")),
    fc.array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")), { minLength: 1, maxLength: 8 }),
  )
  .map(([first, rest]) => first + rest.join(""));

/**
 * Arbitrary that generates a PascalCase string with "Notification" suffix.
 * E.g. "OrderChange" + "Notification" = "OrderChangeNotification"
 */
const arbPascalCaseWithNotificationSuffix = fc.array(arbPascalWord, { minLength: 1, maxLength: 4 }).map((words) => words.join("") + "Notification");

describe("deriveNotificationType Property Tests", () => {
  /**
   * Property 7: PascalCase filename to UPPER_SNAKE_CASE conversion
   * **Validates: Requirements 7.2**
   *
   * For any PascalCase string with a "Notification" suffix, the deriveNotificationType function
   * shall strip the suffix, split on word boundaries, join with underscores, and uppercase the result,
   * producing a valid UPPER_SNAKE_CASE notification type.
   */

  it("Property 7a: Output format contains only uppercase letters, digits, and underscores", () => {
    fc.assert(
      fc.property(arbPascalCaseWithNotificationSuffix, (input) => {
        const result = deriveNotificationType(input);
        expect(result).toMatch(/^[A-Z0-9_]+$/);
      }),
      { numRuns: 100 },
    );
  });

  it("Property 7b: The word NOTIFICATION does not appear in the output (suffix is stripped)", () => {
    fc.assert(
      fc.property(arbPascalCaseWithNotificationSuffix, (input) => {
        const result = deriveNotificationType(input);
        expect(result).not.toContain("NOTIFICATION");
      }),
      { numRuns: 100 },
    );
  });

  it("Property 7c: Output is not empty for valid PascalCase input with at least one word before Notification", () => {
    fc.assert(
      fc.property(arbPascalCaseWithNotificationSuffix, (input) => {
        const result = deriveNotificationType(input);
        expect(result.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});
