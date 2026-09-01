import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";
import { encodePageToken } from "../../src/service/Paginator.js";

// Mock find function — tests set the return value via mockFind.mockReturnValue(...)
const mockFind = vi.fn<() => Record<string, unknown>[]>().mockReturnValue([]);

// Mock the Context singleton so engine.find returns our controlled data
vi.mock("../../src/database/Context.js", () => ({
  Api: { INVENTORY: "inventory" },
  Context: {
    get instance() {
      return {
        engine: {
          find: mockFind,
        },
      };
    },
  },
}));

import { getInventorySummariesHandler } from "../../src/operation/fbaInventoryOperations.js";

/**
 * Creates a minimal valid UnifiedValidationPass object for testing the handler.
 */
function makeValidationResult(queryParams: Record<string, string | string[] | undefined> = {}): UnifiedValidationPass {
  return {
    pass: true,
    operationId: "getInventorySummaries",
    apiName: "FBA Inventory",
    apiVersion: "v1",
    pathParams: {},
    queryParams: {
      granularityType: "Marketplace",
      granularityId: "ATVPDKIKX0DER",
      ...queryParams,
    },
    body: undefined,
    resolvedEntities: {},
    operation: {},
  };
}

/**
 * Creates a mock inventory item with sensible defaults.
 */
function makeInventoryItem(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    sellerSku: "SKU-001",
    asin: "B08N5WRWNW",
    fnSku: "FN-001",
    productName: "Test Product",
    condition: "NewItem",
    totalQuantity: 100,
    lastUpdatedTime: "2024-06-15T10:00:00Z",
    inventoryDetails: {
      fulfillableQuantity: 80,
      inboundWorkingQuantity: 10,
      inboundShippedQuantity: 5,
      inboundReceivingQuantity: 5,
    },
    ...overrides,
  };
}

