import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Context, Api } from "../../src/database/Context.js";
import { listingKey } from "../../src/operation/listingsItemModel.js";
import {
  getListingsItemHandler,
  searchListingsItemsHandler,
  putListingsItemHandler,
  patchListingsItemHandler,
  deleteListingsItemHandler,
} from "../../src/operation/listingsOperations.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";
import type { Request } from "express";

const MP = "ATVPDKIKX0DER";

function makeValidationResult(overrides: Partial<UnifiedValidationPass> = {}): UnifiedValidationPass {
  return {
    pass: true,
    operationId: "getListingsItem",
    apiName: "Listings",
    apiVersion: "2021-08-01",
    pathParams: { sellerId: "SELLER1", sku: "SKU-001" },
    queryParams: { marketplaceIds: MP },
    body: undefined,
    resolvedEntities: {},
    operation: {},
    ...overrides,
  };
}

const SELLER_ID = "AMY6FKRUBY7XV"; // merchant-format seller ID

/**
 * A proxied SP-API request carrying an LWA token. putListingsItem validates
 * every submission against production, so it always needs one.
 */
function makeRequest(body?: Record<string, unknown>, sku = "SKU-001", sellerId = SELLER_ID): Request {
  const path = `/listings/2021-08-01/items/${sellerId}/${sku}`;
  return {
    body,
    path,
    originalUrl: `${path}?marketplaceIds=${MP}`,
    header: (name: string) => (name === "x-amz-access-token" ? "Atza|token" : undefined),
  } as unknown as Request;
}

/** A request without credentials, for the unauthenticated PUT path. */
function makeAnonymousRequest(body?: Record<string, unknown>): Request {
  return {
    body,
    path: "/listings/2021-08-01/items/S/SKU",
    originalUrl: "/listings/2021-08-01/items/S/SKU",
    header: () => undefined,
  } as unknown as Request;
}

const realFetch = globalThis.fetch;

/**
 * Stubs the one upstream call a PUT makes: production's validation preview.
 * Defaults to VALID — the status the real API returns under
 * `mode=VALIDATION_PREVIEW` — so tests exercise the actual contract.
 */
function mockPreview(status: number, body?: unknown) {
  const mock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  globalThis.fetch = mock;
  return mock;
}

