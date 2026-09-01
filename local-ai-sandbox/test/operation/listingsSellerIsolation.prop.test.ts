import fc from "fast-check";
import type { Request } from "express";
import { Context, Api } from "../../src/database/Context.js";
import { patchListingsItemHandler, getListingsItemHandler } from "../../src/operation/listingsOperations.js";
import { listingKey } from "../../src/operation/listingsItemModel.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

/**
 * Feature: listings-items-api, Property 13: A listing is addressable only by its own seller and SKU
 *
 * A SKU is unique per selling partner, not globally, so two sellers using the
 * same SKU must hold independent listings. Exercised through patch, which needs
 * no credentials and upserts, so it both creates and mutates.
 */
const MP = "ATVPDKIKX0DER";

/** Seller IDs are opaque identifiers; the key separator must never appear in one. */
const sellerArb = fc
  .string({ minLength: 1, maxLength: 14 })
  .filter((s) => s.trim() === s && s.length > 0 && !s.includes("|"))
  .map((s) => `A${s}`);

const skuArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim() === s && s.length > 0 && !s.includes("|"));

function validationResult(sellerId: string, sku: string, overrides: Partial<UnifiedValidationPass> = {}): UnifiedValidationPass {
  return {
    pass: true,
    operationId: "patchListingsItem",
    apiName: "Listings",
    apiVersion: "2021-08-01",
    pathParams: { sellerId, sku },
    queryParams: { marketplaceIds: MP },
    body: undefined,
    resolvedEntities: {},
    operation: {},
    ...overrides,
  };
}

function request(body: Record<string, unknown>): Request {
  return {
    body,
    path: "/listings/2021-08-01/items",
    originalUrl: `/listings/2021-08-01/items?marketplaceIds=${MP}`,
    header: () => undefined,
  } as unknown as Request;
}

function patch(sellerId: string, sku: string, name: string) {
  return patchListingsItemHandler(
    validationResult(sellerId, sku),
    request({ productType: "PRODUCT", patches: [{ op: "replace", path: "/attributes/item_name", value: [{ value: name }] }] }),
  );
}

function storedName(sellerId: string, sku: string): unknown {
  const doc = Context.instance.engine.get(Api.LISTINGS, listingKey(sellerId, sku));
  return (doc?.attributes as { item_name?: { value?: string }[] } | undefined)?.item_name?.[0]?.value;
}

describe("Feature: listings-items-api, Property 13: A listing is addressable only by its own seller and SKU", () => {
  beforeEach(() => {
    Context.reset();
  });

  it("keeps two sellers' listings independent when they share a SKU", async () => {
    await fc.assert(
      fc.asyncProperty(sellerArb, sellerArb, skuArb, async (sellerA, sellerB, sku) => {
        fc.pre(sellerA !== sellerB);
        Context.reset();

        await patch(sellerA, sku, "A-original");
        await patch(sellerB, sku, "B-original");

        // Each seller's write lands on its own record.
        expect(storedName(sellerA, sku)).toBe("A-original");
        expect(storedName(sellerB, sku)).toBe("B-original");

        // Mutating one leaves the other untouched.
        await patch(sellerB, sku, "B-updated");
        expect(storedName(sellerA, sku)).toBe("A-original");
        expect(storedName(sellerB, sku)).toBe("B-updated");
      }),
      { numRuns: 100 },
    );
  });

  it("returns each seller its own listing, and reports the bare SKU", async () => {
    await fc.assert(
      fc.asyncProperty(sellerArb, sellerArb, skuArb, async (sellerA, sellerB, sku) => {
        fc.pre(sellerA !== sellerB);
        Context.reset();

        await patch(sellerA, sku, "A-only");
        await patch(sellerB, sku, "B-only");

        for (const [seller, expected] of [
          [sellerA, "A-only"],
          [sellerB, "B-only"],
        ] as const) {
          const stored = Context.instance.engine.get(Api.LISTINGS, listingKey(seller, sku));
          const result = await getListingsItemHandler(
            validationResult(seller, sku, {
              operationId: "getListingsItem",
              queryParams: { marketplaceIds: MP, includedData: ["attributes"] },
              resolvedEntities: { listing: stored as Record<string, unknown> },
            }),
            request({}),
          );

          const item = result.data.body as { sku: string; attributes: { item_name?: { value?: string }[] } };
          // The composite key never leaks into the response.
          expect(item.sku).toBe(sku);
          expect(item.attributes.item_name?.[0].value).toBe(expected);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("does not resolve one seller's SKU under another seller", async () => {
    await fc.assert(
      fc.asyncProperty(sellerArb, sellerArb, skuArb, async (sellerA, sellerB, sku) => {
        fc.pre(sellerA !== sellerB);
        Context.reset();

        await patch(sellerA, sku, "A-only");

        expect(Context.instance.engine.get(Api.LISTINGS, listingKey(sellerB, sku))).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
