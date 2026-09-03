import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";
import { encodePageToken } from "../../src/service/Paginator.js";

// Mock find function — tests set the return value via mockFind.mockReturnValue(...)
const mockFind = vi.fn<() => Record<string, unknown>[]>().mockReturnValue([]);

// Mock the Context singleton so engine.find returns our controlled data
vi.mock("../../src/database/Context.js", () => ({
  Api: { EXT_FULFILLMENT_RETURNS: "extFulfillmentReturns" },
  Context: {
    get instance() {
      return {
        engine: {
          find: mockFind,
        },
      };
    },
  },
}));

import { listReturnsHandler } from "../../src/operation/extFulfillmentReturnsOperations.js";

/**
 * Creates a minimal valid UnifiedValidationPass object for testing listReturnsHandler.
 */
function makeValidationResult(queryParams: Record<string, string | string[] | undefined> = {}): UnifiedValidationPass {
  return {
    pass: true,
    operationId: "listReturns",
    apiName: "External Fulfillment Returns",
    apiVersion: "2024-09-11",
    pathParams: {},
    queryParams: { ...queryParams },
    body: undefined,
    resolvedEntities: {},
    operation: {},
  };
}

/**
 * Creates a return entity with sensible defaults, allowing overrides.
 */
function makeReturnEntity(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    _key: "ret-001",
    id: "ret-001",
    returnLocationId: "LOC-001",
    merchantSku: "SKU-001",
    returnType: "CUSTOMER",
    status: "CREATED",
    numberOfUnits: 1,
    creationDateTime: "2024-06-15T10:00:00Z",
    lastUpdatedDateTime: "2024-06-20T10:00:00Z",
    returnMetadata: { rmaId: "RMA-001" },
    returnShippingInfo: { reverseTrackingInfo: { carrierName: "UPS", trackingId: "TRACK-001" } },
    ...overrides,
  };
}

