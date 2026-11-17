import { describe, it, expect, beforeEach } from "vitest";
import { Context, Api } from "../../src/database/Context.js";
import { processListingSubmission } from "../../src/trigger/handlers/processListingSubmission.js";
import { DataEvent } from "../../src/trigger/DataEvent.js";
import { listingKey } from "../../src/operation/listingsItemModel.js";

const MP = "ATVPDKIKX0DER";
const SELLER = "AMY6FKRUBY7XV";

/**
 * Catalog matching, the sandbox's stand-in for Amazon's asynchronous
 * downstream processing of a submission. Driven directly here; the
 * put-to-trigger path is covered in listingsOperations.test.ts.
 */
describe("processListingSubmission", () => {
  beforeEach(() => {
    Context.reset();
  });

  const event = (sku: string): DataEvent => ({
    type: "UPDATE",
    api: Api.LISTINGS,
    id: listingKey(SELLER, sku),
    entity: undefined,
    previousEntity: undefined,
  });

  /** Writes fixture data without firing triggers. */
  function seed(domain: Api, key: string, doc: Record<string, unknown>): void {
    Context.instance.engine.put(domain, key, doc, { silent: true });
  }

  function seedListing(sku: string, overrides: Record<string, unknown> = {}) {
    seed(Api.LISTINGS, listingKey(SELLER, sku), {
      sellerId: SELLER,
      sku,
      productType: "PRODUCT",
      marketplaceId: MP,
      attributes: {},
      issues: [],
      mfnAvailability: [],
      createdDate: "2026-01-01T00:00:00.000Z",
      lastUpdatedDate: "2026-01-01T00:00:00.000Z",
      ...overrides,
    });
  }

  function issueCodes(sku: string): string[] {
    return ((Context.instance.engine.get(Api.LISTINGS, listingKey(SELLER, sku))?.issues as { code: string }[] | undefined) ?? []).map((i) => i.code);
  }

  it("does nothing for a listing that no longer exists", () => {
    expect(() => {
      processListingSubmission(event("SKU-GONE"));
    }).not.toThrow();
  });

  describe("offer-only submissions", () => {
    it("tags 4005015 when the suggested ASIN matches no catalog item", () => {
      seedListing("SKU-A", {
        requirements: "LISTING_OFFER_ONLY",
        asin: "B0MISSING1",
        attributes: { merchant_suggested_asin: [{ value: "B0MISSING1" }] },
      });

      processListingSubmission(event("SKU-A"));

      expect(issueCodes("SKU-A")).toEqual(["4005015"]);
    });

    it("tags 8560 when there is no suggested ASIN to match on", () => {
      seedListing("SKU-B", { requirements: "LISTING_OFFER_ONLY", asin: "B0GENERATED" });

      processListingSubmission(event("SKU-B"));

      expect(issueCodes("SKU-B")).toEqual(["8560"]);
    });

    it("tags nothing when the ASIN is in the catalog", () => {
      seed(Api.CATALOG, "B0EXISTS001", { asin: "B0EXISTS001" });
      seedListing("SKU-C", { requirements: "LISTING_OFFER_ONLY", asin: "B0EXISTS001" });

      processListingSubmission(event("SKU-C"));

      expect(issueCodes("SKU-C")).toEqual([]);
    });

    it("matches on an external product identifier", () => {
      seed(Api.CATALOG, "B0BYUPC001", {
        asin: "B0BYUPC001",
        identifiers: [{ marketplaceId: MP, identifiers: [{ identifierType: "UPC", identifier: "714532191586" }] }],
      });
      seedListing("SKU-D", {
        requirements: "LISTING_OFFER_ONLY",
        attributes: { externally_assigned_product_identifier: [{ type: "upc", value: "714532191586" }] },
      });

      processListingSubmission(event("SKU-D"));

      expect(issueCodes("SKU-D")).toEqual([]);
    });

    it("never creates a catalog item", () => {
      seedListing("SKU-E", { requirements: "LISTING_OFFER_ONLY", asin: "B0MISSING1" });

      processListingSubmission(event("SKU-E"));

      expect(Context.instance.engine.get(Api.CATALOG, "B0MISSING1")).toBeNull();
    });
  });

  describe("full submissions", () => {
    it("creates a catalog item for an ASIN the catalog does not hold", () => {
      seedListing("SKU-F", {
        asin: "B0NETNEW001",
        attributes: {
          item_name: [{ value: "New Widget" }],
          brand: [{ value: "TestBrand" }],
          externally_assigned_product_identifier: [{ type: "upc", value: "714532191586" }],
          // A sales term, which belongs to the offer and not to the catalog.
          condition_type: [{ value: "new_new" }],
        },
      });

      processListingSubmission(event("SKU-F"));

      const item = Context.instance.engine.get(Api.CATALOG, "B0NETNEW001");
      expect(item).not.toBeNull();
      expect(item?.productTypes).toEqual([{ marketplaceId: MP, productType: "PRODUCT" }]);
      expect(item?.summaries).toEqual([{ marketplaceId: MP, itemName: "New Widget", brand: "TestBrand" }]);
      expect(item?.identifiers).toEqual([{ marketplaceId: MP, identifiers: [{ identifierType: "UPC", identifier: "714532191586" }] }]);

      const attributes = item?.attributes as Record<string, unknown>;
      expect(attributes.item_name).toEqual([{ value: "New Widget" }]);
      expect(attributes.condition_type).toBeUndefined();
    });

    it("leaves an existing catalog item untouched", () => {
      seed(Api.CATALOG, "B0EXISTS001", { asin: "B0EXISTS001", attributes: { brand: [{ value: "Untouched" }] } });
      seedListing("SKU-G", { asin: "B0EXISTS001", attributes: { brand: [{ value: "Submitted" }] } });

      processListingSubmission(event("SKU-G"));

      expect((Context.instance.engine.get(Api.CATALOG, "B0EXISTS001")?.attributes as Record<string, unknown>).brand).toEqual([
        { value: "Untouched" },
      ]);
    });

    it("tags no matching issue, whatever the catalog holds", () => {
      seedListing("SKU-H", { asin: "B0NETNEW002" });

      processListingSubmission(event("SKU-H"));

      expect(issueCodes("SKU-H")).toEqual([]);
    });
  });

  describe("reconciliation", () => {
    it("clears its own issue once the catalog item appears", () => {
      seedListing("SKU-I", { requirements: "LISTING_OFFER_ONLY", asin: "B0LATER0001" });
      processListingSubmission(event("SKU-I"));
      expect(issueCodes("SKU-I")).toEqual(["8560"]);

      seed(Api.CATALOG, "B0LATER0001", { asin: "B0LATER0001" });
      processListingSubmission(event("SKU-I"));

      expect(issueCodes("SKU-I")).toEqual([]);
    });

    it("is idempotent: repeated runs do not duplicate the issue", () => {
      seedListing("SKU-J", {
        requirements: "LISTING_OFFER_ONLY",
        asin: "B0MISSING1",
        attributes: { merchant_suggested_asin: [{ value: "B0MISSING1" }] },
      });

      processListingSubmission(event("SKU-J"));
      processListingSubmission(event("SKU-J"));
      processListingSubmission(event("SKU-J"));

      expect(issueCodes("SKU-J")).toEqual(["4005015"]);
    });

    it("preserves issues it does not own", () => {
      const validationIssue = { code: "90220", message: "brand is required but not supplied.", severity: "ERROR", categories: ["MISSING_ATTRIBUTE"] };
      seedListing("SKU-K", {
        requirements: "LISTING_OFFER_ONLY",
        asin: "B0MISSING1",
        attributes: { merchant_suggested_asin: [{ value: "B0MISSING1" }] },
        issues: [validationIssue],
      });

      processListingSubmission(event("SKU-K"));

      expect(issueCodes("SKU-K")).toEqual(["90220", "4005015"]);
    });

    it("does not modify the listing's attributes", () => {
      const attributes = { item_name: [{ value: "Only This" }] };
      seedListing("SKU-L", { requirements: "LISTING_OFFER_ONLY", asin: "B0MISSING1", attributes });

      processListingSubmission(event("SKU-L"));

      expect(Context.instance.engine.get(Api.LISTINGS, listingKey(SELLER, "SKU-L"))?.attributes).toEqual(attributes);
    });
  });
});
