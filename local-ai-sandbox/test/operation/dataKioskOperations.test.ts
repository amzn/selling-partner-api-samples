import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import type { Request } from "express";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

// --- Stateful in-memory mock of the DATA_KIOSK namespace ---
const store = new Map<string, Record<string, unknown>>();

const mockPut = vi.fn((_api: string, key: string, value: Record<string, unknown>) => {
  store.set(key, { ...value, _key: key });
});
const mockGet = vi.fn((_api: string, key: string) => store.get(key) ?? null);
const mockGetCollection = vi.fn((_api: string) => ({ find: () => [...store.values()] }));

vi.mock("../../src/database/Context.js", () => ({
  Api: { DATA_KIOSK: "dataKiosk" },
  Context: {
    get instance() {
      return { engine: { put: mockPut, get: mockGet, getCollection: mockGetCollection } };
    },
  },
}));

// Stub index.js so importing spapiController does not execute the app's top-level route setup.
vi.mock("../../src/index.js", () => ({
  asyncLocalStorage: { run: async (_s: unknown, f: () => unknown) => f() },
}));

import {
  createQueryHandler,
  getQueryHandler,
  getQueriesHandler,
  cancelQueryHandler,
  getDocumentHandler,
} from "../../src/operation/dataKioskOperations.js";
import { downloadDataKioskDocument } from "../../src/controller/spapiController.js";
import { OPERATIONS_REGISTRY } from "../../src/registry/operationRegistry.js";
import { parseGraphQLQuery, normalizedLength } from "../../src/operation/dataKioskQueryParser.js";
import { DATASETS, classifyOutcome, datesInRange, MAX_GENERATED_ROWS } from "../../src/operation/dataKioskDatasets.js";

// --- Helpers ---

const DATASET = "analytics_salesAndTraffic_2024_04_24";

/** A valid Seller sales-and-traffic query for a given date range. */
function sellerQuery(startDate = "2023-01-01", endDate = "2023-01-03", field = "salesAndTrafficByDate"): string {
  return `{${DATASET}{${field}(startDate:"${startDate}" endDate:"${endDate}" aggregateBy:DAY marketplaceIds:["ATVPDKIKX0DER"]){sales{orderedProductSales{amount currencyCode}}}}}`;
}

function makeVR(overrides: Partial<UnifiedValidationPass> = {}): UnifiedValidationPass {
  return {
    pass: true,
    operationId: "createQuery",
    apiName: "Data Kiosk",
    apiVersion: "2023-11-15",
    pathParams: {},
    queryParams: {},
    body: undefined,
    resolvedEntities: {},
    operation: {},
    ...overrides,
  };
}

function makeRequest(opts: { body?: Record<string, unknown>; host?: string } = {}): Request {
  return {
    body: opts.body,
    get: (_h: string) => opts.host ?? "localhost:9001",
  } as unknown as Request;
}

function seedQuery(rec: Record<string, unknown>): Record<string, unknown> {
  const full = { _key: rec.queryId as string, ...rec };
  store.set(rec.queryId as string, full);
  return full;
}

/** Submits a query and polls getQuery until terminal (or maxPolls), returning the final stripped body. */
async function submitAndDrain(query: string, maxPolls = 5): Promise<Record<string, unknown>> {
  const created = await createQueryHandler(makeVR({ operationId: "createQuery" }), makeRequest({ body: { query } }));
  expect(created.statusCode).toBe(202);
  const queryId = (created.data.body as Record<string, unknown>).queryId as string;
  let body: Record<string, unknown> = {};
  for (let i = 0; i < maxPolls; i++) {
    const stored = store.get(queryId)!;
    const res = await getQueryHandler(makeVR({ operationId: "getQuery", pathParams: { queryId }, resolvedEntities: { query: stored } }), makeRequest());
    body = res.data.body as Record<string, unknown>;
    if (body.processingStatus === "DONE" || body.processingStatus === "FATAL" || body.processingStatus === "CANCELLED") break;
  }
  return body;
}

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

// --- createQuery (Level B) ---

