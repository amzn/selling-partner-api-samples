import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import { executeValidation } from "../../src/service/validationEngine.js";
import { RequestContext, ValidationFail } from "../../src/validation/validationTypes.js";
import { OPERATIONS_REGISTRY } from "../../src/registry/operationRegistry.js";

// Seeded entities for the mocked engine.get (keyed by id, api-agnostic for these tests).
const seeded = new Map<string, Record<string, unknown>>();

vi.mock("../../src/database/Context.js", () => ({
  Api: { DATA_KIOSK: "dataKiosk" },
  Context: {
    get instance() {
      return {
        engine: {
          get: (_api: string, key: string) => seeded.get(key) ?? null,
          find: () => [...seeded.values()],
          put: (_api: string, key: string, value: Record<string, unknown>) => seeded.set(key, { ...value, _key: key }),
          getCollection: () => ({ find: () => [...seeded.values()] }),
        },
      };
    },
  },
}));

// Stub index.js so importing spapiController does not execute the app's top-level route setup.
vi.mock("../../src/index.js", () => ({
  asyncLocalStorage: { run: async (_s: unknown, f: () => unknown) => f() },
}));

const { downloadDataKioskDocument } = await import("../../src/controller/spapiController.js");

const DATASET = "analytics_salesAndTraffic_2024_04_24";
function sellerQuery(startDate = "2023-01-01", endDate = "2023-01-03"): string {
  return `{${DATASET}{salesAndTrafficByDate(startDate:"${startDate}" endDate:"${endDate}" aggregateBy:DAY marketplaceIds:["ATVPDKIKX0DER"]){sales{orderedProductSales{amount currencyCode}}}}}`;
}

function ctx(overrides: Partial<RequestContext>): RequestContext {
  return {
    apiName: "Data Kiosk",
    apiVersion: "2023-11-15",
    operationId: "getQuery",
    method: "GET",
    pathParams: {},
    queryParams: {},
    body: undefined,
    ...overrides,
  };
}

describe("Data Kiosk integration — validation pipeline", () => {
  it("getQuery with an unknown queryId is rejected with 404 before the handler", async () => {
    seeded.clear();
    const result = await executeValidation(ctx({ operationId: "getQuery", pathParams: { queryId: "DK-UNKNOWN" } }));
    expect(result.pass).toBe(false);
    expect((result as ValidationFail).statusCode).toBe(404);
  });

  it("cancelQuery on a DONE query is rejected with 400", async () => {
    seeded.clear();
    seeded.set("DK-DONE", { _key: "DK-DONE", queryId: "DK-DONE", query: "{x}", processingStatus: "DONE", createdTime: "2024-01-01T00:00:00Z" });
    const result = await executeValidation(ctx({ operationId: "cancelQuery", method: "DELETE", pathParams: { queryId: "DK-DONE" } }));
    expect(result.pass).toBe(false);
    expect((result as ValidationFail).statusCode).toBe(400);
  });

  it("cancelQuery on an IN_QUEUE query passes validation", async () => {
    seeded.clear();
    seeded.set("DK-Q", { _key: "DK-Q", queryId: "DK-Q", query: "{x}", processingStatus: "IN_QUEUE", createdTime: "2024-01-01T00:00:00Z" });
    expect((await executeValidation(ctx({ operationId: "cancelQuery", method: "DELETE", pathParams: { queryId: "DK-Q" } }))).pass).toBe(true);
  });

  it("getDocument for an unknown documentId is rejected with 404", async () => {
    seeded.clear();
    expect((await executeValidation(ctx({ operationId: "getDocument", pathParams: { documentId: "DKDOC-UNKNOWN" } }))).pass).toBe(false);
  });

  it("getQueries with createdSince after createdUntil is rejected with 400", async () => {
    seeded.clear();
    const result = await executeValidation(ctx({ operationId: "getQueries", queryParams: { createdSince: "2024-05-01T00:00:00Z", createdUntil: "2024-01-01T00:00:00Z" } }));
    expect(result.pass).toBe(false);
    expect((result as ValidationFail).statusCode).toBe(400);
  });

  // Level B: 8000-char rule (stringLengthLimit) in the createQuery pipeline.
  it("createQuery passes the length rule for a normal query", async () => {
    seeded.clear();
    expect((await executeValidation(ctx({ operationId: "createQuery", method: "POST", body: { query: sellerQuery() } }))).pass).toBe(true);
  });

  it("createQuery rejects a query longer than 8000 chars (after whitespace normalization) with 400", async () => {
    seeded.clear();
    const longQuery = `{${DATASET}{salesAndTrafficByDate(${"x".repeat(8100)})}}`;
    const result = await executeValidation(ctx({ operationId: "createQuery", method: "POST", body: { query: longQuery } }));
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].code).toBe("InvalidInput");
  });

  it("createQuery length rule ignores insignificant whitespace (padded query under the cap passes)", async () => {
    seeded.clear();
    // Real content is short; padding is whitespace which normalizes away.
    const padded = `{${DATASET}{salesAndTrafficByDate(startDate:"2023-01-01" endDate:"2023-01-02")}}` + " ".repeat(9000);
    expect((await executeValidation(ctx({ operationId: "createQuery", method: "POST", body: { query: padded } }))).pass).toBe(true);
  });
});

