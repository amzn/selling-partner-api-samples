import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Feature: orders-ui, Property 11: Date formatting preserves information
 *
 * For any valid ISO 8601 date-time string, formatting it for display and then parsing
 * the displayed string back should represent the same point in time (to minute precision).
 *
 * **Validates: Requirements 1.2**
 */

/** Inline format function matching the frontend implementation */
function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

describe("Feature: orders-ui, Property 11: Date formatting preserves information", () => {
  it("formatting and parsing back preserves the same point in time to minute precision", () => {
    fc.assert(
      fc.property(fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31"), noInvalidDate: true }), (date) => {
        const isoString = date.toISOString();
        const formatted = formatDateTime(isoString);

        // formatDateTime uses local time methods (getFullYear, getMonth, getHours, etc.)
        // so the formatted string represents local time. Parse it back as local time.
        const parsed = new Date(formatted.replace(" ", "T"));

        // Verify same point in time to minute precision (60000ms = 1 minute)
        const originalMinutes = Math.floor(date.getTime() / 60000);
        const parsedMinutes = Math.floor(parsed.getTime() / 60000);
        expect(parsedMinutes).toBe(originalMinutes);
      }),
      { numRuns: 100 },
    );
  });
});