describe("createQueryHandler (Level B)", () => {
  it("returns 202 with only { queryId } and persists an IN_QUEUE Query_Record (no document yet)", async () => {
    const result = await createQueryHandler(makeVR(), makeRequest({ body: { query: sellerQuery() } }));

    expect(result.statusCode).toBe(202);
    expect(Object.keys(result.data.body as Record<string, unknown>)).toEqual(["queryId"]);
    const queryId = (result.data.body as Record<string, unknown>).queryId as string;
    expect(queryId).toMatch(/^DK-[0-9A-F]{8}$/);

    const stored = store.get(queryId)!;
    expect(stored.processingStatus).toBe("IN_QUEUE");
    expect(stored.recordType).toBe("query");
    expect(stored.pollCount).toBe(0);
    expect(stored.dataDocumentId).toBeUndefined();
    expect(stored.outcome).toBe("DATA");
  });

  it("persists paginationToken when provided and still returns only { queryId }", async () => {
    const result = await createQueryHandler(makeVR(), makeRequest({ body: { query: sellerQuery(), paginationToken: "TOKEN-1" } }));
    expect(Object.keys(result.data.body as Record<string, unknown>)).toEqual(["queryId"]);
    expect(store.get((result.data.body as Record<string, unknown>).queryId as string)!.paginationToken).toBe("TOKEN-1");
  });

  it("rejects an unparseable query with 400 InvalidInput and stores nothing", async () => {
    const result = await createQueryHandler(makeVR(), makeRequest({ body: { query: "not a graphql query" } }));
    expect(result.statusCode).toBe(400);
    expect((result.data.body as { errors: { code: string }[] }).errors[0].code).toBe("InvalidInput");
    expect(store.size).toBe(0);
  });

  it("rejects an unknown dataset with 400 InvalidInput", async () => {
    const result = await createQueryHandler(makeVR(), makeRequest({ body: { query: "{unknown_dataset{foo(startDate:\"2023-01-01\"){bar}}}" } }));
    expect(result.statusCode).toBe(400);
    expect(store.size).toBe(0);
  });
});

// --- getQuery lifecycle (Level B) ---

describe("getQueryHandler lifecycle (Level B)", () => {
  it("advances IN_QUEUE -> IN_PROGRESS -> DONE across polls and materializes a data document", async () => {
    const created = await createQueryHandler(makeVR(), makeRequest({ body: { query: sellerQuery("2023-01-01", "2023-01-02") } }));
    const queryId = (created.data.body as Record<string, unknown>).queryId as string;

    const poll = async () =>
      (await getQueryHandler(makeVR({ operationId: "getQuery", pathParams: { queryId }, resolvedEntities: { query: store.get(queryId)! } }), makeRequest())).data.body as Record<string, unknown>;

    expect((await poll()).processingStatus).toBe("IN_PROGRESS");
    const done = await poll();
    expect(done.processingStatus).toBe("DONE");
    expect(done.dataDocumentId).toBeDefined();
    expect(done.processingStartTime).toBeDefined();
    expect(done.processingEndTime).toBeDefined();

    // Document exists with two JSONL lines (2 days).
    const doc = store.get(done.dataDocumentId as string)!;
    expect((doc.content as string).split("\n")).toHaveLength(2);
    expect(doc.contentType).toBe("application/jsonl");
  });

  it("does not include internal fields (_key, pollCount, parsed, outcome, content) in the response", async () => {
    const body = await submitAndDrain(sellerQuery("2023-01-01", "2023-01-01"));
    for (const k of ["_key", "pollCount", "parsed", "outcome", "content", "contentType"]) {
      expect(body).not.toHaveProperty(k);
    }
  });

  it("FATAL query drains to FATAL with an errorDocumentId (JSON error document)", async () => {
    const body = await submitAndDrain(sellerQuery("2023-01-01", "2023-01-02").replace("aggregateBy:DAY", "aggregateBy:DAY FATAL_TEST"));
    expect(body.processingStatus).toBe("FATAL");
    expect(body.errorDocumentId).toBeDefined();
    expect(body.dataDocumentId).toBeUndefined();
    const errDoc = store.get(body.errorDocumentId as string)!;
    expect(errDoc.contentType).toBe("application/json");
    expect(() => JSON.parse(errDoc.content as string)).not.toThrow();
  });

  it("no-data query (future/empty range) drains to DONE with neither document", async () => {
    // Range entirely after the reference date -> NO_DATA.
    const body = await submitAndDrain(sellerQuery("2099-01-01", "2099-01-03"));
    expect(body.processingStatus).toBe("DONE");
    expect(body.dataDocumentId).toBeUndefined();
    expect(body.errorDocumentId).toBeUndefined();
  });

  it("returns a terminal (seeded) record unchanged and does not advance pollCount", async () => {
    const rec = seedQuery({ queryId: "DK-TERM", query: "{x}", processingStatus: "DONE", createdTime: "2024-01-01T00:00:00Z", pollCount: 9, outcome: "DATA", dataDocumentId: "DKDOC-Z" });
    const res = await getQueryHandler(makeVR({ operationId: "getQuery", pathParams: { queryId: "DK-TERM" }, resolvedEntities: { query: rec } }), makeRequest());
    expect((res.data.body as Record<string, unknown>).processingStatus).toBe("DONE");
    expect(store.get("DK-TERM")!.pollCount).toBe(9); // unchanged
  });
});

