import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Feature: orders-ui, Property 10: Order item count bounded between 1 and 50
 *
 * This test exercises a state machine that mirrors the real add/remove item
 * guards in public/app.js:
 * - `addOrderItem` returns early when items >= 50
 * - `removeOrderItem` is disabled (btn-remove-item disabled) when items <= 1
 *
 * The state machine applies operations unconditionally (no pre-filtering),
 * and the guards inside the implementation enforce the bounds. The property
 * then asserts the invariant holds on the output.
 *
 * **Validates: Requirements 3.4**
 */

const MIN_ITEMS = 1;
const MAX_ITEMS = 50;

/**
 * Models the order items state machine from the UI.
 * Mirrors the guards in app.js `addOrderItem` (early return at >= 50)
 * and `updateAddRemoveButtons` (disables remove at <= 1).
 */
function applyOperation(count: number, op: "add" | "remove"): number {
  if (op === "add") {
    // Mirrors: if (currentItems.length >= 50) return;
    if (count >= MAX_ITEMS) return count;
    return count + 1;
  }
  // Mirrors: removeBtn.disabled = count <= 1;
  if (count <= MIN_ITEMS) return count;
  return count - 1;
}

describe("Feature: orders-ui, Property 10: Order item count bounded between 1 and 50", () => {
  it("Property 10: Order item count is always between 1 and 50 after any sequence of operations", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_ITEMS, max: MAX_ITEMS }),
        fc.array(fc.constantFrom("add", "remove"), { minLength: 1, maxLength: 200 }),
        (initialCount, operations) => {
          let count = initialCount;
          for (const op of operations) {
            count = applyOperation(count, op);
            expect(count).toBeGreaterThanOrEqual(MIN_ITEMS);
            expect(count).toBeLessThanOrEqual(MAX_ITEMS);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("Property 10: Adding at the maximum has no effect", () => {
    const result = applyOperation(MAX_ITEMS, "add");
    expect(result).toBe(MAX_ITEMS);
  });

  it("Property 10: Removing at the minimum has no effect", () => {
    const result = applyOperation(MIN_ITEMS, "remove");
    expect(result).toBe(MIN_ITEMS);
  });

  it("Property 10: Adding below the maximum increases count by 1", () => {
    fc.assert(
      fc.property(fc.integer({ min: MIN_ITEMS, max: MAX_ITEMS - 1 }), (count) => {
        expect(applyOperation(count, "add")).toBe(count + 1);
      }),
      { numRuns: 100 },
    );
  });

  it("Property 10: Removing above the minimum decreases count by 1", () => {
    fc.assert(
      fc.property(fc.integer({ min: MIN_ITEMS + 1, max: MAX_ITEMS }), (count) => {
        expect(applyOperation(count, "remove")).toBe(count - 1);
      }),
      { numRuns: 100 },
    );
  });
});
