import { describe, it, expect, beforeEach } from "vitest";
import type { Request } from "express";
import { validateRequest } from "../../src/service/validationEngine.js";
import { Context, Api } from "../../src/database/Context.js";
import type { UnifiedValidationFail } from "../../src/validation/validationTypes.js";
import { listingKey } from "../../src/operation/listingsItemModel.js";

/**
 * Request-level (HTTP 400) validation for the Listings Items API, exercised
 * end to end through the real OpenAPI model and the real rule pipeline.
 * These are distinct from submission issues, which are reported as HTTP 200
 * with status INVALID.
 */
const MP = "ATVPDKIKX0DER";
const SELLER = "AMY6FKRUBY7XV";

function request(overrides: Partial<Request> & { path: string }): Request {
  return {
    method: "GET",
    query: {},
    headers: {},
    body: undefined,
    ...overrides,
  } as unknown as Request;
}

function itemsPath(sku = "SKU-1") {
  return `/listings/2021-08-01/items/${SELLER}/${sku}`;
}

async function expectFail(req: Request): Promise<UnifiedValidationFail> {
  const result = await validateRequest(req);
  expect(result.pass).toBe(false);
  return result as UnifiedValidationFail;
}

describe("Listings request validation (HTTP 400 class)", () => {
  beforeEach(() => {
    Context.reset();
    Context.instance.engine.put(
      Api.LISTINGS,
      listingKey(SELLER, "SKU-1"),
      { sku: "SKU-1", sellerId: SELLER, attributes: {}, issues: [] },
      { silent: true },
    );
  });

  describe("marketplaceIds", () => {
    it("rejects a missing marketplaceIds", async () => {
      const fail = await expectFail(request({ path: itemsPath() }));
      expect(fail.statusCode).toBe(400);
    });

    it("rejects a marketplace ID from another region", async () => {
      const fail = await expectFail(request({ path: itemsPath(), query: { marketplaceIds: "A1F83G8C2ARO7P" } }));
      expect(fail.statusCode).toBe(400);
    });

    it("accepts a valid marketplace ID", async () => {
      const result = await validateRequest(request({ path: itemsPath(), query: { marketplaceIds: MP } }));
      expect(result.pass).toBe(true);
    });
  });

  describe("enum-constrained query parameters", () => {
    it("rejects an unknown includedData value", async () => {
      const fail = await expectFail(request({ path: itemsPath(), query: { marketplaceIds: MP, includedData: "summaries,bogusSection" } }));
      expect(fail.statusCode).toBe(400);
    });

    it("rejects an unknown sortBy value on search", async () => {
      const fail = await expectFail(request({ path: `/listings/2021-08-01/items/${SELLER}`, query: { marketplaceIds: MP, sortBy: "price" } }));
      expect(fail.statusCode).toBe(400);
    });

    it("rejects an unknown identifiersType value on search", async () => {
      const fail = await expectFail(
        request({ path: `/listings/2021-08-01/items/${SELLER}`, query: { marketplaceIds: MP, identifiers: "SKU-1", identifiersType: "MPN" } }),
      );
      expect(fail.statusCode).toBe(400);
    });

    it("rejects an unknown withStatus value on search", async () => {
      const fail = await expectFail(request({ path: `/listings/2021-08-01/items/${SELLER}`, query: { marketplaceIds: MP, withStatus: "SELLABLE" } }));
      expect(fail.statusCode).toBe(400);
    });

    it("rejects an unknown mode value on put", async () => {
      const fail = await expectFail(
        request({
          method: "PUT",
          path: itemsPath(),
          query: { marketplaceIds: MP, mode: "WRONG_ENUM" },
          body: { productType: "PRODUCT", attributes: {} },
        }),
      );
      expect(fail.statusCode).toBe(400);
    });
  });

  /**
   * Both selling partner types call these operations, but some datasets belong
   * to one of them only. These run in the default Seller mode, so they cover
   * the seller side of the gate; the vendor side lives in
   * test/operation/listingsVendorMode.test.ts, which has to reload the module
   * graph to change MODE.
   */
  describe("selling-partner-specific datasets", () => {
    it("rejects the vendor-only procurement section for a seller", async () => {
      const fail = await expectFail(request({ path: itemsPath(), query: { marketplaceIds: MP, includedData: "procurement" } }));
      expect(fail.statusCode).toBe(400);
      expect(fail.body?.errors[0].message).toContain("only available to vendors");
    });

    it("accepts the seller-only offers and fulfillmentAvailability sections for a seller", async () => {
      const result = await validateRequest(
        request({ path: itemsPath(), query: { marketplaceIds: MP, includedData: "offers,fulfillmentAvailability" } }),
      );
      expect(result.pass).toBe(true);
    });

    it("rejects the vendor-only procurement section on search for a seller", async () => {
      const fail = await expectFail(
        request({ path: `/listings/2021-08-01/items/${SELLER}`, query: { marketplaceIds: MP, includedData: "summaries,procurement" } }),
      );
      expect(fail.statusCode).toBe(400);
    });

    it("accepts a seller's LISTING_OFFER_ONLY submission", async () => {
      const result = await validateRequest(
        request({
          method: "PUT",
          path: itemsPath(),
          query: { marketplaceIds: MP },
          body: { productType: "PRODUCT", requirements: "LISTING_OFFER_ONLY", attributes: {} },
        }),
      );
      expect(result.pass).toBe(true);
    });
  });

  describe("pageSize bounds on search", () => {
    it("rejects a pageSize above the documented maximum of 20", async () => {
      const fail = await expectFail(request({ path: `/listings/2021-08-01/items/${SELLER}`, query: { marketplaceIds: MP, pageSize: "50" } }));
      expect(fail.statusCode).toBe(400);
    });
  });

  describe("request body", () => {
    it("rejects a put with no body", async () => {
      const fail = await expectFail(request({ method: "PUT", path: itemsPath(), query: { marketplaceIds: MP } }));
      expect(fail.statusCode).toBe(400);
    });

    it("rejects a put missing the required productType", async () => {
      const fail = await expectFail(request({ method: "PUT", path: itemsPath(), query: { marketplaceIds: MP }, body: { attributes: {} } }));
      expect(fail.statusCode).toBe(400);
    });

    it("rejects a patch whose patch op is not a known enum value", async () => {
      const fail = await expectFail(
        request({
          method: "PATCH",
          path: itemsPath(),
          query: { marketplaceIds: MP },
          body: { productType: "PRODUCT", patches: [{ op: "increment", path: "/attributes/color" }] },
        }),
      );
      expect(fail.statusCode).toBe(400);
    });
  });

  describe("identifiers pairing on search", () => {
    it("rejects identifiers without identifiersType", async () => {
      const fail = await expectFail(request({ path: `/listings/2021-08-01/items/${SELLER}`, query: { marketplaceIds: MP, identifiers: "SKU-1" } }));
      expect(fail.statusCode).toBe(400);
    });

    it("rejects identifiersType without identifiers", async () => {
      const fail = await expectFail(request({ path: `/listings/2021-08-01/items/${SELLER}`, query: { marketplaceIds: MP, identifiersType: "SKU" } }));
      expect(fail.statusCode).toBe(400);
    });

    it("rejects identifiers combined with variationParentSku", async () => {
      const fail = await expectFail(
        request({
          path: `/listings/2021-08-01/items/${SELLER}`,
          query: { marketplaceIds: MP, identifiers: "SKU-1", identifiersType: "SKU", variationParentSku: "PARENT-1" },
        }),
      );
      expect(fail.statusCode).toBe(400);
    });

    it("rejects identifiers combined with packageHierarchySku", async () => {
      const fail = await expectFail(
        request({
          path: `/listings/2021-08-01/items/${SELLER}`,
          query: { marketplaceIds: MP, identifiers: "SKU-1", identifiersType: "SKU", packageHierarchySku: "PKG-1" },
        }),
      );
      expect(fail.statusCode).toBe(400);
    });

    it("accepts identifiers together with identifiersType", async () => {
      const result = await validateRequest(
        request({ path: `/listings/2021-08-01/items/${SELLER}`, query: { marketplaceIds: MP, identifiers: "SKU-1", identifiersType: "SKU" } }),
      );
      expect(result.pass).toBe(true);
    });
  });

  /**
   * A SKU is unique per seller, not globally, so a listing is keyed by both.
   * This is a fidelity concern, not an access-control one: the sandbox never
   * authenticates the caller, so `sellerId` is simply part of a listing's
   * identity. Keying by SKU alone would make two sellers using the same SKU
   * collide on one record.
   */
  describe("seller + SKU composite key", () => {
    const OTHER_SELLER = "A9OTHERSELLER1";

    it("resolves the listing under the seller that holds it", async () => {
      const result = await validateRequest(request({ path: itemsPath(), query: { marketplaceIds: MP } }));
      expect(result.pass).toBe(true);
    });

    it("does not resolve the same SKU under a different seller on GET", async () => {
      const fail = await expectFail(request({ path: `/listings/2021-08-01/items/${OTHER_SELLER}/SKU-1`, query: { marketplaceIds: MP } }));

      expect(fail.statusCode).toBe(404);
    });

    it("does not resolve the same SKU under a different seller on DELETE", async () => {
      const fail = await expectFail(
        request({ method: "DELETE", path: `/listings/2021-08-01/items/${OTHER_SELLER}/SKU-1`, query: { marketplaceIds: MP } }),
      );

      expect(fail.statusCode).toBe(404);
    });

    it("still resolves for the holding seller on DELETE", async () => {
      const result = await validateRequest(request({ method: "DELETE", path: itemsPath(), query: { marketplaceIds: MP } }));
      expect(result.pass).toBe(true);
    });
  });
});