// --- getQueries (unchanged filters; does not advance pollCount) ---

describe("getQueriesHandler (Level B)", () => {
  function seedMany(): void {
    seedQuery({ queryId: "DK-1", query: "{a}", processingStatus: "IN_QUEUE", createdTime: "2024-01-01T00:00:00Z", pollCount: 0, outcome: "DATA" });
    seedQuery({ queryId: "DK-2", query: "{b}", processingStatus: "IN_PROGRESS", createdTime: "2024-02-01T00:00:00Z", pollCount: 1, outcome: "DATA" });
    seedQuery({ queryId: "DK-3", query: "{c}", processingStatus: "DONE", createdTime: "2024-03-01T00:00:00Z", pollCount: 2, outcome: "DATA" });
    store.set("DKDOC-x", { _key: "DKDOC-x", documentId: "DKDOC-x", content: "line", contentType: "application/jsonl" });
  }

  it("filters by processingStatuses, excludes Document_Records, and strips internal fields", async () => {
    seedMany();
    const result = await getQueriesHandler(makeVR({ operationId: "getQueries", queryParams: { processingStatuses: "IN_QUEUE,DONE" } }), makeRequest());
    const queries = (result.data.body as Record<string, unknown>).queries as Record<string, unknown>[];
    expect(new Set(queries.map((q) => q.processingStatus))).toEqual(new Set(["IN_QUEUE", "DONE"]));
    expect(queries.every((q) => q.content === undefined && q.pollCount === undefined && q.outcome === undefined && q._key === undefined)).toBe(true);
  });

  it("does not advance pollCount", async () => {
    seedMany();
    await getQueriesHandler(makeVR({ operationId: "getQueries", queryParams: {} }), makeRequest());
    expect(store.get("DK-1")!.pollCount).toBe(0);
    expect(store.get("DK-2")!.pollCount).toBe(1);
  });

  it("ignores a malformed createdSince (NaN guard) instead of dropping every record", async () => {
    seedMany();
    const result = await getQueriesHandler(makeVR({ operationId: "getQueries", queryParams: { createdSince: "not-a-date" } }), makeRequest());
    const queries = (result.data.body as Record<string, unknown>).queries as Record<string, unknown>[];
    // All three seeded Query_Records are returned; the bad filter is skipped.
    expect(queries).toHaveLength(3);
  });

  it("paginates via the shared Paginator (default 10 + nextToken)", async () => {
    for (let i = 0; i < 12; i++) {
      seedQuery({ queryId: `DK-${String(i).padStart(2, "0")}`, query: "{x}", processingStatus: "DONE", createdTime: `2024-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`, pollCount: 2, outcome: "DATA" });
    }
    const result = await getQueriesHandler(makeVR({ operationId: "getQueries", queryParams: {} }), makeRequest());
    const body = result.data.body as Record<string, unknown>;
    expect((body.queries as unknown[]).length).toBe(10);
    expect((body.pagination as Record<string, unknown>).nextToken).toBeDefined();
  });
});

