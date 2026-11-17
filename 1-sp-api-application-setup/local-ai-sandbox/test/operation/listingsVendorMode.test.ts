/**
 * Vendor-mode behaviour for the Listings Items API.
 *
 * Listings Items is documented "Sellers and Vendors", so every operation is
 * callable in either mode. What differs is the data and a few submission
 * features. MODE is read once at module load, so these tests reset the module
 * graph and re-import with MODE=Vendor rather than mutating a live constant.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import type { Request } from "express";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

const MP = "ATVPDKIKX0DER";
const VENDOR_ID = "AMY6FKRUBY7XV";

/** Loads the registry and listings handlers under a given MODE. */
async function loadUnderMode(mode: string) {
  process.env.MODE = mode;
  vi.resetModules();
  const registry = await import("../../src/registry/operationRegistry.js");
  const listings = await import("../../src/operation/listingsOperations.js");
  const context = await import("../../src/database/Context.js");
  return { registry, listings, context };
}

const originalMode = process.env.MODE;

afterEach(() => {
  if (originalMode === undefined) delete process.env.MODE;
  else process.env.MODE = originalMode;
  vi.resetModules();
});

describe("Listings Items availability by mode", () => {
  const listingsOps = ["getListingsItem", "searchListingsItems", "putListingsItem", "patchListingsItem", "deleteListingsItem"];

  /** Maps each Listings Items operation to whether the current mode allows it. */
  async function allowanceByOperation(mode: string) {
    const { registry } = await loadUnderMode(mode);
    return Object.fromEntries(
      listingsOps.map((op) => [op, registry.OPERATIONS_REGISTRY.isAllowedInCurrentMode(registry.buildKey("Listings", "2021-08-01", op))]),
    );
  }

  const allAllowed = {
    getListingsItem: true,
    searchListingsItems: true,
    putListingsItem: true,
    patchListingsItem: true,
    deleteListingsItem: true,
  };

  it("allows every Listings Items operation in Vendor mode", async () => {
    expect(await allowanceByOperation("Vendor")).toEqual(allAllowed);
  });

  it("allows every Listings Items operation in Seller mode", async () => {
    expect(await allowanceByOperation("Seller")).toEqual(allAllowed);
  });

  // Listings Restrictions is documented "Sellers only", unlike Listings Items.
  it("refuses Listings Restrictions in Vendor mode but allows it in Seller mode", async () => {
    const vendor = await loadUnderMode("Vendor");
    const restrictionsKey = vendor.registry.buildKey("Listings Restrictions", "2021-08-01", "getListingsRestrictions");
    expect(vendor.registry.OPERATIONS_REGISTRY.isAllowedInCurrentMode(restrictionsKey)).toBe(false);

    const seller = await loadUnderMode("Seller");
    expect(seller.registry.OPERATIONS_REGISTRY.isAllowedInCurrentMode(seller.registry.buildKey("Listings Restrictions", "2021-08-01", "getListingsRestrictions"))).toBe(
      true,
    );
  });
});

describe("selling-partner-specific datasets in Vendor mode", () => {
  /** Runs the real request pipeline for a GET carrying the given includedData. */
  async function validateIncludedData(mode: string, includedData: string) {
    const { context } = await loadUnderMode(mode);
    const { validateRequest } = await import("../../src/service/validationEngine.js");
    const { listingKey } = await import("../../src/operation/listingsItemModel.js");
    context.Context.reset();
    context.Context.instance.engine.put(
      context.Api.LISTINGS,
      listingKey(VENDOR_ID, "SKU-1"),
      { sku: "SKU-1", sellerId: VENDOR_ID, attributes: {}, issues: [] },
      { silent: true },
    );
    return validateRequest({
      method: "GET",
      path: `/listings/2021-08-01/items/${VENDOR_ID}/SKU-1`,
      query: { marketplaceIds: MP, includedData },
      headers: {},
      body: undefined,
    } as never);
  }

  it("rejects the seller-only offers section for a vendor", async () => {
    const result = (await validateIncludedData("Vendor", "offers")) as {
      pass: boolean;
      statusCode?: number;
      body?: { errors: { message: string }[] };
    };
    expect(result.pass).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.body?.errors[0].message).toContain("only available to sellers");
  });

  it("rejects the seller-only fulfillmentAvailability section for a vendor", async () => {
    const result = (await validateIncludedData("Vendor", "fulfillmentAvailability")) as { pass: boolean; statusCode?: number };
    expect(result.pass).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it("accepts the vendor-only procurement section for a vendor", async () => {
    const result = await validateIncludedData("Vendor", "procurement");
    expect(result.pass).toBe(true);
  });
});

describe("LISTING_OFFER_ONLY submissions by mode", () => {
  /** Runs the real request pipeline for a PUT carrying the given requirements. */
  async function validatePut(mode: string, requirements: string) {
    await loadUnderMode(mode);
    const { validateRequest } = await import("../../src/service/validationEngine.js");
    return validateRequest({
      method: "PUT",
      path: `/listings/2021-08-01/items/${VENDOR_ID}/SKU-1`,
      query: { marketplaceIds: MP },
      headers: {},
      body: { productType: "PRODUCT", requirements, attributes: {} },
    } as never);
  }

  // A vendor supplies the product itself, so it never lists against an ASIN
  // owned by someone else.
  it("rejects LISTING_OFFER_ONLY for a vendor", async () => {
    const result = (await validatePut("Vendor", "LISTING_OFFER_ONLY")) as {
      pass: boolean;
      statusCode?: number;
      body?: { errors: { message: string }[] };
    };
    expect(result.pass).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.body?.errors[0].message).toContain("only available to sellers");
  });

  it("accepts LISTING_PRODUCT_ONLY for a vendor", async () => {
    expect((await validatePut("Vendor", "LISTING_PRODUCT_ONLY")).pass).toBe(true);
  });
});

describe("patchListingsItem delete operation by mode", () => {
  /** A patch request body carrying a single operation. */
  function patchBody(op: string) {
    return {
      productType: "PRODUCT",
      patches: [{ op, path: "/attributes/item_name", value: [{ value: "Renamed", marketplace_id: MP, language_tag: "en_US" }] }],
    };
  }

  async function runPatch(mode: string, op: string) {
    const { listings, context } = await loadUnderMode(mode);
    context.Context.reset();
    const body = patchBody(op);
    const validationResult: UnifiedValidationPass = {
      pass: true,
      operationId: "patchListingsItem",
      apiName: "Listings",
      apiVersion: "2021-08-01",
      pathParams: { sellerId: VENDOR_ID, sku: "SKU-V1" },
      queryParams: { marketplaceIds: MP },
      body,
      resolvedEntities: {},
      operation: {},
    };
    const result = await listings.patchListingsItemHandler(validationResult, { body } as Request);
    return result.data as { body: { status: string; issues: { message: string }[] } };
  }

  it("rejects a delete patch in Vendor mode with an INVALID submission", async () => {
    const body = (await runPatch("Vendor", "delete")).body;
    expect(body.status).toBe("INVALID");
    expect(body.issues[0].message).toContain("not supported for vendors");
  });

  it("accepts a replace patch in Vendor mode", async () => {
    expect((await runPatch("Vendor", "replace")).body.status).toBe("ACCEPTED");
  });

  it("accepts a delete patch in Seller mode", async () => {
    expect((await runPatch("Seller", "delete")).body.status).toBe("ACCEPTED");
  });
});
