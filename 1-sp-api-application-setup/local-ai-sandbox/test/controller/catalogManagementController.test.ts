/**
 * Catalog import and manual reprocess.
 *
 * The upstream call is stubbed, because the point of these tests is the
 * sandbox's own behaviour around it — validation, partial failure, and the
 * reconciliation that follows a successful import.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Request, Response } from "express";
import { Context, Api } from "../../src/database/Context.js";
import { listingKey, ISSUE_CODE_ASIN_MISMATCH } from "../../src/operation/listingsItemModel.js";
import { importCatalogItems, reprocessMatching } from "../../src/controller/catalogManagementController.js";

const SELLER = "AMY6FKRUBY7XV";
const MP = "ATVPDKIKX0DER";
const realFetch = globalThis.fetch;

/** Captures what a handler sent, the way the /manage controllers respond. */
function makeResponse() {
  const captured = { statusCode: 0, body: undefined as unknown };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  return { res: res as unknown as Response, captured };
}

/** A request carrying a body and, unless suppressed, an access token. */
function makeRequest(body: unknown, withToken = true): Request {
  return {
    body,
    header: (name: string) => (withToken && name === "x-amz-access-token" ? "Atza|token" : undefined),
  } as unknown as Request;
}

/** Stubs production's getCatalogItem per ASIN. The controller always calls fetch with a string URL. */
function stubCatalog(responses: Map<string, { status: number; body?: unknown }>) {
  globalThis.fetch = vi.fn((url: string) => {
    const asin = decodeURIComponent(/\/items\/([^?]+)/.exec(url)?.[1] ?? "");
    const entry = responses.get(asin);
    if (!entry) return Promise.resolve(new Response("{}", { status: 404 }));
    return Promise.resolve(
      new Response(entry.body === undefined ? "" : JSON.stringify(entry.body), {
        status: entry.status,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as unknown as typeof globalThis.fetch;
}

function seedOfferOnlyListing(sku: string, asin: string) {
  Context.instance.engine.put(
    Api.LISTINGS,
    listingKey(SELLER, sku),
    {
      sku,
      sellerId: SELLER,
      marketplaceId: MP,
      productType: "PRODUCT",
      requirements: "LISTING_OFFER_ONLY",
      asin,
      issues: [],
      attributes: { merchant_suggested_asin: [{ value: asin }] },
    },
    { silent: true },
  );
}

beforeEach(() => {
  Context.reset();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("importCatalogItems validation", () => {
  it("rejects a body without an asins array", async () => {
    const { res, captured } = makeResponse();
    await importCatalogItems(makeRequest({}), res);
    expect(captured.statusCode).toBe(400);
    expect((captured.body as { error: string }).error).toContain("asins");
  });

  it("rejects an empty asins array", async () => {
    const { res, captured } = makeResponse();
    await importCatalogItems(makeRequest({ asins: [] }), res);
    expect(captured.statusCode).toBe(400);
  });

  it("rejects a non-string ASIN entry", async () => {
    const { res, captured } = makeResponse();
    await importCatalogItems(makeRequest({ asins: ["B0VALID001", 42], marketplaceId: MP }), res);
    expect(captured.statusCode).toBe(400);
  });

  it("rejects more ASINs than the per-request cap", async () => {
    const { res, captured } = makeResponse();
    await importCatalogItems(
      makeRequest({ asins: Array.from({ length: 21 }, (_, i) => `B0ITEM${String(i).padStart(4, "0")}`), marketplaceId: MP }),
      res,
    );
    expect(captured.statusCode).toBe(400);
    expect((captured.body as { error: string }).error).toContain("limited to 20");
  });

  it("refuses without an access token, since production is the only source", async () => {
    const { res, captured } = makeResponse();
    await importCatalogItems(makeRequest({ asins: ["B0VALID001"], marketplaceId: MP }, false), res);
    expect(captured.statusCode).toBe(401);
    expect((captured.body as { error: string }).error).toContain("x-amz-access-token");
  });

  it("rejects a body without a marketplaceId, which cannot be inferred", async () => {
    const { res, captured } = makeResponse();
    await importCatalogItems(makeRequest({ asins: ["B0VALID001"] }), res);
    expect(captured.statusCode).toBe(400);
    expect((captured.body as { error: string }).error).toContain("marketplaceId");
  });

  it("rejects a marketplace outside the configured region", async () => {
    const { res, captured } = makeResponse();
    await importCatalogItems(makeRequest({ asins: ["B0VALID001"], marketplaceId: "A1F83G8C2ARO7P" }), res);
    expect(captured.statusCode).toBe(400);
    expect((captured.body as { error: string }).error).toContain("not valid for the configured region");
  });
});

describe("importCatalogItems", () => {
  it("stores an imported item under its ASIN", async () => {
    stubCatalog(
      new Map([["B0REAL0001", { status: 200, body: { asin: "B0REAL0001", summaries: [{ marketplaceId: MP, itemName: "MacBook Air" }] } }]]),
    );

    const { res, captured } = makeResponse();
    await importCatalogItems(makeRequest({ asins: ["B0REAL0001"], marketplaceId: MP }), res);

    expect(captured.statusCode).toBe(200);
    expect((captured.body as { imported: string[] }).imported).toEqual(["B0REAL0001"]);
    expect(Context.instance.engine.get(Api.CATALOG, "B0REAL0001")).toMatchObject({ asin: "B0REAL0001" });
  });

  it("clears a listing's matching issue in the same request", async () => {
    seedOfferOnlyListing("OFFER-1", "B0REAL0002");
    // The listing is tagged before the ASIN is known.
    const { res: firstRes } = makeResponse();
    reprocessMatching(makeRequest({}), firstRes);
    expect((Context.instance.engine.get(Api.LISTINGS, listingKey(SELLER, "OFFER-1"))?.issues as { code: string }[]).map((i) => i.code)).toEqual([
      ISSUE_CODE_ASIN_MISMATCH,
    ]);

    stubCatalog(new Map([["B0REAL0002", { status: 200, body: { asin: "B0REAL0002" } }]]));
    const { res, captured } = makeResponse();
    await importCatalogItems(makeRequest({ asins: ["B0REAL0002"], marketplaceId: MP }), res);

    expect((captured.body as { reconciled: { changed: number } }).reconciled.changed).toBe(1);
    expect(Context.instance.engine.get(Api.LISTINGS, listingKey(SELLER, "OFFER-1"))?.issues).toEqual([]);
  });

  it("reports a partial import rather than failing the whole request", async () => {
    stubCatalog(
      new Map<string, { status: number; body?: unknown }>([
        ["B0GOOD0001", { status: 200, body: { asin: "B0GOOD0001" } }],
        ["B0GONE0001", { status: 404 }],
      ]),
    );

    const { res, captured } = makeResponse();
    await importCatalogItems(makeRequest({ asins: ["B0GOOD0001", "B0GONE0001"], marketplaceId: MP }), res);

    const body = captured.body as { imported: string[]; failed: { asin: string; reason: string }[] };
    expect(captured.statusCode).toBe(200);
    expect(body.imported).toEqual(["B0GOOD0001"]);
    expect(body.failed).toEqual([{ asin: "B0GONE0001", reason: "not found in the production catalog for this marketplace" }]);
  });

  it("answers 502 when nothing could be imported", async () => {
    stubCatalog(new Map([["B0GONE0002", { status: 404 }]]));

    const { res, captured } = makeResponse();
    await importCatalogItems(makeRequest({ asins: ["B0GONE0002"], marketplaceId: MP }), res);

    expect(captured.statusCode).toBe(502);
    expect((captured.body as { failed: unknown[] }).failed).toHaveLength(1);
  });

  it("records an upstream status against the ASIN that drew it", async () => {
    stubCatalog(new Map([["B0THROTTLE", { status: 429 }]]));

    const { res, captured } = makeResponse();
    await importCatalogItems(makeRequest({ asins: ["B0THROTTLE"], marketplaceId: MP }), res);

    expect((captured.body as { failed: { reason: string }[] }).failed[0].reason).toContain("HTTP 429");
  });

  it("survives a transport failure on one ASIN", async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("socket hang up")));

    const { res, captured } = makeResponse();
    await importCatalogItems(makeRequest({ asins: ["B0NETFAIL1"], marketplaceId: MP }), res);

    expect(captured.statusCode).toBe(502);
    expect((captured.body as { failed: { reason: string }[] }).failed[0].reason).toContain("socket hang up");
  });
});

describe("reprocessMatching", () => {
  it("reports what the sweep evaluated and changed", () => {
    seedOfferOnlyListing("OFFER-2", "B0MISSING9");

    const { res, captured } = makeResponse();
    reprocessMatching(makeRequest({}), res);

    expect(captured.statusCode).toBe(200);
    expect(captured.body).toMatchObject({ evaluated: 1, changed: 1 });
  });

  it("reports zero changes on a second run", () => {
    seedOfferOnlyListing("OFFER-3", "B0MISSING8");
    const first = makeResponse();
    reprocessMatching(makeRequest({}), first.res);

    const { res, captured } = makeResponse();
    reprocessMatching(makeRequest({}), res);
    expect(captured.body).toMatchObject({ evaluated: 1, changed: 0 });
  });
});