// --- cancelQuery (unchanged from Level A) ---

describe("cancelQueryHandler", () => {
  it("transitions IN_QUEUE to CANCELLED and returns 204", async () => {
    const query = seedQuery({ queryId: "DK-Q", query: "{x}", processingStatus: "IN_QUEUE", createdTime: "2024-01-01T00:00:00Z", pollCount: 0, outcome: "DATA" });
    const result = await cancelQueryHandler(makeVR({ operationId: "cancelQuery", pathParams: { queryId: "DK-Q" }, resolvedEntities: { query } }), makeRequest());
    expect(result.statusCode).toBe(204);
    expect(store.get("DK-Q")!.processingStatus).toBe("CANCELLED");
  });

  it("no-ops when already CANCELLED and returns 204", async () => {
    const query = seedQuery({ queryId: "DK-C", query: "{x}", processingStatus: "CANCELLED", createdTime: "2024-01-01T00:00:00Z", pollCount: 0, outcome: "DATA" });
    const result = await cancelQueryHandler(makeVR({ operationId: "cancelQuery", pathParams: { queryId: "DK-C" }, resolvedEntities: { query } }), makeRequest());
    expect(result.statusCode).toBe(204);
    expect(mockPut).not.toHaveBeenCalled();
  });
});

describe("getDocumentHandler", () => {
  it("returns a documentUrl targeting the download route", async () => {
    const result = await getDocumentHandler(makeVR({ operationId: "getDocument", pathParams: { documentId: "DKDOC-999" } }), makeRequest({ host: "example.test:1234" }));
    expect((result.data.body as Record<string, unknown>).documentUrl).toBe("http://example.test:1234/dataKiosk/download/DKDOC-999");
  });
});

describe("registry registration", () => {
  it("registers all five Data Kiosk handlers", () => {
    for (const op of ["createQuery", "getQueries", "getQuery", "cancelQuery", "getDocument"]) {
      expect(typeof OPERATIONS_REGISTRY.get(`Data Kiosk:2023-11-15:${op}`)).toBe("function");
    }
  });
});

// --- Parser (B1) ---