describe("getInventorySummariesHandler", () => {
  beforeEach(() => {
    mockFind.mockReturnValue([]);
  });

  describe("response shape", () => {
    it("returns correct response shape with payload containing granularity and inventorySummaries, HTTP 200", async () => {
      mockFind.mockReturnValue([makeInventoryItem()]);

      const result = await getInventorySummariesHandler(makeValidationResult({ details: "true" }), {} as any);

      expect(result.statusCode).toBe(200);
      const body = result.data.body as Record<string, unknown>;
      expect(body).toHaveProperty("payload");
      const payload = body.payload as Record<string, unknown>;
      expect(payload).toHaveProperty("granularity");
      expect(payload).toHaveProperty("inventorySummaries");
      expect(payload.granularity).toEqual({
        granularityType: "Marketplace",
        granularityId: "ATVPDKIKX0DER",
      });
      expect(Array.isArray(payload.inventorySummaries)).toBe(true);
    });
  });

  describe("empty database", () => {
    it("returns empty inventorySummaries array with HTTP 200", async () => {
      mockFind.mockReturnValue([]);

      const result = await getInventorySummariesHandler(makeValidationResult(), {} as any);

      expect(result.statusCode).toBe(200);
      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      expect(payload.inventorySummaries).toEqual([]);
    });
  });

  describe("sellerSkus filter", () => {
    it("returns only items matching the sellerSkus list", async () => {
      mockFind.mockReturnValue([
        makeInventoryItem({ sellerSku: "SKU-A" }),
        makeInventoryItem({ sellerSku: "SKU-B" }),
        makeInventoryItem({ sellerSku: "SKU-C" }),
      ]);

      const result = await getInventorySummariesHandler(makeValidationResult({ sellerSkus: "SKU-A,SKU-C" }), {} as any);

      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      const summaries = payload.inventorySummaries as Record<string, unknown>[];
      expect(summaries).toHaveLength(2);
      const skus = summaries.map((s) => s.sellerSku);
      expect(skus).toContain("SKU-A");
      expect(skus).toContain("SKU-C");
      expect(skus).not.toContain("SKU-B");
    });

    it("returns only items matching when sellerSkus is an array", async () => {
      mockFind.mockReturnValue([
        makeInventoryItem({ sellerSku: "SKU-A" }),
        makeInventoryItem({ sellerSku: "SKU-B" }),
        makeInventoryItem({ sellerSku: "SKU-C" }),
      ]);

      const result = await getInventorySummariesHandler(makeValidationResult({ sellerSkus: ["SKU-B"] }), {} as any);

      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      const summaries = payload.inventorySummaries as Record<string, unknown>[];
      expect(summaries).toHaveLength(1);
      expect(summaries[0].sellerSku).toBe("SKU-B");
    });
  });

  describe("sellerSku filter", () => {
    it("returns only the matching item", async () => {
      mockFind.mockReturnValue([
        makeInventoryItem({ sellerSku: "SKU-A" }),
        makeInventoryItem({ sellerSku: "SKU-B" }),
        makeInventoryItem({ sellerSku: "SKU-C" }),
      ]);

      const result = await getInventorySummariesHandler(makeValidationResult({ sellerSku: "SKU-B" }), {} as any);

      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      const summaries = payload.inventorySummaries as Record<string, unknown>[];
      expect(summaries).toHaveLength(1);
      expect(summaries[0].sellerSku).toBe("SKU-B");
    });
  });

  describe("sellerSkus precedence over sellerSku", () => {
    it("sellerSkus takes precedence when both are provided", async () => {
      mockFind.mockReturnValue([
        makeInventoryItem({ sellerSku: "SKU-A" }),
        makeInventoryItem({ sellerSku: "SKU-B" }),
        makeInventoryItem({ sellerSku: "SKU-C" }),
      ]);

      const result = await getInventorySummariesHandler(
        makeValidationResult({ sellerSkus: "SKU-A,SKU-C", sellerSku: "SKU-B" }),
        {} as any,
      );

      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      const summaries = payload.inventorySummaries as Record<string, unknown>[];
      expect(summaries).toHaveLength(2);
      const skus = summaries.map((s) => s.sellerSku);
      expect(skus).toContain("SKU-A");
      expect(skus).toContain("SKU-C");
      expect(skus).not.toContain("SKU-B");
    });
  });

  describe("startDateTime filter", () => {
    it("returns only items with lastUpdatedTime strictly after startDateTime", async () => {
      mockFind.mockReturnValue([
        makeInventoryItem({ sellerSku: "SKU-OLD", lastUpdatedTime: "2024-01-01T00:00:00Z" }),
        makeInventoryItem({ sellerSku: "SKU-EXACT", lastUpdatedTime: "2024-06-01T00:00:00Z" }),
        makeInventoryItem({ sellerSku: "SKU-NEW", lastUpdatedTime: "2024-06-15T10:00:00Z" }),
      ]);

      const result = await getInventorySummariesHandler(makeValidationResult({ startDateTime: "2024-06-01T00:00:00Z" }), {} as any);

      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      const summaries = payload.inventorySummaries as Record<string, unknown>[];
      // Only items strictly after startDateTime
      expect(summaries).toHaveLength(1);
      expect(summaries[0].sellerSku).toBe("SKU-NEW");
    });

    it("excludes items without lastUpdatedTime", async () => {
      mockFind.mockReturnValue([
        makeInventoryItem({ sellerSku: "SKU-NO-DATE", lastUpdatedTime: undefined }),
        makeInventoryItem({ sellerSku: "SKU-WITH-DATE", lastUpdatedTime: "2024-07-01T00:00:00Z" }),
      ]);

      const result = await getInventorySummariesHandler(makeValidationResult({ startDateTime: "2024-06-01T00:00:00Z" }), {} as any);

      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      const summaries = payload.inventorySummaries as Record<string, unknown>[];
      expect(summaries).toHaveLength(1);
      expect(summaries[0].sellerSku).toBe("SKU-WITH-DATE");
    });
  });

  describe("startDateTime precedence over SKU params", () => {
    it("startDateTime takes precedence — ignores sellerSkus and sellerSku", async () => {
      mockFind.mockReturnValue([
        makeInventoryItem({ sellerSku: "SKU-A", lastUpdatedTime: "2024-01-01T00:00:00Z" }),
        makeInventoryItem({ sellerSku: "SKU-B", lastUpdatedTime: "2024-07-01T00:00:00Z" }),
        makeInventoryItem({ sellerSku: "SKU-C", lastUpdatedTime: "2024-08-01T00:00:00Z" }),
      ]);

      // Provide startDateTime AND sellerSkus (which should be ignored)
      const result = await getInventorySummariesHandler(
        makeValidationResult({
          startDateTime: "2024-06-01T00:00:00Z",
          sellerSkus: "SKU-A",
          sellerSku: "SKU-A",
        }),
        {} as any,
      );

      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      const summaries = payload.inventorySummaries as Record<string, unknown>[];
      // startDateTime filter returns SKU-B and SKU-C (both after 2024-06-01), ignoring SKU filters
      expect(summaries).toHaveLength(2);
      const skus = summaries.map((s) => s.sellerSku);
      expect(skus).toContain("SKU-B");
      expect(skus).toContain("SKU-C");
      expect(skus).not.toContain("SKU-A");
    });
  });

  describe("details toggle", () => {
    it("includes inventoryDetails when details=true", async () => {
      mockFind.mockReturnValue([
        makeInventoryItem({
          sellerSku: "SKU-A",
          inventoryDetails: { fulfillableQuantity: 50 },
        }),
      ]);

      const result = await getInventorySummariesHandler(makeValidationResult({ details: "true" }), {} as any);

      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      const summaries = payload.inventorySummaries as Record<string, unknown>[];
      expect(summaries[0]).toHaveProperty("inventoryDetails");
      expect(summaries[0].inventoryDetails).toEqual({ fulfillableQuantity: 50 });
    });

    it("omits inventoryDetails when details is absent", async () => {
      mockFind.mockReturnValue([
        makeInventoryItem({
          sellerSku: "SKU-A",
          inventoryDetails: { fulfillableQuantity: 50 },
        }),
      ]);

      const result = await getInventorySummariesHandler(makeValidationResult({}), {} as any);

      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      const summaries = payload.inventorySummaries as Record<string, unknown>[];
      expect(summaries[0]).not.toHaveProperty("inventoryDetails");
    });

    it("omits inventoryDetails when details=false", async () => {
      mockFind.mockReturnValue([
        makeInventoryItem({
          sellerSku: "SKU-A",
          inventoryDetails: { fulfillableQuantity: 50 },
        }),
      ]);

      const result = await getInventorySummariesHandler(makeValidationResult({ details: "false" }), {} as any);

      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      const summaries = payload.inventorySummaries as Record<string, unknown>[];
      expect(summaries[0]).not.toHaveProperty("inventoryDetails");
    });
  });

  describe("granularity echo", () => {
    it("echoes granularityType and granularityId in response payload.granularity", async () => {
      mockFind.mockReturnValue([]);

      const result = await getInventorySummariesHandler(
        makeValidationResult({ granularityType: "Marketplace", granularityId: "A1F83G8C2ARO7P" }),
        {} as any,
      );

      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      expect(payload.granularity).toEqual({
        granularityType: "Marketplace",
        granularityId: "A1F83G8C2ARO7P",
      });
    });
  });

  describe("invalid nextToken", () => {
    it("returns empty inventorySummaries for invalid nextToken (graceful degradation)", async () => {
      mockFind.mockReturnValue([makeInventoryItem({ sellerSku: "SKU-A" })]);

      const result = await getInventorySummariesHandler(makeValidationResult({ nextToken: "totally-invalid-token" }), {} as any);

      expect(result.statusCode).toBe(200);
      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      expect(payload.inventorySummaries).toEqual([]);
    });

    it("returns empty inventorySummaries for out-of-range nextToken", async () => {
      mockFind.mockReturnValue([makeInventoryItem({ sellerSku: "SKU-A" })]);

      // Encode an offset beyond the items length
      const result = await getInventorySummariesHandler(makeValidationResult({ nextToken: encodePageToken(999) }), {} as any);

      expect(result.statusCode).toBe(200);
      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      expect(payload.inventorySummaries).toEqual([]);
    });
  });

  // Feature: fba-inventory-api, Property 5: Details Toggle
  describe("Property 5: Details Toggle Controls inventoryDetails Inclusion", () => {
    it("when details='true', inventoryDetails is present on every returned item", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              sellerSku: fc.string({ minLength: 1, maxLength: 20 }),
              asin: fc.string({ minLength: 1, maxLength: 10 }),
              inventoryDetails: fc.record({
                fulfillableQuantity: fc.nat(1000),
                inboundWorkingQuantity: fc.nat(500),
              }),
            }),
            { minLength: 1, maxLength: 30 },
          ),
          async (items) => {
            const dbItems = items.map((item) => makeInventoryItem(item));
            mockFind.mockReturnValue(dbItems);

            const result = await getInventorySummariesHandler(makeValidationResult({ details: "true" }), {} as any);

            const body = result.data.body as Record<string, unknown>;
            const payload = body.payload as Record<string, unknown>;
            const summaries = payload.inventorySummaries as Record<string, unknown>[];

            // Every returned item should have inventoryDetails
            for (const summary of summaries) {
              expect(summary).toHaveProperty("inventoryDetails");
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("when details is not 'true', inventoryDetails is omitted from every returned item", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              sellerSku: fc.string({ minLength: 1, maxLength: 20 }),
              asin: fc.string({ minLength: 1, maxLength: 10 }),
              inventoryDetails: fc.record({
                fulfillableQuantity: fc.nat(1000),
                inboundWorkingQuantity: fc.nat(500),
              }),
            }),
            { minLength: 1, maxLength: 30 },
          ),
          // Generate a details value that is NOT "true"
          fc.oneof(fc.constant(undefined), fc.constant("false"), fc.constant(""), fc.constant("FALSE"), fc.constant("0")),
          async (items, detailsValue) => {
            const dbItems = items.map((item) => makeInventoryItem(item));
            mockFind.mockReturnValue(dbItems);

            const qp: Record<string, string | string[] | undefined> = {};
            if (detailsValue !== undefined) {
              qp.details = detailsValue;
            }

            const result = await getInventorySummariesHandler(makeValidationResult(qp), {} as any);

            const body = result.data.body as Record<string, unknown>;
            const payload = body.payload as Record<string, unknown>;
            const summaries = payload.inventorySummaries as Record<string, unknown>[];

            // No returned item should have inventoryDetails
            for (const summary of summaries) {
              expect(summary).not.toHaveProperty("inventoryDetails");
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
  // **Validates: Requirements 1.7**

  describe("pagination", () => {
    it("returns nextToken when results exceed page size (50)", async () => {
      // Create 55 items
      mockFind.mockReturnValue(Array.from({ length: 55 }, (_, i) => makeInventoryItem({ sellerSku: `SKU-${String(i).padStart(3, "0")}` })));

      const result = await getInventorySummariesHandler(makeValidationResult({ details: "true" }), {} as any);

      expect(result.statusCode).toBe(200);
      const body = result.data.body as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown>;
      const summaries = payload.inventorySummaries as Record<string, unknown>[];
      expect(summaries).toHaveLength(50);
      expect(body).toHaveProperty("pagination");
      const pagination = (body as any).pagination;
      expect(pagination).toHaveProperty("nextToken");
      expect(typeof pagination.nextToken).toBe("string");
    });

    it("does not include pagination when results fit in one page", async () => {
      mockFind.mockReturnValue(Array.from({ length: 30 }, (_, i) => makeInventoryItem({ sellerSku: `SKU-${i}` })));

      const result = await getInventorySummariesHandler(makeValidationResult({ details: "true" }), {} as any);

      const body = result.data.body as Record<string, unknown>;
      expect(body).not.toHaveProperty("pagination");
    });

    it("pagination traverses all items without duplicates or omissions", async () => {
      const totalItems = 125;
      mockFind.mockReturnValue(
        Array.from({ length: totalItems }, (_, i) => makeInventoryItem({ sellerSku: `SKU-${String(i).padStart(3, "0")}` })),
      );

      const allCollected: Record<string, unknown>[] = [];
      let nextToken: string | undefined = undefined;

      // Traverse all pages
      for (let page = 0; page < 10; page++) {
        const qp: Record<string, string | string[] | undefined> = { details: "true" };
        if (nextToken) qp.nextToken = nextToken;

        const result = await getInventorySummariesHandler(makeValidationResult(qp), {} as any);
        const body = result.data.body as Record<string, unknown>;
        const payload = body.payload as Record<string, unknown>;
        const summaries = payload.inventorySummaries as Record<string, unknown>[];
        allCollected.push(...summaries);

        const pagination = (body as any).pagination;
        if (pagination?.nextToken) {
          nextToken = pagination.nextToken as string;
        } else {
          break;
        }
      }

      // Verify completeness: all 125 items collected
      expect(allCollected).toHaveLength(totalItems);

      // Verify no duplicates
      const skuSet = new Set(allCollected.map((item) => item.sellerSku));
      expect(skuSet.size).toBe(totalItems);

      // Verify all expected SKUs are present
      for (let i = 0; i < totalItems; i++) {
        expect(skuSet.has(`SKU-${String(i).padStart(3, "0")}`)).toBe(true);
      }
    });
  });

  // Feature: fba-inventory-api, Property 1: SKU Filtering Correctness
  // Validates: Requirements 1.1, 1.2, 1.3
  describe("Property 1: SKU Filtering Correctness", () => {
    // Arbitrary for generating unique SKU identifiers (no commas, non-empty)
    const skuArb = fc.stringMatching(/^[A-Za-z0-9_-]{1,20}$/);

    // Arbitrary for a list of items with unique SKUs and a non-empty subset of those SKUs
    const itemsAndSkuSubsetArb = fc
      .uniqueArray(skuArb, { minLength: 1, maxLength: 30, comparator: (a, b) => a === b })
      .chain((skus) => {
        const items = skus.map((sku) => makeInventoryItem({ sellerSku: sku }));
        // Generate a non-empty subset of SKUs (1 to min(skus.length, 50))
        return fc.subarray(skus, { minLength: 1, maxLength: Math.min(skus.length, 50) }).map((subset) => ({
          items,
          selectedSkus: subset,
        }));
      });

    it("returned items are exactly those whose sellerSku is in the provided SKU list (comma-separated string)", async () => {
      await fc.assert(
        fc.asyncProperty(itemsAndSkuSubsetArb, async ({ items, selectedSkus }) => {
          mockFind.mockReturnValue(items);

          const result = await getInventorySummariesHandler(
            makeValidationResult({ sellerSkus: selectedSkus.join(",") }),
            {} as any,
          );

          const body = result.data.body as Record<string, unknown>;
          const payload = body.payload as Record<string, unknown>;
          const summaries = payload.inventorySummaries as Record<string, unknown>[];

          // Assert: returned items are exactly those whose sellerSku is in the selected list
          const returnedSkus = summaries.map((s) => s.sellerSku as string).sort();
          const expectedSkus = [...selectedSkus].sort();

          expect(returnedSkus).toEqual(expectedSkus);
        }),
        { numRuns: 100 },
      );
    });

    it("when no SKU filter and no startDateTime, all items are returned", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(skuArb, { minLength: 0, maxLength: 40, comparator: (a, b) => a === b }),
          async (skus) => {
            const items = skus.map((sku) => makeInventoryItem({ sellerSku: sku }));
            mockFind.mockReturnValue(items);

            const result = await getInventorySummariesHandler(makeValidationResult({}), {} as any);

            const body = result.data.body as Record<string, unknown>;
            const payload = body.payload as Record<string, unknown>;
            const summaries = payload.inventorySummaries as Record<string, unknown>[];

            // All items should be returned (up to page size)
            const expectedCount = Math.min(items.length, 50);
            expect(summaries).toHaveLength(expectedCount);

            // If items fit in one page, all should be present
            if (items.length <= 50) {
              const returnedSkus = summaries.map((s) => s.sellerSku as string).sort();
              const allSkus = [...skus].sort();
              expect(returnedSkus).toEqual(allSkus);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("returned items are exactly those whose sellerSku is in the provided SKU list (array)", async () => {
      await fc.assert(
        fc.asyncProperty(itemsAndSkuSubsetArb, async ({ items, selectedSkus }) => {
          mockFind.mockReturnValue(items);

          // Pass sellerSkus as an array (the handler supports both string and string[])
          const result = await getInventorySummariesHandler(
            makeValidationResult({ sellerSkus: selectedSkus }),
            {} as any,
          );

          const body = result.data.body as Record<string, unknown>;
          const payload = body.payload as Record<string, unknown>;
          const summaries = payload.inventorySummaries as Record<string, unknown>[];

          const returnedSkus = summaries.map((s) => s.sellerSku as string).sort();
          const expectedSkus = [...selectedSkus].sort();

          expect(returnedSkus).toEqual(expectedSkus);
        }),
        { numRuns: 100 },
      );
    });
  });

  // Feature: fba-inventory-api, Property 4: Granularity Metadata Echo
  // **Validates: Requirements 1.6**
  describe("Property 4: Granularity Metadata Echo", () => {
    it("response payload.granularity exactly matches provided granularityType and granularityId query params", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
          async (granularityType, granularityId) => {
            mockFind.mockReturnValue([]);

            const result = await getInventorySummariesHandler(makeValidationResult({ granularityType, granularityId }), {} as any);

            const body = result.data.body as Record<string, unknown>;
            const payload = body.payload as Record<string, unknown>;
            const granularity = payload.granularity as Record<string, unknown>;

            expect(granularity).toEqual({
              granularityType,
              granularityId,
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it("granularity echo works regardless of inventory items in database", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
          fc.array(fc.record({ sellerSku: fc.string({ minLength: 1, maxLength: 20 }) }), { minLength: 0, maxLength: 10 }),
          async (granularityType, granularityId, items) => {
            mockFind.mockReturnValue(items.map((item) => makeInventoryItem(item)));

            const result = await getInventorySummariesHandler(makeValidationResult({ granularityType, granularityId }), {} as any);

            const body = result.data.body as Record<string, unknown>;
            const payload = body.payload as Record<string, unknown>;
            const granularity = payload.granularity as Record<string, unknown>;

            expect(granularity.granularityType).toBe(granularityType);
            expect(granularity.granularityId).toBe(granularityId);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: fba-inventory-api, Property 2: Parameter Precedence
  // **Validates: Requirements 1.4**
  describe("Property 2: Parameter Precedence — sellerSkus Overrides sellerSku", () => {
    it("sellerSkus takes priority over sellerSku for any combination of SKUs", async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a pool of unique SKU strings (at least 3 so we can split them)
          fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes(",")), { minLength: 3, maxLength: 20 }),
          // Generate a seed to determine the split point
          fc.nat(),
          async (skuPool, splitSeed) => {
            // Split: pick at least 1 SKU for sellerSkus, keep at least 1 for sellerSku (not in sellerSkus)
            const sellerSkusCount = (splitSeed % (skuPool.length - 1)) + 1; // 1 to pool.length - 1
            const sellerSkusList = skuPool.slice(0, sellerSkusCount);
            // Pick a SKU NOT in sellerSkusList to use as sellerSku
            const remainingSkus = skuPool.slice(sellerSkusCount);
            const sellerSku = remainingSkus[0];

            // Create inventory items for all SKUs in the pool
            const allItems = skuPool.map((sku) => makeInventoryItem({ sellerSku: sku }));
            mockFind.mockReturnValue(allItems);

            // Provide both sellerSkus (comma-separated) and sellerSku
            const result = await getInventorySummariesHandler(
              makeValidationResult({
                sellerSkus: sellerSkusList.join(","),
                sellerSku: sellerSku,
              }),
              {} as any,
            );

            const body = result.data.body as Record<string, unknown>;
            const payload = body.payload as Record<string, unknown>;
            const summaries = payload.inventorySummaries as Record<string, unknown>[];
            const returnedSkus = summaries.map((s) => s.sellerSku as string);

            // Assert: results match only the sellerSkus list
            expect(returnedSkus.length).toBe(sellerSkusList.length);
            expect(returnedSkus.sort()).toEqual(sellerSkusList.sort());

            // Assert: sellerSku value has no effect (not in results since it's not in sellerSkusList)
            expect(returnedSkus).not.toContain(sellerSku);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: fba-inventory-api, Property 6: Pagination Completeness
  // **Validates: Requirements 1.9**
  describe("Property 6: Pagination Completeness", () => {
    it("iterating all pages produces the full result set with no duplicates and no omissions", async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate between 51 and 200 unique SKUs to ensure multiple pages
          fc.integer({ min: 51, max: 200 }),
          async (itemCount) => {
            // Create items with unique SKUs
            const items = Array.from({ length: itemCount }, (_, i) =>
              makeInventoryItem({ sellerSku: `SKU-${String(i).padStart(4, "0")}` }),
            );
            mockFind.mockReturnValue(items);

            const allCollected: Record<string, unknown>[] = [];
            let nextToken: string | undefined = undefined;
            const maxPages = Math.ceil(itemCount / 50) + 1; // safety bound

            // Iterate through all pages following pagination.nextToken
            for (let page = 0; page < maxPages; page++) {
              const qp: Record<string, string | string[] | undefined> = {};
              if (nextToken) qp.nextToken = nextToken;

              const result = await getInventorySummariesHandler(makeValidationResult(qp), {} as any);
              const body = result.data.body as Record<string, unknown>;
              const payload = body.payload as Record<string, unknown>;
              const summaries = payload.inventorySummaries as Record<string, unknown>[];

              allCollected.push(...summaries);

              const pagination = (body as any).pagination;
              if (pagination?.nextToken) {
                nextToken = pagination.nextToken as string;
              } else {
                break;
              }
            }

            // Assert: concatenated results equal the full set (no omissions)
            expect(allCollected).toHaveLength(itemCount);

            // Assert: no duplicates
            const skuSet = new Set(allCollected.map((item) => item.sellerSku as string));
            expect(skuSet.size).toBe(itemCount);

            // Assert: every expected SKU is present
            for (let i = 0; i < itemCount; i++) {
              expect(skuSet.has(`SKU-${String(i).padStart(4, "0")}`)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: fba-inventory-api, Property 3: startDateTime Filtering and SKU Exclusion
  // **Validates: Requirements 1.5**
  describe("Property 3: startDateTime Filtering and SKU Exclusion", () => {
    it("returns only items with lastUpdatedTime strictly after startDateTime", async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 1–20 inventory items with random lastUpdatedTime values (some may be undefined)
          fc.array(
            fc.record({
              sellerSku: fc.stringMatching(/^[A-Z0-9]{3,10}$/),
              lastUpdatedTime: fc.option(
                fc.integer({ min: 1577836800000, max: 1798761600000 }).map((ms) => new Date(ms).toISOString()),
                { nil: undefined },
              ),
            }),
            { minLength: 1, maxLength: 20 },
          ),
          // Generate a startDateTime within a reasonable range
          fc.integer({ min: 1609459200000, max: 1767225600000 }).map((ms) => new Date(ms).toISOString()),
          async (items, startDateTime) => {
            // Build inventory items with full structure
            const inventoryItems = items.map((item) =>
              makeInventoryItem({
                sellerSku: item.sellerSku,
                lastUpdatedTime: item.lastUpdatedTime,
              }),
            );

            mockFind.mockReturnValue(inventoryItems);

            const result = await getInventorySummariesHandler(makeValidationResult({ startDateTime }), {} as any);

            const body = result.data.body as Record<string, unknown>;
            const payload = body.payload as Record<string, unknown>;
            const summaries = payload.inventorySummaries as Record<string, unknown>[];

            // Compute expected: only items with lastUpdatedTime strictly after startDateTime
            const expected = inventoryItems.filter((item) => {
              const lastUpdated = item.lastUpdatedTime as string | undefined;
              if (!lastUpdated) return false;
              return lastUpdated > startDateTime;
            });

            // Assert: correct number of items returned
            expect(summaries).toHaveLength(expected.length);

            // Assert: every returned item has lastUpdatedTime strictly after startDateTime
            for (const summary of summaries) {
              const lastUpdated = summary.lastUpdatedTime as string;
              expect(lastUpdated).toBeDefined();
              expect(lastUpdated > startDateTime).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("sellerSkus and sellerSku params have no effect when startDateTime is present", async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 1–15 inventory items with random lastUpdatedTime values
          fc.array(
            fc.record({
              sellerSku: fc.stringMatching(/^[A-Z0-9]{3,10}$/),
              lastUpdatedTime: fc.option(
                fc.integer({ min: 1577836800000, max: 1798761600000 }).map((ms) => new Date(ms).toISOString()),
                { nil: undefined },
              ),
            }),
            { minLength: 1, maxLength: 15 },
          ),
          // Generate a startDateTime as a timestamp in range then convert to ISO
          fc.integer({ min: 1609459200000, max: 1767225600000 }).map((ms) => new Date(ms).toISOString()),
          // Generate sellerSkus param (comma-separated)
          fc.stringMatching(/^[A-Z0-9]{3,10}(,[A-Z0-9]{3,10}){0,4}$/),
          // Generate sellerSku param
          fc.stringMatching(/^[A-Z0-9]{3,10}$/),
          async (items, startDateTime, sellerSkus, sellerSku) => {
            const inventoryItems = items.map((item) =>
              makeInventoryItem({
                sellerSku: item.sellerSku,
                lastUpdatedTime: item.lastUpdatedTime,
              }),
            );

            mockFind.mockReturnValue(inventoryItems);

            // Call WITH SKU params
            const resultWithSkus = await getInventorySummariesHandler(
              makeValidationResult({ startDateTime, sellerSkus, sellerSku }),
              {} as any,
            );

            // Call WITHOUT SKU params (only startDateTime)
            const resultWithoutSkus = await getInventorySummariesHandler(
              makeValidationResult({ startDateTime }),
              {} as any,
            );

            const bodyWith = resultWithSkus.data.body as Record<string, unknown>;
            const payloadWith = bodyWith.payload as Record<string, unknown>;
            const summariesWith = payloadWith.inventorySummaries as Record<string, unknown>[];

            const bodyWithout = resultWithoutSkus.data.body as Record<string, unknown>;
            const payloadWithout = bodyWithout.payload as Record<string, unknown>;
            const summariesWithout = payloadWithout.inventorySummaries as Record<string, unknown>[];

            // Assert: both calls produce the same results (SKU params had no effect)
            const skusWithParams = summariesWith.map((s) => s.sellerSku as string).sort();
            const skusWithoutParams = summariesWithout.map((s) => s.sellerSku as string).sort();
            expect(skusWithParams).toEqual(skusWithoutParams);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
