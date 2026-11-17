import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { filterCatalogItem, INCLUDED_DATA_CATEGORIES } from "../../src/operation/catalogItemsOperations.js";

// --- Generators ---

/** Arbitrary subset of valid includedData categories */
const arbIncludedData = fc.subarray([...INCLUDED_DATA_CATEGORIES], { minLength: 0 });

/** Arbitrary catalog item with random categories populated — always includes asin */
const arbCatalogItem = fc.record(
  {
    asin: fc.string({ minLength: 1, maxLength: 20 }),
    summaries: fc.array(fc.record({ itemName: fc.string(), brand: fc.string() }), { minLength: 1, maxLength: 3 }),
    attributes: fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string()),
    classifications: fc.array(fc.record({ classificationId: fc.string() }), { minLength: 1, maxLength: 3 }),
    dimensions: fc.array(fc.record({ height: fc.integer() }), { minLength: 1, maxLength: 2 }),
    identifiers: fc.array(fc.record({ identifierType: fc.string(), identifier: fc.string() }), { minLength: 1, maxLength: 3 }),
    images: fc.array(fc.record({ link: fc.webUrl() }), { minLength: 1, maxLength: 3 }),
    productTypes: fc.array(fc.record({ productType: fc.string() }), { minLength: 1, maxLength: 2 }),
    relationships: fc.array(fc.record({ type: fc.string() }), { minLength: 1, maxLength: 2 }),
    salesRanks: fc.array(fc.record({ rank: fc.integer() }), { minLength: 1, maxLength: 2 }),
    vendorDetails: fc.array(fc.record({ vendorCode: fc.string() }), { minLength: 1, maxLength: 2 }),
  },
  { requiredKeys: ["asin"] },
);

describe("filterCatalogItem Property-Based Tests", () => {
  // Feature: catalog-items-api, Property 1: includedData filtering preserves asin and only requested categories
  it("Property 1: includedData filtering preserves asin and only requested categories", () => {
    /**
     * Validates: Requirements 3.2, 3.4, 6.1, 6.2, 6.3
     *
     * For any stored catalog item with arbitrary data categories populated, and for any
     * non-empty subset of valid includedData values, applying the filter function SHALL
     * produce an object that contains the asin field and exactly the requested data
     * categories (if present on the item), with no other top-level keys.
     */
    fc.assert(
      fc.property(arbCatalogItem, arbIncludedData, (item, includedData) => {
        const result = filterCatalogItem(item, includedData);

        // asin is always present (generator guarantees asin exists on item)
        expect(result).toHaveProperty("asin", item.asin);

        // Compute expected keys: asin + each requested category that exists on the item
        const expectedKeys = new Set<string>(["asin"]);
        for (const cat of includedData) {
          if (cat in item) expectedKeys.add(cat);
        }

        // Result must have exactly the expected keys
        expect(new Set(Object.keys(result))).toEqual(expectedKeys);

        // Each included category value must match the original
        for (const category of includedData) {
          const presentOnItem = category in item;
          const presentOnResult = category in result;
          expect(presentOnResult).toBe(presentOnItem);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: catalog-items-api, Property 2: Missing categories are silently omitted
  it("Property 2: Missing categories are silently omitted", () => {
    /**
     * Validates: Requirements 6.4
     *
     * For any stored catalog item that is missing one or more data categories, and for any
     * includedData value referencing a missing category, the filter function SHALL return
     * successfully (no error thrown) and the missing category SHALL not appear in the output.
     */
    fc.assert(
      fc.property(arbCatalogItem, arbIncludedData, (item, includedData) => {
        // No error should be thrown
        const result = filterCatalogItem(item, includedData);

        // Identify categories that are in includedData but NOT on the item
        const missingCategories = includedData.filter((cat) => !(cat in item));

        // None of the missing categories should appear in the result
        for (const category of missingCategories) {
          expect(result).not.toHaveProperty(category);
        }

        // Result should still have asin
        expect(result).toHaveProperty("asin");
      }),
      { numRuns: 100 },
    );
  });
});