describe("parseGraphQLQuery", () => {
  it("extracts dataset, field, dates, aggregateBy, marketplaceIds", () => {
    const p = parseGraphQLQuery(sellerQuery("2023-01-01", "2023-01-31"))!;
    expect(p.dataset).toBe(DATASET);
    expect(p.queryField).toBe("salesAndTrafficByDate");
    expect(p.startDate).toBe("2023-01-01");
    expect(p.endDate).toBe("2023-01-31");
    expect(p.aggregateBy).toBe("DAY");
    expect(p.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
  });

  it("returns null when there is no top-level dataset selection", () => {
    expect(parseGraphQLQuery("")).toBeNull();
    expect(parseGraphQLQuery("no braces here")).toBeNull();
  });

  // Feature: data-kiosk, Property 11: Parser Field Extraction Round-Trip
  // **Validates: Requirements 9.5**
  it("Property 11: round-trips dataset/field/date range/marketplaces", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("salesAndTrafficByDate", "salesAndTrafficByAsin"),
        fc.integer({ min: 1_577_836_800_000, max: 1_735_603_200_000 }).map((ms) => new Date(ms).toISOString().slice(0, 10)),
        fc.integer({ min: 1_577_836_800_000, max: 1_735_603_200_000 }).map((ms) => new Date(ms).toISOString().slice(0, 10)),
        fc.uniqueArray(fc.stringMatching(/^[A-Z0-9]{10,14}$/), { minLength: 1, maxLength: 3 }),
        (field, startDate, endDate, marketplaceIds) => {
          const q = `{${DATASET}{${field}(startDate:"${startDate}" endDate:"${endDate}" aggregateBy:DAY marketplaceIds:[${marketplaceIds.map((m) => `"${m}"`).join(",")}]){x}}}`;
          const p = parseGraphQLQuery(q)!;
          expect(p.dataset).toBe(DATASET);
          expect(p.queryField).toBe(field);
          expect(p.startDate).toBe(startDate);
          expect(p.endDate).toBe(endDate);
          expect(p.marketplaceIds).toEqual(marketplaceIds);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("normalizedLength collapses whitespace", () => {
    expect(normalizedLength("  a   b\t\nc  ")).toBe(5); // "a b c"
  });
});

// --- Dataset registry (B2) ---

describe("dataset registry", () => {
  it("every dataset sample is valid JSONL (each line parses)", () => {
    for (const def of Object.values(DATASETS)) {
      for (const line of def.sample.split("\n")) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    }
  });

  it("salesAndTrafficByDate generates one line per day in range", () => {
    const p = parseGraphQLQuery(sellerQuery("2023-01-01", "2023-01-05"))!;
    const jsonl = DATASETS[DATASET].generate(p);
    expect(jsonl.split("\n")).toHaveLength(datesInRange("2023-01-01", "2023-01-05").length);
    expect(datesInRange("2023-01-01", "2023-01-05")).toHaveLength(5);
  });

  it("classifyOutcome: DATA for a valid range, NO_DATA for future range, FATAL for the marker", () => {
    expect(classifyOutcome(parseGraphQLQuery(sellerQuery("2023-01-01", "2023-01-02"))!)).toBe("DATA");
    expect(classifyOutcome(parseGraphQLQuery(sellerQuery("2099-01-01", "2099-01-02"))!)).toBe("NO_DATA");
    expect(classifyOutcome(parseGraphQLQuery(sellerQuery().replace("aggregateBy:DAY", "aggregateBy:DAY FATAL_TEST"))!)).toBe("FATAL");
  });

  it("the vendor dataset is Vendor-only", () => {
    expect(DATASETS.analytics_vendorSales.supportedModes).toEqual(["Vendor"]);
  });

  it("honors aggregateBy WEEK/MONTH by emitting one row per period, not per day", () => {
    // 2023-01-01 (Sun) .. 2023-01-15 spans 3 ISO weeks (Mon-based) and 1 month.
    const byWeek = parseGraphQLQuery(sellerQuery("2023-01-01", "2023-01-15").replace("aggregateBy:DAY", "aggregateBy:WEEK"))!;
    const byMonth = parseGraphQLQuery(sellerQuery("2023-01-01", "2023-01-15").replace("aggregateBy:DAY", "aggregateBy:MONTH"))!;
    expect(byWeek.aggregateBy).toBe("WEEK");
    // 15 days -> weeks starting Dec-26, Jan-02, Jan-09 = 3 buckets.
    expect(DATASETS[DATASET].generate(byWeek).split("\n")).toHaveLength(3);
    // All 15 days fall in 2023-01 -> a single monthly bucket.
    const monthRows = DATASETS[DATASET].generate(byMonth).split("\n");
    expect(monthRows).toHaveLength(1);
    // The monthly bucket spans the full in-range window.
    const row = JSON.parse(monthRows[0]) as { startDate: string; endDate: string };
    expect(row.startDate).toBe("2023-01-01");
    expect(row.endDate).toBe("2023-01-15");
  });

  it("caps generated rows at MAX_GENERATED_ROWS for a very wide range", () => {
    // A multi-year daily range would exceed the cap; datesInRange truncates it.
    expect(datesInRange("2020-01-01", "2024-01-31").length).toBe(MAX_GENERATED_ROWS);
  });

  it("salesAndTrafficByAsin emits the reference-capped window, never a future endDate", () => {
    // Start is valid, end is beyond DATASET_REFERENCE_DATE (2024-01-31).
    const p = parseGraphQLQuery(sellerQuery("2024-01-01", "2099-12-31", "salesAndTrafficByAsin"))!;
    const rows = DATASETS[DATASET].generate(p).split("\n").map((l) => JSON.parse(l) as { startDate: string; endDate: string });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.startDate).toBe("2024-01-01");
      // Capped at the reference date, not the raw future endDate.
      expect(row.endDate).toBe("2024-01-31");
    }
  });
});

// --- Properties ---

// Feature: data-kiosk, Property 8: Lifecycle Monotonic Progression
// **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
describe("Property 8: Lifecycle Monotonic Progression", () => {
  const RANK: Record<string, number> = { IN_QUEUE: 0, IN_PROGRESS: 1, DONE: 2, FATAL: 2 };
  it("status never regresses and reaches terminal within threshold+1 polls", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (days) => {
        store.clear();
        const created = await createQueryHandler(makeVR(), makeRequest({ body: { query: sellerQuery("2023-01-01", `2023-01-${String(days).padStart(2, "0")}`) } }));
        const queryId = (created.data.body as Record<string, unknown>).queryId as string;
        let prev = 0;
        let terminalAt = -1;
        for (let i = 1; i <= 4; i++) {
          const res = await getQueryHandler(makeVR({ operationId: "getQuery", pathParams: { queryId }, resolvedEntities: { query: store.get(queryId)! } }), makeRequest());
          const status = (res.data.body as Record<string, unknown>).processingStatus as string;
          expect(RANK[status]).toBeGreaterThanOrEqual(prev);
          prev = RANK[status];
          if ((status === "DONE" || status === "FATAL") && terminalAt < 0) terminalAt = i;
        }
        expect(terminalAt).toBeGreaterThan(0);
        expect(terminalAt).toBeLessThanOrEqual(3); // LIFECYCLE_THRESHOLD (2) + 1
      }),
      { numRuns: 50 },
    );
  });
});

