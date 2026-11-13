/**
 * Catalog matching as a standalone service — in particular the sweep, which is
 * what lets a catalog item that arrives *after* a listing clear that listing's
 * matching issue. The write trigger alone cannot do that.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Context, Api } from "../../src/database/Context.js";
import { listingKey, ISSUE_CODE_ASIN_MISMATCH, ISSUE_CODE_UNMATCHABLE } from "../../src/operation/listingsItemModel.js";
import { reconcileAllListings, reconcileListingMatching } from "../../src/service/catalogMatching.js";

const SELLER = "AMY6FKRUBY7XV";
const MP = "ATVPDKIKX0DER";

/** Writes a listing without firing triggers, so the test drives matching itself. */
function seedListing(sku: string, doc: Record<string, unknown>, sellerId = SELLER) {
  Context.instance.engine.put(
    Api.LISTINGS,
    listingKey(sellerId, sku),
    { sku, sellerId, marketplaceId: MP, productType: "PRODUCT", issues: [], ...doc },
    { silent: true },
  );
}

function storedIssues(sku: string, sellerId = SELLER): { code: string }[] {
  const record = Context.instance.engine.get(Api.LISTINGS, listingKey(sellerId, sku));
  return (record?.issues as { code: string }[] | undefined) ?? [];
}

function seedCatalogItem(asin: string) {
  Context.instance.engine.put(Api.CATALOG, asin, { asin, attributes: {} }, { silent: true });
}

describe("reconcileListingMatching", () => {
  beforeEach(() => {
    Context.reset();
  });

  it("tags an offer-only listing whose suggested ASIN is not in the catalog", () => {
    seedListing("OFFER-1", {
      requirements: "LISTING_OFFER_ONLY",
      asin: "B0MISSING1",
      attributes: { merchant_suggested_asin: [{ value: "B0MISSING1" }] },
    });

    expect(reconcileListingMatching(listingKey(SELLER, "OFFER-1"))).toBe(true);
    expect(storedIssues("OFFER-1").map((i) => i.code)).toEqual([ISSUE_CODE_ASIN_MISMATCH]);
  });

  it("tags an offer-only listing with no suggested ASIN as unmatchable", () => {
    seedListing("OFFER-2", { requirements: "LISTING_OFFER_ONLY", attributes: {} });

    reconcileListingMatching(listingKey(SELLER, "OFFER-2"));
    expect(storedIssues("OFFER-2").map((i) => i.code)).toEqual([ISSUE_CODE_UNMATCHABLE]);
  });

  it("reports no change on a second run, so it is idempotent", () => {
    seedListing("OFFER-3", { requirements: "LISTING_OFFER_ONLY", attributes: {} });

    expect(reconcileListingMatching(listingKey(SELLER, "OFFER-3"))).toBe(true);
    expect(reconcileListingMatching(listingKey(SELLER, "OFFER-3"))).toBe(false);
  });

  it("leaves validation issues alone while reconciling its own", () => {
    seedListing("OFFER-4", {
      requirements: "LISTING_OFFER_ONLY",
      asin: "B0KNOWN001",
      issues: [{ code: "4000001", message: "A validation issue", severity: "ERROR", categories: ["INVALID_ATTRIBUTE"] }],
      attributes: {},
    });
    seedCatalogItem("B0KNOWN001");

    reconcileListingMatching(listingKey(SELLER, "OFFER-4"));
    // The matching verdict is "matched", so only the validation issue remains.
    expect(storedIssues("OFFER-4").map((i) => i.code)).toEqual(["4000001"]);
  });

  it("returns false for a listing that no longer exists", () => {
    expect(reconcileListingMatching(listingKey(SELLER, "GONE"))).toBe(false);
  });

  it("creates a catalog item for a net-new full submission", () => {
    seedListing("FULL-1", { asin: "B0NEWITEM1", attributes: { item_name: [{ value: "Widget" }] } });

    expect(reconcileListingMatching(listingKey(SELLER, "FULL-1"))).toBe(true);
    expect(Context.instance.engine.get(Api.CATALOG, "B0NEWITEM1")).toMatchObject({ asin: "B0NEWITEM1" });
  });
});

describe("reconcileAllListings", () => {
  beforeEach(() => {
    Context.reset();
  });

  it("clears a matching issue once the ASIN is added to the catalog", () => {
    seedListing("LATE-1", {
      requirements: "LISTING_OFFER_ONLY",
      asin: "B0LATE0001",
      attributes: { merchant_suggested_asin: [{ value: "B0LATE0001" }] },
    });

    // First sweep: the ASIN is unknown, so the listing is tagged.
    expect(reconcileAllListings()).toEqual({ evaluated: 1, changed: 1 });
    expect(storedIssues("LATE-1").map((i) => i.code)).toEqual([ISSUE_CODE_ASIN_MISMATCH]);

    // The ASIN arrives afterwards — an import, or a seeded fixture.
    seedCatalogItem("B0LATE0001");

    // This is the whole point of the sweep: nothing wrote the listing, so the
    // write trigger never fired, yet the verdict is now stale.
    expect(reconcileAllListings()).toEqual({ evaluated: 1, changed: 1 });
    expect(storedIssues("LATE-1")).toEqual([]);
  });

  it("reports no changes when every listing is already settled", () => {
    seedListing("SETTLED-1", { requirements: "LISTING_OFFER_ONLY", asin: "B0SETTLED1", attributes: {} });
    seedCatalogItem("B0SETTLED1");

    reconcileAllListings();
    expect(reconcileAllListings()).toEqual({ evaluated: 1, changed: 0 });
  });

  it("counts every listing it examined, across sellers", () => {
    seedListing("A-1", { requirements: "LISTING_OFFER_ONLY", attributes: {} });
    seedListing("B-1", { requirements: "LISTING_OFFER_ONLY", attributes: {} }, "A1OTHERSELLER");

    expect(reconcileAllListings().evaluated).toBe(2);
  });

  it("is a no-op on an empty database", () => {
    expect(reconcileAllListings()).toEqual({ evaluated: 0, changed: 0 });
  });
});