beforeEach(() => {
  Context.reset();
  mockPreview(200, { status: "VALID", issues: [] });
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Yields to the event loop so detached trigger processing completes. */
const flushTriggers = () => new Promise((resolve) => setImmediate(resolve));

/** Product facts + offer baseline used as the default submission. */
const BASE_ATTRS: Record<string, unknown> = {
  item_name: [{ value: "Base Widget" }],
  brand: [{ value: "TestBrand" }],
  bullet_point: [{ value: "Great quality" }],
  color: [{ value: "Black" }],
  country_of_origin: [{ value: "US" }],
  product_description: [{ value: "A fine widget for testing." }],
  supplier_declared_dg_hz_regulation: [{ value: "not_applicable" }],
  externally_assigned_product_identifier: [{ type: "upc", value: "714532191586" }],
  condition_type: [{ value: "new_new" }],
  fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT", quantity: 5 }],
  merchant_shipping_group: [{ value: "legacy-template-id" }],
};

/** Physical package data required whenever an FBA (AMAZON_*) channel is used. */
const FBA_PHYSICAL_ATTRS: Record<string, unknown> = {
  batteries_required: [{ value: false }],
  item_package_dimensions: [
    { length: { value: 10, unit: "centimeters" }, width: { value: 5, unit: "centimeters" }, height: { value: 3, unit: "centimeters" } },
  ],
  item_package_weight: [{ value: 250, unit: "grams" }],
};

/** Puts with BASE_ATTRS merged under the given attributes. */
async function put(sku: string, attributes: Record<string, unknown>, requirements?: string, sellerId = SELLER_ID) {
  return rawPut(sku, { ...BASE_ATTRS, ...attributes }, requirements, sellerId);
}

/** Puts exactly the given attributes. */
async function rawPut(sku: string, attributes: Record<string, unknown>, requirements?: string, sellerId = SELLER_ID) {
  return putListingsItemHandler(
    makeValidationResult({
      operationId: "putListingsItem",
      pathParams: { sellerId, sku },
      queryParams: { marketplaceIds: MP },
    }),
    makeRequest({ productType: "PRODUCT", ...(requirements ? { requirements } : {}), attributes }, sku, sellerId),
  );
}

function getStored(sku: string, sellerId = SELLER_ID) {
  const doc = Context.instance.engine.get(Api.LISTINGS, listingKey(sellerId, sku));
  if (!doc) throw new Error(`Expected listing '${sku}' to exist for seller '${sellerId}'`);
  return doc;
}

/** Writes a listing fixture under its composite key, without firing triggers. */
function seedListing(sku: string, doc: Record<string, unknown>, sellerId = SELLER_ID) {
  seed(Api.LISTINGS, listingKey(sellerId, sku), doc);
}

/** Writes fixture data without firing triggers. */
function seed(domain: Api, key: string, doc: Record<string, unknown>) {
  Context.instance.engine.put(domain, key, doc, { silent: true });
}

const OFFER = [{ marketplace_id: MP, currency: "USD", audience: "ALL", our_price: [{ schedule: [{ value_with_tax: 30 }] }] }];
const MFN_5 = [{ fulfillment_channel_code: "DEFAULT", quantity: 5 }];

describe("putListingsItemHandler", () => {
  beforeEach(() => {
    Context.reset();
  });

  it("creates a listing, returns ACCEPTED with issues[] and generates an ASIN", async () => {
    const result = await put("NEW-SKU", { item_name: [{ value: "Widget" }] });
    const body = result.data.body as Record<string, unknown>;

    expect(result.statusCode).toBe(200);
    expect(body.status).toBe("ACCEPTED");
    expect(body.issues).toEqual([]);
    expect(body.submissionId).toMatch(/^[0-9a-f]{32}$/);

    const stored = getStored("NEW-SKU");
    expect(stored.asin).toMatch(/^B0[0-9A-F]{8}$/);
    expect(stored.sellerId).toBe(SELLER_ID);
  });

  it("uses merchant_suggested_asin as the listing ASIN when provided", async () => {
    seed(Api.CATALOG, "B0EXISTING", { asin: "B0EXISTING", attributes: {} });
    await put("SKU-OFFER", { merchant_suggested_asin: [{ value: "B0EXISTING" }], purchasable_offer: OFFER }, "LISTING_OFFER_ONLY");
    expect(getStored("SKU-OFFER").asin).toBe("B0EXISTING");
  });

  it("replaces product facts but merges sales terms on seller re-put", async () => {
    await put("SKU-001", { item_name: [{ value: "Original" }], special_feature: [{ value: "SF" }], purchasable_offer: OFFER });
    // Re-put without special_feature (product fact) and without purchasable_offer (sales term).
    await put("SKU-001", { item_name: [{ value: "Renamed" }] });

    const attrs = getStored("SKU-001").attributes as Record<string, unknown>;
    expect(attrs.item_name).toEqual([{ value: "Renamed" }]);
    expect(attrs.special_feature).toBeUndefined(); // product fact dropped
    expect(attrs.purchasable_offer).toEqual(OFFER); // sales term retained
  });

  it("seeds the MFN ledger from submitted quantities and resets it on re-submission", async () => {
    await put("SKU-001", { fulfillment_availability: MFN_5 });
    expect(getStored("SKU-001").mfnAvailability).toEqual([{ fulfillmentChannelCode: "DEFAULT", quantity: 5 }]);

    await put("SKU-001", { fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT", quantity: 42 }] });
    expect(getStored("SKU-001").mfnAvailability).toEqual([{ fulfillmentChannelCode: "DEFAULT", quantity: 42 }]);
  });

  it("keeps the live ledger on a product-facts-only re-put (no fulfillment submitted)", async () => {
    await put("SKU-001", { fulfillment_availability: MFN_5 });
    // Simulate an order reducing live inventory.
    const stored = getStored("SKU-001");
    (stored.mfnAvailability as { quantity: number }[])[0].quantity = 3;
    seedListing("SKU-001", stored);

    // Product-facts-only update: fulfillment_availability legitimately absent.
    const productFacts = Object.fromEntries(Object.entries(BASE_ATTRS).filter(([k]) => k !== "condition_type" && k !== "fulfillment_availability"));
    await rawPut("SKU-001", { ...productFacts, item_name: [{ value: "Renamed" }] }, "LISTING_PRODUCT_ONLY");

    expect((getStored("SKU-001").mfnAvailability as { quantity: number }[])[0].quantity).toBe(3);
    expect((getStored("SKU-001").attributes as Record<string, unknown>).item_name).toEqual([{ value: "Renamed" }]);
  });
});

describe("getListingsItemHandler (derived sections)", () => {
  beforeEach(() => {
    Context.reset();
  });

  async function get(sku: string, includedData: string[]) {
    const result = await getListingsItemHandler(
      makeValidationResult({
        pathParams: { sellerId: "SELLER1", sku },
        queryParams: { marketplaceIds: MP, includedData },
        resolvedEntities: { listing: getStored(sku) },
      }),
      makeRequest(),
    );
    return result.data.body as Record<string, unknown>;
  }

  it("derives fulfillmentAvailability (camelCase) from the live ledger, not attributes", async () => {
    await put("SKU-001", { fulfillment_availability: MFN_5, purchasable_offer: OFFER });
    // Order reduces live inventory to 3; attributes still show 5.
    const stored = getStored("SKU-001");
    (stored.mfnAvailability as { quantity: number }[])[0].quantity = 3;
    seedListing("SKU-001", stored);

    const body = await get("SKU-001", ["attributes", "fulfillmentAvailability"]);
    expect(body.fulfillmentAvailability).toEqual([{ fulfillmentChannelCode: "DEFAULT", quantity: 3 }]);
    expect((body.attributes as Record<string, unknown>).fulfillment_availability).toEqual(MFN_5);
  });

  it("reports an FBA channel without a quantity, which Amazon owns", async () => {
    await put("SKU-FBA", { ...FBA_PHYSICAL_ATTRS, fulfillment_availability: [{ fulfillment_channel_code: "AMAZON_NA" }] });
    seed(Api.INVENTORY, "SKU-FBA", { sellerSku: "SKU-FBA", fulfillableQuantity: 80 });

    const body = await get("SKU-FBA", ["fulfillmentAvailability"]);
    expect(body.fulfillmentAvailability).toEqual([{ fulfillmentChannelCode: "AMAZON_NA" }]);
  });

  it("reports only the FBA channel for a hybrid listing, as production does", async () => {
    await put("SKU-HYBRID", {
      ...FBA_PHYSICAL_ATTRS,
      fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT", quantity: 7 }, { fulfillment_channel_code: "AMAZON_NA" }],
    });
    seed(Api.INVENTORY, "SKU-HYBRID", { sellerSku: "SKU-HYBRID", fulfillableQuantity: 12 });

    const body = await get("SKU-HYBRID", ["attributes", "fulfillmentAvailability"]);

    // Amazon fulfils from its own inventory first, so the merchant channel is
    // not reported — even though the seller submitted it and the ledger holds it.
    expect(body.fulfillmentAvailability).toEqual([{ fulfillmentChannelCode: "AMAZON_NA" }]);
    // The submission layer still shows exactly what was submitted.
    expect((body.attributes as Record<string, unknown>).fulfillment_availability).toEqual([
      { fulfillment_channel_code: "DEFAULT", quantity: 7 },
      { fulfillment_channel_code: "AMAZON_NA" },
    ]);
  });

  it("keeps a hybrid listing BUYABLE from FBA stock when the MFN ledger is empty", async () => {
    await put("SKU-HYBRID-2", {
      ...FBA_PHYSICAL_ATTRS,
      purchasable_offer: OFFER,
      fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT", quantity: 0 }, { fulfillment_channel_code: "AMAZON_NA" }],
    });
    seed(Api.INVENTORY, "SKU-HYBRID-2", { sellerSku: "SKU-HYBRID-2", fulfillableQuantity: 4 });

    const body = await get("SKU-HYBRID-2", ["summaries"]);
    expect((body.summaries as { status: string[] }[])[0].status).toEqual(["BUYABLE", "DISCOVERABLE"]);
  });

  it("falls back to the merchant channel once FBA stock is exhausted", async () => {
    await put("SKU-HYBRID-3", {
      ...FBA_PHYSICAL_ATTRS,
      purchasable_offer: OFFER,
      fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT", quantity: 9 }, { fulfillment_channel_code: "AMAZON_NA" }],
    });
    seed(Api.INVENTORY, "SKU-HYBRID-3", { sellerSku: "SKU-HYBRID-3", fulfillableQuantity: 0 });

    const body = await get("SKU-HYBRID-3", ["summaries", "fulfillmentAvailability"]);

    // FBA can no longer fulfil, so the merchant channel becomes the tip of the
    // ledger and is reported with its live quantity.
    expect(body.fulfillmentAvailability).toEqual([{ fulfillmentChannelCode: "DEFAULT", quantity: 9 }]);
    expect((body.summaries as { status: string[] }[])[0].status).toEqual(["BUYABLE", "DISCOVERABLE"]);
  });

  it("keeps reporting the primary channel when nothing is in stock anywhere", async () => {
    await put("SKU-HYBRID-4", {
      ...FBA_PHYSICAL_ATTRS,
      purchasable_offer: OFFER,
      fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT", quantity: 0 }, { fulfillment_channel_code: "AMAZON_NA" }],
    });
    seed(Api.INVENTORY, "SKU-HYBRID-4", { sellerSku: "SKU-HYBRID-4", fulfillableQuantity: 0 });

    const body = await get("SKU-HYBRID-4", ["summaries", "fulfillmentAvailability"]);

    expect(body.fulfillmentAvailability).toEqual([{ fulfillmentChannelCode: "AMAZON_NA" }]);
    expect((body.summaries as { status: string[] }[])[0].status).toEqual(["DISCOVERABLE"]);
  });

  it("derives summaries with status BUYABLE+DISCOVERABLE for an offered, stocked listing", async () => {
    await put("SKU-001", { item_name: [{ value: "Widget" }], purchasable_offer: OFFER, fulfillment_availability: MFN_5 });

    const body = await get("SKU-001", ["summaries"]);
    const summary = (body.summaries as Record<string, unknown>[])[0];
    expect(summary.status).toEqual(["BUYABLE", "DISCOVERABLE"]);
    expect(summary.itemName).toBe("Widget");
    expect(summary.productType).toBe("PRODUCT");
    expect(summary.asin).toBeDefined();
  });

  it("drops BUYABLE when live inventory is depleted", async () => {
    await put("SKU-001", { purchasable_offer: OFFER, fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT", quantity: 0 }] });

    const body = await get("SKU-001", ["summaries"]);
    expect((body.summaries as Record<string, unknown>[])[0].status).toEqual(["DISCOVERABLE"]);
  });

  it("drops BUYABLE when there is no purchasable offer", async () => {
    await put("SKU-001", { item_name: [{ value: "No offer yet" }], fulfillment_availability: MFN_5 });

    const body = await get("SKU-001", ["summaries"]);
    expect((body.summaries as Record<string, unknown>[])[0].status).toEqual(["DISCOVERABLE"]);
  });

  it("derives offers from purchasable_offer (B2C + B2B)", async () => {
    await put("SKU-001", {
      purchasable_offer: [...OFFER, { marketplace_id: MP, currency: "USD", audience: "B2B", our_price: [{ schedule: [{ value_with_tax: 28 }] }] }],
      fulfillment_availability: MFN_5,
    });

    const body = await get("SKU-001", ["offers"]);
    const offers = body.offers as Record<string, unknown>[];
    expect(offers).toHaveLength(2);
    expect(offers[0]).toMatchObject({ marketplaceId: MP, offerType: "B2C", price: { currencyCode: "USD", amount: "30" } });
    expect(offers[1]).toMatchObject({ offerType: "B2B", audience: { value: "B2B" } });
  });
});

/**
 * `procurement` is the vendor counterpart of `offers`: the cost Amazon pays for
 * the product. Derivation is mode-independent — the includedData section is
 * gated to Vendor mode by a validation rule, not by the handler.
 */
describe("procurement derivation", () => {
  beforeEach(() => {
    Context.reset();
  });

  async function getProcurement(sku: string) {
    const result = await getListingsItemHandler(
      makeValidationResult({
        pathParams: { sellerId: SELLER_ID, sku },
        queryParams: { marketplaceIds: MP, includedData: ["procurement"] },
        resolvedEntities: { listing: getStored(sku) },
      }),
      makeRequest(),
    );
    return (result.data.body as Record<string, unknown>).procurement;
  }

  it("derives costPrice from a submitted cost_price attribute", async () => {
    await put("SKU-VENDOR", { cost_price: [{ marketplace_id: MP, currency: "USD", value: 67 }] });
    expect(await getProcurement("SKU-VENDOR")).toEqual([{ costPrice: { currencyCode: "USD", amount: "67" } }]);
  });

  it("returns an empty section when no cost was submitted, as for a merchant listing", async () => {
    await put("SKU-MERCHANT", { purchasable_offer: OFFER });
    expect(await getProcurement("SKU-MERCHANT")).toEqual([]);
  });

  it("skips a cost_price instance carrying no value", async () => {
    await put("SKU-NO-VALUE", { cost_price: [{ marketplace_id: MP, currency: "EUR" }] });
    expect(await getProcurement("SKU-NO-VALUE")).toEqual([]);
  });
});

/**
 * Relationships are the one section where half the data lives on the listing at
 * the other end. Shapes here follow a production `includedData=relationships`
 * response: an unrelated listing reports `[]`, a variation child reports its
 * parent plus a `{ attributes, theme }` variationTheme, and a packaged unit
 * reports its case as parent with no theme.
 */
describe("relationships derivation", () => {
  beforeEach(() => {
    Context.reset();
  });

  async function getRelationships(sku: string) {
    const result = await getListingsItemHandler(
      makeValidationResult({
        pathParams: { sellerId: SELLER_ID, sku },
        queryParams: { marketplaceIds: MP, includedData: ["relationships"] },
        resolvedEntities: { listing: getStored(sku) },
      }),
      makeRequest(),
    );
    return (result.data.body as Record<string, unknown>).relationships;
  }

  it("reports an empty section for an unrelated listing rather than omitting it", async () => {
    await put("SKU-ALONE", { item_name: [{ value: "Standalone" }] });
    expect(await getRelationships("SKU-ALONE")).toEqual([]);
  });

  it("reports the parent and variation theme of a variation child", async () => {
    await put("variatione123456", {
      parentage_level: [{ value: "child" }],
      child_parent_sku_relationship: [{ child_relationship_type: "variation", parent_sku: "test1234567" }],
      variation_theme: [{ name: "SIZE/COLOR/NUMBER_OF_ITEMS" }],
    });

    expect(await getRelationships("variatione123456")).toEqual([
      {
        marketplaceId: MP,
        relationships: [
          {
            type: "VARIATION",
            parentSkus: ["test1234567"],
            // Theme order is SIZE/COLOR/NUMBER_OF_ITEMS; production reports the
            // attribute names alphabetically.
            variationTheme: { attributes: ["color", "number_of_items", "size"], theme: "SIZE/COLOR/NUMBER_OF_ITEMS" },
          },
        ],
      },
    ]);
  });

  it("reports children on the variation parent, which never names them itself", async () => {
    await put("test1234567", { parentage_level: [{ value: "parent" }] });
    await put("child-red", { child_parent_sku_relationship: [{ child_relationship_type: "variation", parent_sku: "test1234567" }] });
    await put("child-blue", { child_parent_sku_relationship: [{ child_relationship_type: "variation", parent_sku: "test1234567" }] });

    expect(await getRelationships("test1234567")).toEqual([
      { marketplaceId: MP, relationships: [{ type: "VARIATION", childSkus: ["child-red", "child-blue"] }] },
    ]);
  });

  it("reports the containing case as the parent of a packaged unit, with no theme", async () => {
    // The container declares what it contains, so the unit's parent is found by
    // looking at the case, not on the unit itself.
    await put("TG-CANDLE-UNIT", { package_level: [{ value: "unit" }] });
    await put("TG-CANDLE-CASE", { package_level: [{ value: "case" }], package_contains_sku: [{ sku: "TG-CANDLE-UNIT", quantity: 12 }] });

    expect(await getRelationships("TG-CANDLE-UNIT")).toEqual([
      { marketplaceId: MP, relationships: [{ type: "PACKAGE_HIERARCHY", parentSkus: ["TG-CANDLE-CASE"] }] },
    ]);
    expect(await getRelationships("TG-CANDLE-CASE")).toEqual([
      { marketplaceId: MP, relationships: [{ type: "PACKAGE_HIERARCHY", childSkus: ["TG-CANDLE-UNIT"] }] },
    ]);
  });

  it("reports both ends on a listing in the middle of a package hierarchy", async () => {
    await put("PALLET", { package_level: [{ value: "pallet" }], package_contains_sku: [{ sku: "CASE", quantity: 10 }] });
    await put("CASE", { package_level: [{ value: "case" }], package_contains_sku: [{ sku: "UNIT", quantity: 12 }] });
    await put("UNIT", { package_level: [{ value: "unit" }] });

    expect(await getRelationships("CASE")).toEqual([
      { marketplaceId: MP, relationships: [{ type: "PACKAGE_HIERARCHY", parentSkus: ["PALLET"], childSkus: ["UNIT"] }] },
    ]);
  });

  it("does not resolve a relationship across sellers", async () => {
    await put("SHARED-CHILD", { child_parent_sku_relationship: [{ child_relationship_type: "variation", parent_sku: "OTHER-PARENT" }] }, undefined, "A1OTHERSELLER");
    await put("OTHER-PARENT", { parentage_level: [{ value: "parent" }] });

    // The child belongs to another seller, so this seller's parent has none.
    expect(await getRelationships("OTHER-PARENT")).toEqual([]);
  });
});

describe("patchListingsItemHandler", () => {
  beforeEach(() => {
    Context.reset();
  });

  async function patch(sku: string, patches: unknown[]) {
    return patchListingsItemHandler(
      makeValidationResult({
        operationId: "patchListingsItem",
        pathParams: { sellerId: SELLER_ID, sku },
        queryParams: { marketplaceIds: MP },
        resolvedEntities: { listing: getStored(sku) },
      }),
      makeRequest({ productType: "PRODUCT", patches }),
    );
  }

  it("replaces a whole attribute when the value carries no selectors", async () => {
    await put("SKU-001", { item_name: [{ value: "Old" }], color: [{ value: "Red" }] });
    await patch("SKU-001", [{ op: "replace", path: "/attributes/item_name", value: [{ value: "New" }] }]);

    const attrs = getStored("SKU-001").attributes as Record<string, unknown>;
    expect(attrs.item_name).toEqual([{ value: "New" }]);
    expect(attrs.color).toEqual([{ value: "Red" }]);
  });

  it("replaces only the selector-addressed instance, dropping its omitted sub-attributes", async () => {
    await put("SKU-001", {
      fulfillment_availability: [
        { fulfillment_channel_code: "DEFAULT", quantity: 3, lead_time_to_ship_max_days: 5 },
        { fulfillment_channel_code: "AMAZON_NA" },
      ],
    });
    await patch("SKU-001", [
      { op: "replace", path: "/attributes/fulfillment_availability", value: [{ fulfillment_channel_code: "DEFAULT", quantity: 10 }] },
    ]);

    // The addressed instance is replaced wholesale — lead_time_to_ship_max_days
    // is gone because replace, unlike merge, does not preserve omitted fields.
    // The channel the patch did not address survives untouched.
    expect((getStored("SKU-001").attributes as Record<string, unknown>).fulfillment_availability).toEqual([
      { fulfillment_channel_code: "DEFAULT", quantity: 10 },
      { fulfillment_channel_code: "AMAZON_NA" },
    ]);
  });

  it("appends a selector-addressed instance that matches nothing yet", async () => {
    await put("SKU-001", { purchasable_offer: OFFER });
    const b2b = { marketplace_id: MP, currency: "USD", audience: "B2B", our_price: [{ schedule: [{ value_with_tax: 27 }] }] };
    await patch("SKU-001", [{ op: "replace", path: "/attributes/purchasable_offer", value: [b2b] }]);

    const offers = (getStored("SKU-001").attributes as Record<string, unknown>).purchasable_offer as { audience: string }[];
    expect(offers.map((o) => o.audience)).toEqual(["ALL", "B2B"]);
  });

  it("upserts: patching an unknown SKU creates the listing", async () => {
    const result = await patchListingsItemHandler(
      makeValidationResult({
        operationId: "patchListingsItem",
        pathParams: { sellerId: SELLER_ID, sku: "SKU-BRANDNEW" },
        queryParams: { marketplaceIds: MP },
      }),
      makeRequest({ productType: "PRODUCT", patches: [{ op: "replace", path: "/attributes/color", value: [{ value: "Blue" }] }] }),
    );

    expect((result.data.body as Record<string, unknown>).status).toBe("ACCEPTED");
    const stored = getStored("SKU-BRANDNEW");
    expect(stored.sellerId).toBe(SELLER_ID);
    expect((stored.attributes as Record<string, unknown>).color).toEqual([{ value: "Blue" }]);
  });

  it("upserted listing goes through catalog processing like any other submission", async () => {
    await patchListingsItemHandler(
      makeValidationResult({
        operationId: "patchListingsItem",
        pathParams: { sellerId: SELLER_ID, sku: "SKU-SPARSE" },
        queryParams: { marketplaceIds: MP },
      }),
      makeRequest({ productType: "PRODUCT", patches: [{ op: "replace", path: "/attributes/country_of_origin", value: [{ value: "FR" }] }] }),
    );
    await flushTriggers();

    // A full submission this sparse still mints its own ASIN in the sandbox.
    expect(Context.instance.engine.get(Api.CATALOG, getStored("SKU-SPARSE").asin as string)).not.toBeNull();
  });

  it("merges quantity into a fulfillment_availability instance by selector, keeping other fields", async () => {
    await put("SKU-001", {
      fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT", quantity: 5, lead_time_to_ship_max_days: 3 }],
    });
    await patch("SKU-001", [
      { op: "merge", path: "/attributes/fulfillment_availability", value: [{ fulfillment_channel_code: "DEFAULT", quantity: 20 }] },
    ]);

    const attrs = getStored("SKU-001").attributes as Record<string, unknown>;
    expect(attrs.fulfillment_availability).toEqual([{ fulfillment_channel_code: "DEFAULT", quantity: 20, lead_time_to_ship_max_days: 3 }]);
    // Live ledger reset by the fulfillment patch:
    expect(getStored("SKU-001").mfnAvailability).toEqual([{ fulfillmentChannelCode: "DEFAULT", quantity: 20 }]);
  });

  it("merge with null deletes a sub-attribute of the selector-matched offer", async () => {
    await put("SKU-001", {
      purchasable_offer: [
        {
          marketplace_id: MP,
          currency: "USD",
          audience: "B2B",
          our_price: [{ schedule: [{ value_with_tax: 28 }] }],
          quantity_discount_plan: [{ schedule: [] }],
        },
      ],
    });
    await patch("SKU-001", [
      {
        op: "merge",
        path: "/attributes/purchasable_offer",
        value: [{ marketplace_id: MP, currency: "USD", audience: "B2B", quantity_discount_plan: null }],
      },
    ]);

    const offer = (getStored("SKU-001").attributes as Record<string, unknown>).purchasable_offer as Record<string, unknown>[];
    expect(offer[0].quantity_discount_plan).toBeUndefined();
    expect(offer[0].our_price).toBeDefined();
  });

  it("rejects merge on unsupported attributes with status INVALID", async () => {
    await put("SKU-001", { item_name: [{ value: "Widget" }] });
    const result = await patch("SKU-001", [{ op: "merge", path: "/attributes/item_name", value: [{ value: "Nope" }] }]);

    const body = result.data.body as Record<string, unknown>;
    expect(body.status).toBe("INVALID");
    expect((body.issues as { message: string }[])[0].message).toContain("merge");
    // Attribute unchanged:
    expect((getStored("SKU-001").attributes as Record<string, unknown>).item_name).toEqual([{ value: "Widget" }]);
  });

  it("rejects merge-null on our_price with status INVALID", async () => {
    await put("SKU-001", { purchasable_offer: OFFER });
    const result = await patch("SKU-001", [
      { op: "merge", path: "/attributes/purchasable_offer", value: [{ marketplace_id: MP, currency: "USD", audience: "ALL", our_price: null }] },
    ]);

    expect((result.data.body as Record<string, unknown>).status).toBe("INVALID");
  });

  it("deletes a selector-matched offer instance, keeping the others", async () => {
    await put("SKU-001", {
      purchasable_offer: [...OFFER, { marketplace_id: MP, currency: "USD", audience: "B2B", our_price: [{ schedule: [{ value_with_tax: 28 }] }] }],
    });
    await patch("SKU-001", [
      { op: "delete", path: "/attributes/purchasable_offer", value: [{ marketplace_id: MP, currency: "USD", audience: "B2B" }] },
    ]);

    const offers = (getStored("SKU-001").attributes as Record<string, unknown>).purchasable_offer as Record<string, unknown>[];
    expect(offers).toHaveLength(1);
    expect(offers[0].audience).toBe("ALL");
  });

  it("adds a second offer audience and a second fulfillment channel via merge", async () => {
    await put("SKU-001", { purchasable_offer: OFFER, fulfillment_availability: MFN_5 });

    // merge appends instances whose selectors match nothing yet, so a B2B
    // offer joins the B2C one and an FBA channel joins the merchant channel.
    await patch("SKU-001", [
      {
        op: "merge",
        path: "/attributes/purchasable_offer",
        value: [{ marketplace_id: MP, currency: "USD", audience: "B2B", our_price: [{ schedule: [{ value_with_tax: 27 }] }] }],
      },
      { op: "merge", path: "/attributes/fulfillment_availability", value: [{ fulfillment_channel_code: "AMAZON_NA" }] },
    ]);

    const attrs = getStored("SKU-001").attributes as Record<string, unknown>;
    expect((attrs.purchasable_offer as { audience: string }[]).map((o) => o.audience)).toEqual(["ALL", "B2B"]);
    expect((attrs.fulfillment_availability as { fulfillment_channel_code: string }[]).map((f) => f.fulfillment_channel_code)).toEqual([
      "DEFAULT",
      "AMAZON_NA",
    ]);

    // Both audiences surface as separate derived offers.
    const get = await getListingsItemHandler(
      makeValidationResult({
        pathParams: { sellerId: SELLER_ID, sku: "SKU-001" },
        queryParams: { marketplaceIds: MP, includedData: ["offers"] },
        resolvedEntities: { listing: getStored("SKU-001") },
      }),
      makeRequest(),
    );
    const offers = (get.data.body as Record<string, unknown>).offers as { offerType: string }[];
    expect(offers.map((o) => o.offerType)).toEqual(["B2C", "B2B"]);
  });

  it("deletes a whole attribute when no selector value is provided", async () => {
    await put("SKU-001", { item_name: [{ value: "Widget" }], color: [{ value: "Blue" }] });
    await patch("SKU-001", [{ op: "delete", path: "/attributes/color" }]);

    expect((getStored("SKU-001").attributes as Record<string, unknown>).color).toBeUndefined();
  });
});

describe("searchListingsItemsHandler", () => {
  beforeEach(() => {
    Context.reset();
  });

  async function search(queryParams: Record<string, unknown>) {
    const result = await searchListingsItemsHandler(
      makeValidationResult({
        operationId: "searchListingsItems",
        pathParams: { sellerId: SELLER_ID },
        queryParams: { marketplaceIds: MP, ...queryParams },
      }),
      makeRequest(),
    );
    return result.data.body as Record<string, unknown>;
  }

  it("filters by SKU identifiers", async () => {
    await put("SKU-A", {});
    await put("SKU-B", {});
    const body = await search({ identifiers: "SKU-A", identifiersType: "SKU" });
    expect(body.numberOfResults).toBe(1);
    expect((body.items as { sku: string }[])[0].sku).toBe("SKU-A");
  });

  /** SKUs in a search response, sorted so assertions do not depend on ordering. */
  function skus(body: Record<string, unknown>): string[] {
    return (body.items as { sku: string }[]).map((i) => i.sku).sort((a, b) => a.localeCompare(b));
  }

  describe("relationship filters", () => {
    it("returns the variation children of the given parent, and not the parent", async () => {
      await put("V-PARENT", { parentage_level: [{ value: "parent" }] });
      await put("V-RED", { child_parent_sku_relationship: [{ child_relationship_type: "variation", parent_sku: "V-PARENT" }] });
      await put("V-BLUE", { child_parent_sku_relationship: [{ child_relationship_type: "variation", parent_sku: "V-PARENT" }] });
      await put("UNRELATED", {});

      const body = await search({ variationParentSku: "V-PARENT" });
      expect(body.numberOfResults).toBe(2);
      expect(skus(body)).toEqual(["V-BLUE", "V-RED"]);
    });

    it("returns nothing for a parent SKU with no children", async () => {
      await put("LONELY", {});
      expect(await search({ variationParentSku: "LONELY" }).then((b) => b.numberOfResults)).toBe(0);
    });

    it("returns both the container and the contents of the given SKU, but not itself", async () => {
      // PALLET contains CASE, CASE contains UNIT. Anchored on CASE, the
      // qualifying listings are the one that contains it and the one it
      // contains.
      await put("PALLET", { package_contains_sku: [{ sku: "CASE", quantity: 10 }] });
      await put("CASE", { package_contains_sku: [{ sku: "UNIT", quantity: 12 }] });
      await put("UNIT", {});
      await put("UNRELATED", {});

      const body = await search({ packageHierarchySku: "CASE" });
      expect(body.numberOfResults).toBe(2);
      expect(skus(body)).toEqual(["PALLET", "UNIT"]);
    });

    it("returns only the container when the given SKU contains nothing", async () => {
      await put("CASE", { package_contains_sku: [{ sku: "UNIT", quantity: 12 }] });
      await put("UNIT", {});

      const body = await search({ packageHierarchySku: "UNIT" });
      expect(skus(body)).toEqual(["CASE"]);
    });

    it("does not match a relationship filter across sellers", async () => {
      await put("X-CHILD", { child_parent_sku_relationship: [{ child_relationship_type: "variation", parent_sku: "X-PARENT" }] }, undefined, "A1OTHERSELLER");
      await put("X-PARENT", {});

      expect(await search({ variationParentSku: "X-PARENT" }).then((b) => b.numberOfResults)).toBe(0);
    });
  });

  it("returns only the requesting seller's listings", async () => {
    await put("SKU-MINE", {});
    await put("SKU-THEIRS", {}, undefined, "A5BCM0NLAH8KY");

    const body = await search({});
    expect(body.numberOfResults).toBe(1);
    expect((body.items as { sku: string }[])[0].sku).toBe("SKU-MINE");
  });

  it("filters by ASIN identifiers", async () => {
    await put("SKU-A", { merchant_suggested_asin: [{ value: "B0AAAAAAA1" }] });
    await put("SKU-B", {});
    const body = await search({ identifiers: "B0AAAAAAA1", identifiersType: "ASIN" });
    expect(body.numberOfResults).toBe(1);
    expect((body.items as { sku: string }[])[0].sku).toBe("SKU-A");
  });

  it("filters by UPC via externally_assigned_product_identifier", async () => {
    await put("SKU-A", { externally_assigned_product_identifier: [{ type: "upc", value: "887276302195" }] });
    await put("SKU-B", {});
    const body = await search({ identifiers: "887276302195", identifiersType: "UPC" });
    expect(body.numberOfResults).toBe(1);
    expect((body.items as { sku: string }[])[0].sku).toBe("SKU-A");
  });

  it("filters by withStatus / withoutStatus using derived status", async () => {
    await put("SKU-LIVE", { purchasable_offer: OFFER, fulfillment_availability: MFN_5 });
    await put("SKU-OOS", { purchasable_offer: OFFER, fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT", quantity: 0 }] });

    const buyable = await search({ withStatus: "BUYABLE" });
    expect((buyable.items as { sku: string }[]).map((i) => i.sku)).toEqual(["SKU-LIVE"]);

    const notBuyable = await search({ withStatus: "DISCOVERABLE", withoutStatus: "BUYABLE" });
    expect((notBuyable.items as { sku: string }[]).map((i) => i.sku)).toEqual(["SKU-OOS"]);
  });

  it("filters by withIssueSeverity", async () => {
    await put("SKU-A", {});
    const stored = getStored("SKU-A");
    stored.issues = [{ code: "X", message: "m", severity: "ERROR", categories: [] }];
    seedListing("SKU-A", stored);
    await put("SKU-B", {});

    const body = await search({ withIssueSeverity: "ERROR" });
    expect((body.items as { sku: string }[]).map((i) => i.sku)).toEqual(["SKU-A"]);
  });

  it("sorts by sku ASC", async () => {
    await put("SKU-B", {});
    await put("SKU-A", {});
    const body = await search({ sortBy: "sku", sortOrder: "ASC" });
    expect((body.items as { sku: string }[]).map((i) => i.sku)).toEqual(["SKU-A", "SKU-B"]);
  });

  it("paginates with nextToken/previousToken", async () => {
    for (let i = 0; i < 5; i++) await put(`SKU-${String(i)}`, {});
    const first = await search({ pageSize: "2", sortBy: "sku", sortOrder: "ASC" });
    expect((first.items as unknown[]).length).toBe(2);
    const next = (first.pagination as { nextToken: string }).nextToken;

    const second = await search({ pageSize: "2", sortBy: "sku", sortOrder: "ASC", pageToken: next });
    expect((second.items as { sku: string }[]).map((i) => i.sku)).toEqual(["SKU-2", "SKU-3"]);
    expect((second.pagination as { previousToken?: string }).previousToken).toBeDefined();
  });
});

describe("deleteListingsItemHandler", () => {
  beforeEach(() => {
    Context.reset();
  });

  it("removes the listing and returns ACCEPTED with issues[]", async () => {
    await put("SKU-001", {});
    const result = await deleteListingsItemHandler(
      makeValidationResult({
        operationId: "deleteListingsItem",
        pathParams: { sellerId: SELLER_ID, sku: "SKU-001" },
        resolvedEntities: { listing: getStored("SKU-001") },
      }),
      makeRequest(),
    );

    const body = result.data.body as Record<string, unknown>;
    expect(body.status).toBe("ACCEPTED");
    expect(body.issues).toEqual([]);
    expect(Context.instance.engine.get(Api.LISTINGS, listingKey(SELLER_ID, "SKU-001"))).toBeNull();
  });
});

describe("catalog linkage", () => {
  beforeEach(() => {
    Context.reset();
  });

  /** An offer-only submission: sales terms and identity only, no product facts. */
  const OFFER_ONLY_ATTRS: Record<string, unknown> = {
    condition_type: [{ value: "new_new" }],
    fulfillment_availability: MFN_5,
    merchant_shipping_group: [{ value: "legacy-template-id" }],
    purchasable_offer: OFFER,
  };

  function issueCodes(sku: string): string[] {
    return (getStored(sku).issues as { code: string }[]).map((i) => i.code);
  }

  it("accepts the submission first and reports matching asynchronously", async () => {
    // Production accepts it; the mismatch is a downstream outcome.
    const result = await rawPut("SKU-OFFER", { ...OFFER_ONLY_ATTRS, merchant_suggested_asin: [{ value: "B0UNKNOWN9" }] }, "LISTING_OFFER_ONLY");
    expect((result.data.body as Record<string, unknown>).status).toBe("ACCEPTED");
    expect(issueCodes("SKU-OFFER")).toEqual([]);

    await flushTriggers();
    expect(issueCodes("SKU-OFFER")).toEqual(["4005015"]);
  });

  it("reports an unmatchable offer-only submission with no suggested ASIN", async () => {
    await rawPut("SKU-NOMATCH", OFFER_ONLY_ATTRS, "LISTING_OFFER_ONLY");
    await flushTriggers();

    expect(issueCodes("SKU-NOMATCH")).toEqual(["8560"]);
  });

  it("leaves an offer-only submission alone when it matches a catalog item by ASIN", async () => {
    seed(Api.CATALOG, "B0CATALOG1", { asin: "B0CATALOG1", attributes: { brand: [{ value: "CatalogBrand" }] } });

    await rawPut("SKU-OFFER", { ...OFFER_ONLY_ATTRS, merchant_suggested_asin: [{ value: "B0CATALOG1" }] }, "LISTING_OFFER_ONLY");
    await flushTriggers();

    expect(issueCodes("SKU-OFFER")).toEqual([]);
    // The listing returns only what was submitted: no catalog data leaks in.
    expect((getStored("SKU-OFFER").attributes as Record<string, unknown>).brand).toBeUndefined();
  });

  it("matches an offer-only submission by external product identifier", async () => {
    seed(Api.CATALOG, "B0BYUPC001", {
      asin: "B0BYUPC001",
      identifiers: [{ marketplaceId: MP, identifiers: [{ identifierType: "UPC", identifier: "714532191586" }] }],
    });

    await rawPut(
      "SKU-UPC",
      { ...OFFER_ONLY_ATTRS, externally_assigned_product_identifier: [{ type: "upc", value: "714532191586" }] },
      "LISTING_OFFER_ONLY",
    );
    await flushTriggers();

    expect(issueCodes("SKU-UPC")).toEqual([]);
  });

  it("clears a matching issue once the catalog item appears", async () => {
    await rawPut("SKU-LATER", { ...OFFER_ONLY_ATTRS, merchant_suggested_asin: [{ value: "B0LATER001" }] }, "LISTING_OFFER_ONLY");
    await flushTriggers();
    expect(issueCodes("SKU-LATER")).toEqual(["4005015"]);

    seed(Api.CATALOG, "B0LATER001", { asin: "B0LATER001" });
    await rawPut("SKU-LATER", { ...OFFER_ONLY_ATTRS, merchant_suggested_asin: [{ value: "B0LATER001" }] }, "LISTING_OFFER_ONLY");
    await flushTriggers();

    expect(issueCodes("SKU-LATER")).toEqual([]);
  });

  it("creates a catalog item for a net-new full submission", async () => {
    await put("SKU-NEW", { item_name: [{ value: "Net New Widget" }] });
    await flushTriggers();

    const asin = getStored("SKU-NEW").asin as string;
    const catalogItem = Context.instance.engine.get(Api.CATALOG, asin);
    expect(catalogItem).not.toBeNull();
    expect(catalogItem?.productTypes).toEqual([{ marketplaceId: MP, productType: "PRODUCT" }]);
    expect((catalogItem?.summaries as { itemName?: string }[])[0].itemName).toBe("Net New Widget");
    // Only product facts are contributed; the seller's offer is not.
    const catalogAttrs = catalogItem?.attributes as Record<string, unknown>;
    expect(catalogAttrs.item_name).toEqual([{ value: "Net New Widget" }]);
    expect(catalogAttrs.condition_type).toBeUndefined();
  });

  it("creates the catalog item under the seller's suggested ASIN when it is net-new", async () => {
    await put("SKU-SUGGEST", { merchant_suggested_asin: [{ value: "B0BRANDNEW" }] });
    await flushTriggers();

    expect(getStored("SKU-SUGGEST").asin).toBe("B0BRANDNEW");
    expect(Context.instance.engine.get(Api.CATALOG, "B0BRANDNEW")).not.toBeNull();
  });

  it("does not touch a catalog item that already exists", async () => {
    seed(Api.CATALOG, "B0EXISTING", { asin: "B0EXISTING", attributes: { brand: [{ value: "Untouched" }] } });
    await put("SKU-EXIST", { merchant_suggested_asin: [{ value: "B0EXISTING" }] });
    await flushTriggers();

    const catalogAttrs = Context.instance.engine.get(Api.CATALOG, "B0EXISTING")?.attributes as Record<string, unknown>;
    expect(catalogAttrs.brand).toEqual([{ value: "Untouched" }]);
  });
});

describe("offer status derivation", () => {
  it("treats skip_offer=true as never BUYABLE", async () => {
    const productFacts = Object.fromEntries(Object.entries(BASE_ATTRS).filter(([k]) => k !== "condition_type" && k !== "fulfillment_availability"));
    const result = await rawPut("SKU-SKIP", { ...productFacts, skip_offer: [{ value: true }], purchasable_offer: OFFER });
    expect((result.data.body as Record<string, unknown>).status).toBe("ACCEPTED");

    const get = await getListingsItemHandler(
      makeValidationResult({
        pathParams: { sellerId: SELLER_ID, sku: "SKU-SKIP" },
        queryParams: { marketplaceIds: MP, includedData: ["summaries"] },
        resolvedEntities: { listing: getStored("SKU-SKIP") },
      }),
      makeRequest(),
    );
    const summaries = (get.data.body as Record<string, unknown>).summaries as { status: string[] }[];
    expect(summaries[0].status).toEqual(["DISCOVERABLE"]);
  });

  it("treats is_inventory_available inventory as in stock for BUYABLE", async () => {
    await put("SKU-ALWAYS", {
      purchasable_offer: OFFER,
      fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT", is_inventory_available: true }],
    });

    const get = await getListingsItemHandler(
      makeValidationResult({
        pathParams: { sellerId: SELLER_ID, sku: "SKU-ALWAYS" },
        queryParams: { marketplaceIds: MP, includedData: ["summaries"] },
        resolvedEntities: { listing: getStored("SKU-ALWAYS") },
      }),
      makeRequest(),
    );
    const summaries = (get.data.body as Record<string, unknown>).summaries as { status: string[] }[];
    expect(summaries[0].status).toEqual(["BUYABLE", "DISCOVERABLE"]);
  });
});

describe("put attribute semantics", () => {
  beforeEach(() => {
    Context.reset();
  });

  it("re-put drops an omitted product fact and keeps an omitted sales term", async () => {
    await put("SKU-S1", { special_feature: [{ value: "SF" }], purchasable_offer: OFFER });
    await put("SKU-S1", { item_name: [{ value: "Renamed" }] });

    const attrs = getStored("SKU-S1").attributes as Record<string, unknown>;
    expect(attrs.special_feature).toBeUndefined();
    expect(attrs.purchasable_offer).toEqual(OFFER);
  });
});

describe("production VALIDATION_PREVIEW delegation", () => {
  it("calls production with mode=VALIDATION_PREVIEW and the caller's token", async () => {
    const mock = mockPreview(200, { status: "VALID", issues: [] });
    await rawPut("SKU-PREV", BASE_ATTRS);

    const previewCall = mock.mock.calls.find(([url]) => !(url as string).includes("/catalog/"));
    expect(previewCall).toBeDefined();
    const [url, options] = previewCall as [string, RequestInit];
    expect(url).toContain("mode=VALIDATION_PREVIEW");
    expect(url).toContain(`/listings/2021-08-01/items/${SELLER_ID}/SKU-PREV`);
    expect(options.method).toBe("PUT");
    expect((options.headers as Record<string, string>)["x-amz-access-token"]).toBe("Atza|token");
  });

  it("does not forward the caller's own mode parameter", async () => {
    const mock = mockPreview(200, { status: "VALID", issues: [] });
    await putListingsItemHandler(
      makeValidationResult({
        operationId: "putListingsItem",
        pathParams: { sellerId: SELLER_ID, sku: "SKU-MODE" },
        queryParams: { marketplaceIds: MP, mode: "VALIDATION_PREVIEW" },
      }),
      {
        body: { productType: "PRODUCT", attributes: BASE_ATTRS },
        path: `/listings/2021-08-01/items/${SELLER_ID}/SKU-MODE`,
        originalUrl: `/listings/2021-08-01/items/${SELLER_ID}/SKU-MODE?marketplaceIds=${MP}&mode=VALIDATION_PREVIEW`,
        header: (name: string) => (name === "x-amz-access-token" ? "Atza|token" : undefined),
      } as unknown as Request,
    );

    // The sandbox has no dry run: the submission is persisted regardless.
    expect(getStored("SKU-MODE")).toBeDefined();
    const [url] = mock.mock.calls[0] as [string];
    expect(url.match(/mode=/g)).toHaveLength(1);
  });

  it("returns preview INVALID issues synchronously without persisting", async () => {
    const previewIssues = [{ code: "90244", message: "Invalid enumerated value.", severity: "ERROR" }];
    mockPreview(200, { status: "INVALID", issues: previewIssues });

    const result = await rawPut("SKU-PREV", {});
    const body = result.data.body as Record<string, unknown>;

    expect(body.status).toBe("INVALID");
    expect(body.issues).toEqual(previewIssues);
    expect(Context.instance.engine.get(Api.LISTINGS, listingKey(SELLER_ID, "SKU-PREV"))).toBeNull();
  });

  it("stores non-blocking preview issues on the accepted listing", async () => {
    const warning = { code: "90197", message: "Value is greater than the allowed maximum.", severity: "WARNING" };
    mockPreview(200, { status: "VALID", issues: [warning] });

    const result = await rawPut("SKU-PREV", BASE_ATTRS);
    expect((result.data.body as Record<string, unknown>).status).toBe("ACCEPTED");
    expect(getStored("SKU-PREV").issues).toEqual([warning]);
  });

  it("ignores matching issues from production, which cannot see sandbox ASINs", async () => {
    // Production only objected to matching an ASIN it does not know about.
    mockPreview(200, { status: "INVALID", issues: [{ code: "4005015", message: "ASIN does not match.", severity: "ERROR" }] });

    const result = await rawPut("SKU-SANDBOXASIN", { ...BASE_ATTRS, merchant_suggested_asin: [{ value: "B0SANDBOX1" }] });

    expect((result.data.body as Record<string, unknown>).status).toBe("ACCEPTED");
    expect(getStored("SKU-SANDBOXASIN").issues).toEqual([]);
  });

  it("rejects a PUT without credentials (403), since validation cannot be faked locally", async () => {
    const result = await putListingsItemHandler(
      makeValidationResult({
        operationId: "putListingsItem",
        pathParams: { sellerId: SELLER_ID, sku: "SKU-NOTOKEN" },
        queryParams: { marketplaceIds: MP },
      }),
      makeAnonymousRequest({ productType: "PRODUCT", attributes: BASE_ATTRS }),
    );

    expect(result.statusCode).toBe(403);
    expect(Context.instance.engine.get(Api.LISTINGS, listingKey(SELLER_ID, "SKU-NOTOKEN"))).toBeNull();
  });

  it("answers 502 when production cannot be reached, rather than a false ACCEPTED", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await rawPut("SKU-DOWN", BASE_ATTRS);

    expect(result.statusCode).toBe(502);
    expect(Context.instance.engine.get(Api.LISTINGS, listingKey(SELLER_ID, "SKU-DOWN"))).toBeNull();
  });

  it("answers 502 when the preview is throttled", async () => {
    mockPreview(429);

    const result = await rawPut("SKU-THROTTLED", BASE_ATTRS);
    expect(result.statusCode).toBe(502);
  });

  it("treats VALID as the pass status, the only one a preview returns", async () => {
    mockPreview(200, { status: "VALID", issues: [] });

    const result = await rawPut("SKU-VALID", BASE_ATTRS);

    expect(result.statusCode).toBe(200);
    // The sandbox does persist, so its own submission response says ACCEPTED.
    expect((result.data.body as Record<string, unknown>).status).toBe("ACCEPTED");
    expect(getStored("SKU-VALID")).toBeDefined();
  });

  it("answers 502 on a status it does not understand, naming the status", async () => {
    mockPreview(200, { status: "SOMETHING_NEW", issues: [] });

    const result = await rawPut("SKU-UNKNOWN", BASE_ATTRS);

    expect(result.statusCode).toBe(502);
    const errors = (result.data.body as { errors: { message: string }[] }).errors;
    expect(errors[0].message).toContain("SOMETHING_NEW");
    expect(Context.instance.engine.get(Api.LISTINGS, listingKey(SELLER_ID, "SKU-UNKNOWN"))).toBeNull();
  });
});
