import { describe, it, expect, beforeEach } from "vitest";
import type { Request } from "express";
import { Context, Api } from "../../src/database/Context.js";
import { listingKey } from "../../src/operation/listingsItemModel.js";
import { searchListingsItemsHandler } from "../../src/operation/listingsOperations.js";
import { searchOrdersHandler } from "../../src/operation/ordersOperations.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

/**
 * Regression tests for the date-range filters of searchListingsItems and
 * searchOrders. Both once compared raw values, so a query bound that was
 * (a) a Date object (the schema layer may deserialize date-times) or
 * (b) an ISO string in a different format than the stored value
 * (no milliseconds, UTC offset instead of Z) silently matched everything or
 * nothing. Each case below must hold for both handlers.
 */

const MP = "ATVPDKIKX0DER";
const SELLER_ID = "AMY6FKRUBY7XV";

// Three records, one day apart, stored as toISOString() values.
const OLD = "2026-01-01T10:00:00.000Z";
const MID = "2026-01-02T10:00:00.000Z";
const NEW = "2026-01-03T10:00:00.000Z";

function makeValidationResult(overrides: Partial<UnifiedValidationPass>): UnifiedValidationPass {
  return {
    pass: true,
    operationId: "",
    apiName: "",
    apiVersion: "",
    pathParams: {},
    queryParams: {},
    body: undefined,
    resolvedEntities: {},
    operation: {},
    ...overrides,
  };
}

function seedListing(sku: string, createdDate: string, lastUpdatedDate: string): void {
  Context.instance.engine.put(Api.LISTINGS, listingKey(SELLER_ID, sku), {
    sellerId: SELLER_ID,
    sku,
    productType: "PRODUCT",
    marketplaceId: MP,
    attributes: {},
    issues: [],
    mfnAvailability: [],
    createdDate,
    lastUpdatedDate,
  });
}

function seedOrder(orderId: string, createdTime: string, lastUpdatedTime: string): void {
  Context.instance.engine.put(Api.ORDERS, orderId, {
    orderId,
    createdTime,
    lastUpdatedTime,
    salesChannel: { marketplaceId: MP },
    fulfillment: { fulfillmentStatus: "PENDING", fulfilledBy: "MERCHANT" },
  });
}

async function searchListings(queryParams: Record<string, unknown>): Promise<string[]> {
  const result = await searchListingsItemsHandler(
    makeValidationResult({
      operationId: "searchListingsItems",
      pathParams: { sellerId: SELLER_ID },
      queryParams: { marketplaceIds: MP, ...queryParams },
    }),
    {} as Request,
  );
  const items = (result.data.body as { items: { sku: string }[] }).items;
  return items.map((i) => i.sku).sort((a, b) => a.localeCompare(b));
}

async function searchOrders(queryParams: Record<string, unknown>): Promise<string[]> {
  const result = await searchOrdersHandler(
    makeValidationResult({ operationId: "searchOrders", queryParams: queryParams as UnifiedValidationPass["queryParams"] }),
    {} as Request,
  );
  const orders = (result.data.body as { orders: { orderId: string }[] }).orders;
  return orders.map((o) => o.orderId).sort((a, b) => a.localeCompare(b));
}

interface Case {
  name: string;
  /** Query param names for the lower and upper bound of the field under test. */
  after: string;
  before: string;
  /** Seeds three records "old", "mid", "new" with the field under test set to OLD, MID, NEW. */
  seed: () => void;
  search: (q: Record<string, unknown>) => Promise<string[]>;
  ids: { old: string; mid: string; new: string };
}

const cases: Case[] = [
  {
    name: "searchListingsItems createdDate",
    after: "createdAfter",
    before: "createdBefore",
    seed: () => {
      seedListing("old", OLD, NEW);
      seedListing("mid", MID, NEW);
      seedListing("new", NEW, NEW);
    },
    search: searchListings,
    ids: { old: "old", mid: "mid", new: "new" },
  },
  {
    name: "searchListingsItems lastUpdatedDate",
    after: "lastUpdatedAfter",
    before: "lastUpdatedBefore",
    seed: () => {
      seedListing("old", OLD, OLD);
      seedListing("mid", OLD, MID);
      seedListing("new", OLD, NEW);
    },
    search: searchListings,
    ids: { old: "old", mid: "mid", new: "new" },
  },
  {
    name: "searchOrders createdTime",
    after: "createdAfter",
    before: "createdBefore",
    seed: () => {
      seedOrder("o-old", OLD, NEW);
      seedOrder("o-mid", MID, NEW);
      seedOrder("o-new", NEW, NEW);
    },
    search: searchOrders,
    ids: { old: "o-old", mid: "o-mid", new: "o-new" },
  },
  {
    name: "searchOrders lastUpdatedTime",
    after: "lastUpdatedAfter",
    before: "lastUpdatedBefore",
    seed: () => {
      seedOrder("o-old", OLD, OLD);
      seedOrder("o-mid", OLD, MID);
      seedOrder("o-new", OLD, NEW);
    },
    search: searchOrders,
    ids: { old: "o-old", mid: "o-mid", new: "o-new" },
  },
];

describe.each(cases)("date range filter: $name", (c) => {
  beforeEach(() => {
    Context.reset();
    c.seed();
  });

  it("returns everything when no bound is given", async () => {
    expect(await c.search({})).toEqual([c.ids.mid, c.ids.new, c.ids.old].sort((a, b) => a.localeCompare(b)));
  });

  // Case 1: the bound arrives as a string in the same format as the stored value.
  it("applies the lower bound as an inclusive string", async () => {
    expect(await c.search({ [c.after]: MID })).toEqual([c.ids.mid, c.ids.new].sort((a, b) => a.localeCompare(b)));
  });

  it("applies the upper bound as an inclusive string", async () => {
    expect(await c.search({ [c.before]: MID })).toEqual([c.ids.mid, c.ids.old].sort((a, b) => a.localeCompare(b)));
  });

  // Case 2: the bound arrives as a Date (deserialized date-time).
  it("applies the lower bound when it is a Date object", async () => {
    expect(await c.search({ [c.after]: new Date(MID) })).toEqual([c.ids.mid, c.ids.new].sort((a, b) => a.localeCompare(b)));
  });

  it("applies the upper bound when it is a Date object", async () => {
    expect(await c.search({ [c.before]: new Date(MID) })).toEqual([c.ids.mid, c.ids.old].sort((a, b) => a.localeCompare(b)));
  });

  it("applies both bounds together when they are Date objects", async () => {
    expect(await c.search({ [c.after]: new Date(MID), [c.before]: new Date(MID) })).toEqual([c.ids.mid]);
  });

  // Case 3: the bound is a differently formatted ISO string for the same instants.
  it("compares instants when the bound has no milliseconds", async () => {
    expect(await c.search({ [c.after]: "2026-01-02T10:00:00Z" })).toEqual([c.ids.mid, c.ids.new].sort((a, b) => a.localeCompare(b)));
  });

  it("compares instants when the bound uses a UTC offset", async () => {
    // 11:00 at +01:00 is 10:00Z, exactly MID.
    expect(await c.search({ [c.before]: "2026-01-02T11:00:00+01:00" })).toEqual([c.ids.mid, c.ids.old].sort((a, b) => a.localeCompare(b)));
  });

  it("returns nothing when the range excludes every record", async () => {
    expect(await c.search({ [c.after]: new Date("2027-01-01T00:00:00.000Z") })).toEqual([]);
  });
});