// Feature: data-kiosk, Property 9: Outcome Determinism
// **Validates: Requirements 10.2, 10.5**
describe("Property 9: Outcome Determinism", () => {
  it("same query yields identical generated content across fresh submissions", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1_672_531_200_000, max: 1_688_083_200_000 }).map((ms) => new Date(ms).toISOString().slice(0, 10)),
        async (startDate) => {
          const q = sellerQuery(startDate, startDate);
          const drain = async (): Promise<string> => {
            store.clear();
            const body = await submitAndDrain(q);
            const docId = body.dataDocumentId as string | undefined;
            return docId ? (store.get(docId)!.content as string) : "";
          };
          expect(await drain()).toBe(await drain());
        },
      ),
      { numRuns: 50 },
    );
  });
});

// Feature: data-kiosk, Property 13: Date-Range Row Count
// **Validates: Requirements 10.1, 11.3**
describe("Property 13: Date-Range Row Count (salesAndTrafficByDate)", () => {
  it("generated JSONL has exactly one line per calendar day in the inclusive range", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 60 }), (offsetDays) => {
        const start = new Date(Date.parse("2023-03-01T00:00:00Z") + offsetDays * 86400000).toISOString().slice(0, 10);
        const end = new Date(Date.parse("2023-03-01T00:00:00Z") + (offsetDays + 3) * 86400000).toISOString().slice(0, 10);
        const p = parseGraphQLQuery(sellerQuery(start, end))!;
        expect(DATASETS[DATASET].generate(p).split("\n")).toHaveLength(datesInRange(start, end).length);
      }),
      { numRuns: 50 },
    );
  });
});

// Feature: data-kiosk, Property 7 (Level A, retained): Document Content-Type Fidelity
// **Validates: Requirements 5.3**
describe("Property 7: Document Content-Type Fidelity", () => {
  it("the download route responds with the stored contentType and byte-identical content", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 0, maxLength: 500 }), fc.constantFrom("application/jsonl", "application/json"), async (content, contentType) => {
        store.clear();
        store.set("DKDOC-P7", { _key: "DKDOC-P7", documentId: "DKDOC-P7", content, contentType });
        let sentStatus = 0;
        let sentBody: unknown;
        let sentContentType: string | undefined;
        const res = {
          setHeader: (k: string, v: string) => {
            if (k === "Content-Type") sentContentType = v;
          },
          status: (c: number) => {
            sentStatus = c;
            return res;
          },
          send: (b: unknown) => {
            sentBody = b;
            return res;
          },
          json: (b: unknown) => {
            sentBody = b;
            return res;
          },
        };
        await downloadDataKioskDocument({ params: { documentId: "DKDOC-P7" } } as any, res as any);
        expect(sentStatus).toBe(200);
        expect(sentContentType).toBe(contentType);
        expect(sentBody).toBe(content);
      }),
      { numRuns: 100 },
    );
  });
});