describe("Data Kiosk integration — end-to-end submit/poll/download", () => {
  const createQuery = OPERATIONS_REGISTRY.get("Data Kiosk:2023-11-15:createQuery")!;
  const getQuery = OPERATIONS_REGISTRY.get("Data Kiosk:2023-11-15:getQuery")!;
  const getDocument = OPERATIONS_REGISTRY.get("Data Kiosk:2023-11-15:getDocument")!;

  function vr(overrides: Record<string, unknown>): never {
    return { pass: true, apiName: "Data Kiosk", apiVersion: "2023-11-15", queryParams: {}, pathParams: {}, body: undefined, resolvedEntities: {}, operation: {}, ...overrides } as never;
  }
  function req(body?: Record<string, unknown>): Request {
    return { body, get: () => "localhost:9001" } as unknown as Request;
  }
  /** Submit then poll until terminal using the real handlers + the seeded store as the DB. */
  async function drive(query: string): Promise<Record<string, unknown>> {
    const created = await createQuery(vr({ operationId: "createQuery" }), req({ query }));
    const queryId = (created.data.body as Record<string, unknown>).queryId as string;
    let body: Record<string, unknown> = {};
    for (let i = 0; i < 5; i++) {
      body = (await getQuery(vr({ operationId: "getQuery", pathParams: { queryId }, resolvedEntities: { query: seeded.get(queryId)! } }), req())).data.body as Record<string, unknown>;
      if (["DONE", "FATAL", "CANCELLED"].includes(body.processingStatus as string)) break;
    }
    return body;
  }

  beforeEach(() => {
    seeded.clear();
    delete process.env.MODE;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MODE;
  });

  it("Seller data query → DONE with a downloadable JSONL document", async () => {
    const body = await drive(sellerQuery("2023-01-01", "2023-01-03"));
    expect(body.processingStatus).toBe("DONE");
    const docId = body.dataDocumentId as string;
    expect(docId).toBeDefined();

    const docRes = await getDocument(vr({ operationId: "getDocument", pathParams: { documentId: docId } }), req());
    const url = (docRes.data.body as Record<string, unknown>).documentUrl as string;
    expect(url).toContain(`/dataKiosk/download/${docId}`);

    // Download serves the JSONL (3 days).
    let status = 0;
    let payload: unknown;
    let ctype: string | undefined;
    const res = { setHeader: (k: string, v: string) => { if (k === "Content-Type") ctype = v; }, status: (c: number) => { status = c; return res; }, send: (b: unknown) => { payload = b; return res; }, json: (b: unknown) => { payload = b; return res; } };
    await downloadDataKioskDocument({ params: { documentId: docId } } as unknown as Request, res as unknown as Response);
    expect(status).toBe(200);
    expect(ctype).toBe("application/jsonl");
    expect((payload as string).split("\n")).toHaveLength(3);
  });

  it("FATAL query → FATAL with a downloadable JSON error document", async () => {
    const body = await drive(sellerQuery("2023-01-01", "2023-01-02").replace("aggregateBy:DAY", "aggregateBy:DAY FATAL_TEST"));
    expect(body.processingStatus).toBe("FATAL");
    const errId = body.errorDocumentId as string;
    expect(errId).toBeDefined();
    let ctype: string | undefined;
    const res = { setHeader: (k: string, v: string) => { if (k === "Content-Type") ctype = v; }, status: () => res, send: () => res, json: () => res };
    await downloadDataKioskDocument({ params: { documentId: errId } } as unknown as Request, res as unknown as Response);
    expect(ctype).toBe("application/json");
  });

  it("no-data query → DONE with no document ids", async () => {
    const body = await drive(sellerQuery("2099-01-01", "2099-01-03"));
    expect(body.processingStatus).toBe("DONE");
    expect(body.dataDocumentId).toBeUndefined();
    expect(body.errorDocumentId).toBeUndefined();
  });

  it("Vendor-only dataset: rejected in Seller mode, accepted in Vendor mode", async () => {
    const vendorQuery = `{analytics_vendorSales{vendorSalesByDate(startDate:"2023-01-01" endDate:"2023-01-02" marketplaceIds:["ATVPDKIKX0DER"]){shippedRevenue{amount}}}}`;

    // Seller mode (default) → 400.
    delete process.env.MODE;
    const sellerRes = await createQuery(vr({ operationId: "createQuery" }), req({ query: vendorQuery }));
    expect(sellerRes.statusCode).toBe(400);

    // Vendor mode → 202.
    process.env.MODE = "Vendor";
    const vendorRes = await createQuery(vr({ operationId: "createQuery" }), req({ query: vendorQuery }));
    expect(vendorRes.statusCode).toBe(202);
  });
});
