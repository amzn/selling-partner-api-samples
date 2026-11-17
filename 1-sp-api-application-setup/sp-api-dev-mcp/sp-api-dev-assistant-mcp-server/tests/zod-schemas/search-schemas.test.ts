import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { searchSchema } from "../../src/zod-schemas/search-schemas";
import { z } from "zod";

describe("Search Schemas", () => {
  describe("searchSchema", () => {
    // =========================================================================
    // Property-Based Tests
    // Feature: contextual-search, Property 9: Schema validation rejects invalid input and accepts valid input
    // **Validates: Requirements 10.1, 10.3**
    // =========================================================================
    describe("property-based tests", () => {
      it("should accept any non-empty string query with valid top_k", () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1 }),
            fc.integer({ min: 1, max: 1000 }),
            (query, top_k) => {
              const result = searchSchema.safeParse({ query, top_k });
              expect(result.success).toBe(true);
              if (result.success) {
                expect(result.data.query).toBe(query);
                expect(result.data.top_k).toBe(top_k);
              }
            },
          ),
          { numRuns: 100 },
        );
      });

      it("should accept any non-empty string query without top_k (uses default)", () => {
        fc.assert(
          fc.property(fc.string({ minLength: 1 }), (query) => {
            const result = searchSchema.safeParse({ query });
            expect(result.success).toBe(true);
            if (result.success) {
              expect(result.data.query).toBe(query);
              expect(result.data.top_k).toBe(15);
            }
          }),
          { numRuns: 100 },
        );
      });

      it("should reject empty string query", () => {
        fc.assert(
          fc.property(fc.integer({ min: 1, max: 100 }), (top_k) => {
            const result = searchSchema.safeParse({ query: "", top_k });
            expect(result.success).toBe(false);
          }),
          { numRuns: 100 },
        );
      });

      it("should reject non-positive top_k values", () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1 }),
            fc.integer({ min: -1000, max: 0 }),
            (query, top_k) => {
              const result = searchSchema.safeParse({ query, top_k });
              expect(result.success).toBe(false);
            },
          ),
          { numRuns: 100 },
        );
      });

      it("should reject non-integer top_k values", () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1 }),
            fc
              .double({ min: 0.01, max: 1000, noNaN: true })
              .filter((n) => !Number.isInteger(n)),
            (query, top_k) => {
              const result = searchSchema.safeParse({ query, top_k });
              expect(result.success).toBe(false);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    // =========================================================================
    // Unit Tests
    // =========================================================================
    describe("valid inputs", () => {
      it("should accept query with top_k", () => {
        const result = searchSchema.safeParse({
          query: "How do I use the Orders API?",
          top_k: 10,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query).toBe("How do I use the Orders API?");
          expect(result.data.top_k).toBe(10);
        }
      });

      it("should accept query without top_k and apply default of 15", () => {
        const result = searchSchema.safeParse({ query: "rate limiting" });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query).toBe("rate limiting");
          expect(result.data.top_k).toBe(15);
        }
      });

      it("should accept query with top_k of 1", () => {
        const result = searchSchema.safeParse({ query: "feeds API", top_k: 1 });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.top_k).toBe(1);
        }
      });
    });

    describe("invalid inputs", () => {
      it("should reject empty query string", () => {
        const result = searchSchema.safeParse({ query: "" });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("query");
        }
      });

      it("should reject missing query", () => {
        const result = searchSchema.safeParse({ top_k: 5 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("query");
        }
      });

      it("should reject top_k of 0", () => {
        const result = searchSchema.safeParse({ query: "test", top_k: 0 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("top_k");
        }
      });

      it("should reject negative top_k", () => {
        const result = searchSchema.safeParse({ query: "test", top_k: -3 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("top_k");
        }
      });

      it("should reject float top_k", () => {
        const result = searchSchema.safeParse({ query: "test", top_k: 3.5 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("top_k");
        }
      });

      it("should reject non-string query", () => {
        const result = searchSchema.safeParse({ query: 123 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("query");
        }
      });

      it("should reject empty object", () => {
        const result = searchSchema.safeParse({});
        expect(result.success).toBe(false);
      });
    });

    describe("type inference", () => {
      it("should infer correct TypeScript type", () => {
        type SearchInput = z.infer<typeof searchSchema>;

        const validData: SearchInput = {
          query: "SP-API throttling",
          top_k: 10,
        };

        expect(validData.query).toBe("SP-API throttling");
        expect(validData.top_k).toBe(10);
      });
    });
  });
});