describe("listReturnsHandler", () => {
  beforeEach(() => {
    mockFind.mockReturnValue([]);
  });

  describe("property tests", () => {
    // Feature: ext-fulfillment-returns-api, Property 1: Exact-match filter correctness
    // **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
    it("Property 1: Exact-match filter correctness — every returned record matches the filter and all matching records are present", async () => {
      const filterArb = fc.oneof(
        fc.constant("returnLocationId" as const),
        fc.constant("rmaId" as const),
        fc.constant("status" as const),
        fc.constant("reverseTrackingId" as const),
      );

      const valueArb = fc.stringMatching(/^[A-Za-z0-9_-]{1,20}$/);

      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              returnLocationId: valueArb,
              rmaId: valueArb,
              status: valueArb,
              reverseTrackingId: valueArb,
            }),
            { minLength: 1, maxLength: 30 },
          ),
          filterArb,
          fc.nat({ max: 29 }),
          async (entitySpecs, filterName, pickIndex) => {
            const safeIndex = pickIndex % entitySpecs.length;
            const filterValue = entitySpecs[safeIndex][filterName];

            const entities = entitySpecs.map((spec, i) =>
              makeReturnEntity({
                _key: `ret-${i}`,
                id: `ret-${i}`,
                returnLocationId: spec.returnLocationId,
                status: spec.status,
                returnMetadata: { rmaId: spec.rmaId },
                returnShippingInfo: { reverseTrackingInfo: { carrierName: "UPS", trackingId: spec.reverseTrackingId } },
              }),
            );

            mockFind.mockReturnValue(entities);

            const queryParams: Record<string, string> = { maxResults: "100" };
            if (filterName === "returnLocationId") queryParams.returnLocationId = filterValue;
            else if (filterName === "rmaId") queryParams.rmaId = filterValue;
            else if (filterName === "status") queryParams.status = filterValue;
            else if (filterName === "reverseTrackingId") queryParams.reverseTrackingId = filterValue;

            const result = await listReturnsHandler(makeValidationResult(queryParams), {} as any);
            const body = result.data.body as Record<string, unknown>;
            const returns = body.returns as Record<string, unknown>[];

            // Compute expected matches
            const expectedMatches = entities.filter((e) => {
              if (filterName === "returnLocationId") return e.returnLocationId === filterValue;
              if (filterName === "rmaId") return (e.returnMetadata as any)?.rmaId === filterValue;
              if (filterName === "status") return e.status === filterValue;
              if (filterName === "reverseTrackingId") return (e.returnShippingInfo as any)?.reverseTrackingInfo?.trackingId === filterValue;
              return false;
            });

            // Every returned record matches the filter
            for (const ret of returns) {
              if (filterName === "returnLocationId") expect(ret.returnLocationId).toBe(filterValue);
              else if (filterName === "rmaId") expect((ret.returnMetadata as any)?.rmaId).toBe(filterValue);
              else if (filterName === "status") expect(ret.status).toBe(filterValue);
              else if (filterName === "reverseTrackingId")
                expect((ret.returnShippingInfo as any)?.reverseTrackingInfo?.trackingId).toBe(filterValue);
            }

            // All matching records are present
            expect(returns).toHaveLength(expectedMatches.length);
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: ext-fulfillment-returns-api, Property 2: Date range filter correctness
    // **Validates: Requirements 1.6, 1.7, 1.8, 1.9**
    it("Property 2: Date range filter correctness — every returned record satisfies the date boundary condition", async () => {
      const dateFilterArb = fc.oneof(
        fc.constant("createdSince" as const),
        fc.constant("createdUntil" as const),
        fc.constant("lastUpdatedSince" as const),
        fc.constant("lastUpdatedUntil" as const),
      );

      const timestampArb = fc.integer({ min: 1672531200000, max: 1767225600000 }).map((ms) => new Date(ms).toISOString());

      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              creationDateTime: timestampArb,
              lastUpdatedDateTime: timestampArb,
            }),
            { minLength: 1, maxLength: 20 },
          ),
          dateFilterArb,
          timestampArb,
          async (entitySpecs, filterName, filterValue) => {
            const entities = entitySpecs.map((spec, i) =>
              makeReturnEntity({
                _key: `ret-${i}`,
                id: `ret-${i}`,
                creationDateTime: spec.creationDateTime,
                lastUpdatedDateTime: spec.lastUpdatedDateTime,
              }),
            );

            mockFind.mockReturnValue(entities);

            const queryParams: Record<string, string> = { maxResults: "100" };
            queryParams[filterName] = filterValue;

            const result = await listReturnsHandler(makeValidationResult(queryParams), {} as any);
            const body = result.data.body as Record<string, unknown>;
            const returns = body.returns as Record<string, unknown>[];

            const boundary = new Date(filterValue).getTime();

            for (const ret of returns) {
              if (filterName === "createdSince") {
                expect(new Date(ret.creationDateTime as string).getTime()).toBeGreaterThanOrEqual(boundary);
              } else if (filterName === "createdUntil") {
                expect(new Date(ret.creationDateTime as string).getTime()).toBeLessThanOrEqual(boundary);
              } else if (filterName === "lastUpdatedSince") {
                expect(new Date(ret.lastUpdatedDateTime as string).getTime()).toBeGreaterThanOrEqual(boundary);
              } else if (filterName === "lastUpdatedUntil") {
                expect(new Date(ret.lastUpdatedDateTime as string).getTime()).toBeLessThanOrEqual(boundary);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: ext-fulfillment-returns-api, Property 3: Filter composition is conjunction
    // **Validates: Requirements 1.10**
    it("Property 3: Filter composition is conjunction — combining two filters equals the intersection of each applied individually", async () => {
      const valueArb = fc.stringMatching(/^[A-Za-z0-9_-]{1,10}$/);

      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              returnLocationId: valueArb,
              status: valueArb,
            }),
            { minLength: 1, maxLength: 20 },
          ),
          valueArb,
          valueArb,
          async (entitySpecs, filterLoc, filterStatus) => {
            const entities = entitySpecs.map((spec, i) =>
              makeReturnEntity({
                _key: `ret-${i}`,
                id: `ret-${i}`,
                returnLocationId: spec.returnLocationId,
                status: spec.status,
              }),
            );

            mockFind.mockReturnValue(entities);

            // Apply filter A alone (returnLocationId)
            const resultA = await listReturnsHandler(
              makeValidationResult({ returnLocationId: filterLoc, maxResults: "100" }),
              {} as any,
            );
            const returnsA = (resultA.data.body as any).returns as Record<string, unknown>[];

            // Apply filter B alone (status)
            const resultB = await listReturnsHandler(makeValidationResult({ status: filterStatus, maxResults: "100" }), {} as any);
            const returnsB = (resultB.data.body as any).returns as Record<string, unknown>[];

            // Apply both filters together
            const resultBoth = await listReturnsHandler(
              makeValidationResult({ returnLocationId: filterLoc, status: filterStatus, maxResults: "100" }),
              {} as any,
            );
            const returnsBoth = (resultBoth.data.body as any).returns as Record<string, unknown>[];

            // Compute intersection of A and B by id
            const idsA = new Set(returnsA.map((r) => r.id));
            const idsB = new Set(returnsB.map((r) => r.id));
            const intersection = [...idsA].filter((id) => idsB.has(id)).sort();

            const idsBoth = returnsBoth.map((r) => r.id as string).sort();

            expect(idsBoth).toEqual(intersection);
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: ext-fulfillment-returns-api, Property 4: Page size invariant
    // **Validates: Requirements 1.11**
    it("Property 4: Page size invariant — response never contains more items than maxResults", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 50 }),
          async (maxResults, entityCount) => {
            const entities = Array.from({ length: entityCount }, (_, i) =>
              makeReturnEntity({ _key: `ret-${i}`, id: `ret-${i}` }),
            );

            mockFind.mockReturnValue(entities);

            const result = await listReturnsHandler(makeValidationResult({ maxResults: String(maxResults) }), {} as any);
            const body = result.data.body as Record<string, unknown>;
            const returns = body.returns as Record<string, unknown>[];

            expect(returns.length).toBeLessThanOrEqual(maxResults);
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: ext-fulfillment-returns-api, Property 5: Pagination completeness
    // **Validates: Requirements 1.12, 1.13**
    it("Property 5: Pagination completeness — iterating all pages produces the full filtered set with no duplicates/omissions", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 80 }),
          fc.integer({ min: 1, max: 20 }),
          async (entityCount, pageSize) => {
            const entities = Array.from({ length: entityCount }, (_, i) =>
              makeReturnEntity({ _key: `ret-${i}`, id: `ret-${i}`, returnLocationId: `LOC-${i}` }),
            );

            mockFind.mockReturnValue(entities);

            const allCollected: Record<string, unknown>[] = [];
            let nextToken: string | undefined = undefined;
            const maxPages = Math.ceil(entityCount / pageSize) + 2;

            for (let page = 0; page < maxPages; page++) {
              const qp: Record<string, string | undefined> = { maxResults: String(pageSize) };
              if (nextToken) qp.nextToken = nextToken;

              const result = await listReturnsHandler(makeValidationResult(qp), {} as any);
              const body = result.data.body as Record<string, unknown>;
              const returns = body.returns as Record<string, unknown>[];

              allCollected.push(...returns);

              if (body.nextToken) {
                nextToken = body.nextToken as string;
              } else {
                break;
              }
            }

            // No duplicates
            const ids = allCollected.map((r) => r.id as string);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);

            // All entities present
            expect(allCollected).toHaveLength(entityCount);
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: ext-fulfillment-returns-api, Property 6: Invalid token graceful degradation
    // **Validates: Requirements 1.15**
    it("Property 6: Invalid token graceful degradation — invalid tokens produce 200 with empty returns", async () => {
      // Generate strings that are definitively NOT valid base64 { offset } tokens
      const invalidTokenArb = fc.oneof(
        // Strings with characters invalid in base64
        fc.stringMatching(/^[!@#$%^&*()]{1,20}$/),
        // Valid base64 but not valid JSON
        fc.constant(Buffer.from("not-json-content").toString("base64")),
        // Valid base64 + JSON but missing "offset" key
        fc.constant(Buffer.from(JSON.stringify({ wrongKey: 5 })).toString("base64")),
        // Valid base64 + JSON with negative offset (rejected by decodePageToken)
        fc.constant(Buffer.from(JSON.stringify({ offset: -1 })).toString("base64")),
        // Valid base64 + JSON with non-number offset
        fc.constant(Buffer.from(JSON.stringify({ offset: "abc" })).toString("base64")),
        // Valid token but offset beyond result set size (out-of-range)
        fc.constant(encodePageToken(9999)),
      );

      await fc.assert(
        fc.asyncProperty(invalidTokenArb, async (invalidToken) => {
          // Put some entities in the DB so we can verify they aren't returned
          mockFind.mockReturnValue([makeReturnEntity({ _key: "ret-0", id: "ret-0" })]);

          const result = await listReturnsHandler(makeValidationResult({ nextToken: invalidToken }), {} as any);

          expect(result.statusCode).toBe(200);
          const body = result.data.body as Record<string, unknown>;
          const returns = body.returns as Record<string, unknown>[];
          expect(returns).toEqual([]);
        }),
        { numRuns: 100 },
      );
    });
  });
});
