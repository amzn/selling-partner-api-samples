import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

const mockFind = vi.fn<() => Record<string, unknown>[]>().mockReturnValue([]);
const mockPut = vi.fn();

vi.mock("../../src/database/Context.js", () => ({
  Api: { EXT_FULFILLMENT_SHIPMENTS: "extFulfillmentShipments" },
  Context: {
    get instance() {
      return { engine: { find: mockFind, put: mockPut } };
    },
  },
}));

import { getShipmentsHandler } from "../../src/operation/extFulfillmentShipmentsOperations.js";

/**
 * Creates a minimal valid UnifiedValidationPass object for testing.
 */
function makeValidationResult(queryParams: Record<string, string | undefined> = {}): UnifiedValidationPass {
  return {
    pass: true,
    operationId: "getShipments",
    apiName: "External Fulfillment Shipments",
    apiVersion: "2024-09-11",
    pathParams: {},
    queryParams: Object.fromEntries(Object.entries(queryParams).filter(([_, v]) => v !== undefined)),
    body: undefined,
    resolvedEntities: {},
    operation: {},
  };
}

/** Valid shipment status values */
const SHIPMENT_STATUSES = [
  "CREATED",
  "ACCEPTED",
  "CONFIRMED",
  "PACKAGE_CREATED",
  "PICKUP_SLOT_RETRIEVED",
  "INVOICE_GENERATED",
  "SHIPLABEL_GENERATED",
  "CANCELLED",
  "SHIPPED",
  "DELIVERED",
] as const;

/** Alphanumeric string arbitrary (1-20 chars) */
const alphaNumStr = fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/);

/** Arbitrary for a single shipment entity */
const shipmentEntityArb = fc
  .record({
    id: fc.uuid(),
    _key: fc.uuid(),
    status: fc.constantFrom(...SHIPMENT_STATUSES),
    locationId: alphaNumStr,
    marketplaceAttributes: fc.record({
      marketplaceId: alphaNumStr,
      channelName: alphaNumStr,
    }),
    lastUpdatedDateTime: fc.integer({ min: 1577836800000, max: 1893456000000 }).map((ts) => new Date(ts).toISOString()),
  })
  .map((r) => ({ ...r }) as Record<string, unknown>);

/** Arbitrary for a list of 1-20 shipment entities */
const shipmentEntitiesArb = fc.array(shipmentEntityArb, { minLength: 1, maxLength: 20 });

/** Describes an exact-match filter field and how to access its value from an entity */
type FilterField = "status" | "locationId" | "marketplaceId" | "channelName";

const FILTER_FIELDS: FilterField[] = ["status", "locationId", "marketplaceId", "channelName"];

/** Extracts the value for a given filter field from an entity */
function getEntityFieldValue(entity: Record<string, unknown>, field: FilterField): unknown {
  if (field === "marketplaceId") {
    return (entity.marketplaceAttributes as Record<string, unknown> | undefined)?.marketplaceId;
  }
  if (field === "channelName") {
    return (entity.marketplaceAttributes as Record<string, unknown> | undefined)?.channelName;
  }
  return entity[field];
}

describe("Property-Based Tests: External Fulfillment Shipments", () => {
  beforeEach(() => {
    mockFind.mockReturnValue([]);
    mockPut.mockClear();
  });

  /**
   * **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
   *
   * Property 1: Exact-match filter correctness
   * For any set of generated shipment entities and any exact-match filter:
   * - Every record in the response matches the filter value
   * - No matching record from the DB is excluded from unpaginated results
   */
  describe("Property 1: Exact-match filter correctness", () => {
    it("every returned record matches the filter AND no matching record is excluded from unpaginated results", async () => {
      await fc.assert(
        fc.asyncProperty(
          shipmentEntitiesArb,
          fc.constantFrom(...FILTER_FIELDS),
          fc.boolean(),
          fc.nat({ max: 100 }),
          async (entities, filterField, pickFromExisting, randomIdx) => {
            // Determine filter value: either pick from existing entity values or generate random
            let filterValue: string;
            if (pickFromExisting && entities.length > 0) {
              const idx = randomIdx % entities.length;
              filterValue = String(getEntityFieldValue(entities[idx], filterField));
            } else {
              filterValue = `random-value-${randomIdx}`;
            }

            // Mock the DB to return our generated entities
            mockFind.mockReturnValue(entities);

            // Build query params with the filter and a large maxResults to avoid pagination
            const queryParams: Record<string, string | undefined> = { maxResults: "100" };
            queryParams[filterField] = filterValue;

            const validationResult = makeValidationResult(queryParams);
            const result = await getShipmentsHandler(validationResult, {} as never);

            expect(result.statusCode).toBe(200);
            const body = result.data.body as { shipments: Record<string, unknown>[] };

            // Assertion 1: Every returned record matches the filter
            for (const shipment of body.shipments) {
              const actual = getEntityFieldValue(shipment, filterField);
              expect(actual).toBe(filterValue);
            }

            // Assertion 2: No matching record in the DB is excluded
            const expectedMatching = entities.filter((e) => getEntityFieldValue(e, filterField) === filterValue);
            expect(body.shipments.length).toBe(expectedMatching.length);

            // Verify IDs match (order-preserved)
            const returnedIds = body.shipments.map((s) => s.id);
            const expectedIds = expectedMatching.map((e) => e.id);
            expect(returnedIds).toEqual(expectedIds);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 1.6, 1.7, 1.14**
   *
   * Property 2: Date range filter correctness
   * For any set of generated shipment entities (some with lastUpdatedDateTime, some without)
   * and any date boundary (lastUpdatedAfter and/or lastUpdatedBefore):
   * - Every record in results has lastUpdatedDateTime satisfying the boundary
   * - No record without lastUpdatedDateTime appears when date filter is applied
   * - No record satisfying the boundary is missing from results
   */
  describe("Property 2: Date range filter correctness", () => {
    /** Timestamp arbitrary in millis range [2020-01-01, 2030-01-01] mapped to ISO string */
    const timestampArb = fc.integer({ min: 1577836800000, max: 1893456000000 }).map((ts) => new Date(ts).toISOString());

    /** Entity arbitrary with optional lastUpdatedDateTime */
    const dateEntityArb = fc
      .record({
        id: fc.uuid(),
        _key: fc.uuid(),
        status: fc.constantFrom(...SHIPMENT_STATUSES),
        locationId: alphaNumStr,
        marketplaceAttributes: fc.record({
          marketplaceId: alphaNumStr,
          channelName: alphaNumStr,
        }),
        lastUpdatedDateTime: fc.option(timestampArb, { nil: undefined }),
      })
      .map((r) => ({ ...r }) as Record<string, unknown>);

    it("lastUpdatedAfter: every returned record has timestamp strictly greater than boundary, and no qualifying record is missing", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(dateEntityArb, { minLength: 1, maxLength: 20 }),
          timestampArb,
          async (entities, afterBoundary) => {
            mockFind.mockReturnValue(entities);

            const validationResult = makeValidationResult({ maxResults: "100", lastUpdatedAfter: afterBoundary });
            const result = await getShipmentsHandler(validationResult, {} as never);

            expect(result.statusCode).toBe(200);
            const body = result.data.body as { shipments: Record<string, unknown>[] };
            const afterTime = new Date(afterBoundary).getTime();

            // Assertion 1: Every returned record has lastUpdatedDateTime > afterBoundary
            for (const shipment of body.shipments) {
              const ts = shipment.lastUpdatedDateTime as string;
              expect(ts).toBeDefined();
              expect(new Date(ts).getTime()).toBeGreaterThan(afterTime);
            }

            // Assertion 2: No record without lastUpdatedDateTime appears
            for (const shipment of body.shipments) {
              expect(shipment.lastUpdatedDateTime).toBeDefined();
            }

            // Assertion 3: No record satisfying boundary is missing
            const expectedMatching = entities.filter((e) => {
              const lud = e.lastUpdatedDateTime as string | undefined;
              if (!lud) return false;
              return new Date(lud).getTime() > afterTime;
            });
            expect(body.shipments.length).toBe(expectedMatching.length);
            const returnedIds = body.shipments.map((s) => s.id);
            const expectedIds = expectedMatching.map((e) => e.id);
            expect(returnedIds).toEqual(expectedIds);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("lastUpdatedBefore: every returned record has timestamp strictly less than boundary, and no qualifying record is missing", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(dateEntityArb, { minLength: 1, maxLength: 20 }),
          timestampArb,
          async (entities, beforeBoundary) => {
            mockFind.mockReturnValue(entities);

            const validationResult = makeValidationResult({ maxResults: "100", lastUpdatedBefore: beforeBoundary });
            const result = await getShipmentsHandler(validationResult, {} as never);

            expect(result.statusCode).toBe(200);
            const body = result.data.body as { shipments: Record<string, unknown>[] };
            const beforeTime = new Date(beforeBoundary).getTime();

            // Assertion 1: Every returned record has lastUpdatedDateTime < beforeBoundary
            for (const shipment of body.shipments) {
              const ts = shipment.lastUpdatedDateTime as string;
              expect(ts).toBeDefined();
              expect(new Date(ts).getTime()).toBeLessThan(beforeTime);
            }

            // Assertion 2: No record without lastUpdatedDateTime appears
            for (const shipment of body.shipments) {
              expect(shipment.lastUpdatedDateTime).toBeDefined();
            }

            // Assertion 3: No record satisfying boundary is missing
            const expectedMatching = entities.filter((e) => {
              const lud = e.lastUpdatedDateTime as string | undefined;
              if (!lud) return false;
              return new Date(lud).getTime() < beforeTime;
            });
            expect(body.shipments.length).toBe(expectedMatching.length);
            const returnedIds = body.shipments.map((s) => s.id);
            const expectedIds = expectedMatching.map((e) => e.id);
            expect(returnedIds).toEqual(expectedIds);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("combined lastUpdatedAfter + lastUpdatedBefore: only records within the range are returned", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(dateEntityArb, { minLength: 1, maxLength: 20 }),
          timestampArb,
          timestampArb,
          async (entities, ts1, ts2) => {
            // Ensure after < before for a valid range
            const afterBoundary = ts1 < ts2 ? ts1 : ts2;
            const beforeBoundary = ts1 < ts2 ? ts2 : ts1;

            mockFind.mockReturnValue(entities);

            const validationResult = makeValidationResult({
              maxResults: "100",
              lastUpdatedAfter: afterBoundary,
              lastUpdatedBefore: beforeBoundary,
            });
            const result = await getShipmentsHandler(validationResult, {} as never);

            expect(result.statusCode).toBe(200);
            const body = result.data.body as { shipments: Record<string, unknown>[] };
            const afterTime = new Date(afterBoundary).getTime();
            const beforeTime = new Date(beforeBoundary).getTime();

            // Every returned record satisfies both boundaries
            for (const shipment of body.shipments) {
              const ts = shipment.lastUpdatedDateTime as string;
              expect(ts).toBeDefined();
              const recordTime = new Date(ts).getTime();
              expect(recordTime).toBeGreaterThan(afterTime);
              expect(recordTime).toBeLessThan(beforeTime);
            }

            // No qualifying record is missing
            const expectedMatching = entities.filter((e) => {
              const lud = e.lastUpdatedDateTime as string | undefined;
              if (!lud) return false;
              const t = new Date(lud).getTime();
              return t > afterTime && t < beforeTime;
            });
            expect(body.shipments.length).toBe(expectedMatching.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 1.8**
   *
   * Property 3: Filter composition is conjunction
   * For any set of generated entities and any random combination of 2+ filter parameters
   * applied simultaneously, the result set equals the intersection of the result sets
   * produced by applying each filter individually.
   */
  describe("Property 3: Filter composition is conjunction", () => {
    /** All 6 filter types */
    type FilterType = "status" | "locationId" | "marketplaceId" | "channelName" | "lastUpdatedAfter" | "lastUpdatedBefore";
    const ALL_FILTER_TYPES: FilterType[] = ["status", "locationId", "marketplaceId", "channelName", "lastUpdatedAfter", "lastUpdatedBefore"];

    /** Generate a subset of 2-4 filters with values derived from entities */
    const filterSubsetArb = (entities: Record<string, unknown>[]) =>
      fc.subarray([...ALL_FILTER_TYPES], { minLength: 2, maxLength: 4 }).chain((selectedFilters) => {
        const valueArbs = selectedFilters.map((filterType): fc.Arbitrary<string> => {
          if (filterType === "status") {
            return fc.constantFrom(...SHIPMENT_STATUSES);
          } else if (filterType === "locationId") {
            const existing = entities.map((e) => e.locationId as string).filter(Boolean);
            return existing.length > 0 ? fc.constantFrom(...existing) : alphaNumStr;
          } else if (filterType === "marketplaceId") {
            const existing = entities
              .map((e) => (e.marketplaceAttributes as Record<string, unknown> | undefined)?.marketplaceId as string)
              .filter(Boolean);
            return existing.length > 0 ? fc.constantFrom(...existing) : alphaNumStr;
          } else if (filterType === "channelName") {
            const existing = entities
              .map((e) => (e.marketplaceAttributes as Record<string, unknown> | undefined)?.channelName as string)
              .filter(Boolean);
            return existing.length > 0 ? fc.constantFrom(...existing) : alphaNumStr;
          } else {
            // lastUpdatedAfter or lastUpdatedBefore
            const minTs = new Date("2020-01-01T00:00:00.000Z").getTime();
            const maxTs = new Date("2030-01-01T00:00:00.000Z").getTime();
            return fc.integer({ min: minTs, max: maxTs }).map((ts) => new Date(ts).toISOString());
          }
        });

        return fc.tuple(...(valueArbs as [fc.Arbitrary<string>, ...fc.Arbitrary<string>[]])).map((values) => {
          const filters: Record<string, string> = {};
          selectedFilters.forEach((filterType, idx) => {
            filters[filterType] = values[idx];
          });
          return filters;
        });
      });

    it("combined filter result equals intersection of individual filter results", async () => {
      await fc.assert(
        fc.asyncProperty(
          shipmentEntitiesArb.chain((entities) => fc.tuple(fc.constant(entities), filterSubsetArb(entities))),
          async ([entities, filters]) => {
            mockFind.mockReturnValue(entities);

            // Call handler with all filters combined
            const combinedQueryParams: Record<string, string | undefined> = { maxResults: "100", ...filters };
            const combinedResult = await getShipmentsHandler(makeValidationResult(combinedQueryParams), {} as never);
            expect(combinedResult.statusCode).toBe(200);
            const combinedBody = combinedResult.data.body as { shipments: Record<string, unknown>[] };
            const combinedIds = new Set(combinedBody.shipments.map((s) => s.id as string));

            // Call handler with each filter individually and compute intersection
            const filterEntries = Object.entries(filters);
            let intersectionIds: Set<string> | null = null;

            for (const [filterKey, filterValue] of filterEntries) {
              mockFind.mockReturnValue(entities);
              const singleQueryParams: Record<string, string | undefined> = { maxResults: "100", [filterKey]: filterValue };
              const singleResult = await getShipmentsHandler(makeValidationResult(singleQueryParams), {} as never);
              expect(singleResult.statusCode).toBe(200);
              const singleBody = singleResult.data.body as { shipments: Record<string, unknown>[] };
              const singleIds = new Set(singleBody.shipments.map((s) => s.id as string));

              if (intersectionIds === null) {
                intersectionIds = singleIds;
              } else {
                intersectionIds = new Set([...intersectionIds].filter((id: string) => singleIds.has(id)));
              }
            }

            // Assert combined results == intersection of individual results
            const expectedIds = intersectionIds ?? new Set<string>();
            expect(combinedIds.size).toBe(expectedIds.size);
            for (const id of combinedIds) {
              expect(expectedIds.has(id)).toBe(true);
            }
            for (const id of expectedIds) {
              expect(combinedIds.has(id)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 1.9**
   *
   * Property 4: Page size invariant
   * For any random maxResults in [1, 100] and any set of entities in the DB,
   * the number of records returned in the shipments array never exceeds the
   * effective page size. Also verifies that when maxResults is absent, the
   * default page size of 10 is applied.
   */
  describe("Property 4: Page size invariant", () => {
    /** Entity arbitrary using integer-based timestamps to avoid invalid date issues */
    const pageSizeEntityArb = fc
      .record({
        id: fc.uuid(),
        _key: fc.uuid(),
        status: fc.constantFrom(...SHIPMENT_STATUSES),
        locationId: alphaNumStr,
        marketplaceAttributes: fc.record({
          marketplaceId: alphaNumStr,
          channelName: alphaNumStr,
        }),
        lastUpdatedDateTime: fc
          .integer({ min: 1577836800000, max: 1893456000000 }) // 2020-01-01 to 2030-01-01 in millis
          .map((ts) => new Date(ts).toISOString()),
      })
      .map((r) => ({ ...r }) as Record<string, unknown>);

    it("returned shipments count never exceeds the requested maxResults", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(pageSizeEntityArb, { minLength: 0, maxLength: 50 }),
          fc.integer({ min: 1, max: 100 }),
          async (entities, maxResults) => {
            mockFind.mockReturnValue(entities);

            const validationResult = makeValidationResult({ maxResults: String(maxResults) });
            const result = await getShipmentsHandler(validationResult, {} as never);

            expect(result.statusCode).toBe(200);
            const body = result.data.body as { shipments: Record<string, unknown>[] };

            // The number of returned shipments must never exceed the requested page size
            expect(body.shipments.length).toBeLessThanOrEqual(maxResults);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("when maxResults is absent, default page size of 10 is applied", async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(pageSizeEntityArb, { minLength: 0, maxLength: 50 }), async (entities) => {
          mockFind.mockReturnValue(entities);

          // No maxResults param — default page size of 10
          const validationResult = makeValidationResult({});
          const result = await getShipmentsHandler(validationResult, {} as never);

          expect(result.statusCode).toBe(200);
          const body = result.data.body as { shipments: Record<string, unknown>[] };

          // Should never exceed default page size of 10
          expect(body.shipments.length).toBeLessThanOrEqual(10);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 1.10, 1.11**
   *
   * Property 5: Pagination completeness
   * For any set of entities and any page size, iterating all pages by following nextToken
   * until absent yields the complete filtered result set with:
   * 1. No duplicates (each entity ID appears exactly once)
   * 2. No omissions (all entities that should be in the result appear)
   * 3. Correct order preserved across pages
   */
  describe("Property 5: Pagination completeness", () => {
    it("iterating all pages yields the complete result set with no duplicates or omissions, preserving order", async () => {
      // Use a simpler entity arbitrary that avoids date edge cases
      const paginationEntityArb = fc
        .record({
          id: fc.uuid(),
          _key: fc.uuid(),
          status: fc.constantFrom(...SHIPMENT_STATUSES),
          locationId: alphaNumStr,
          marketplaceAttributes: fc.record({
            marketplaceId: alphaNumStr,
            channelName: alphaNumStr,
          }),
          lastUpdatedDateTime: fc.integer({ min: 1577836800000, max: 1893456000000 }).map((ts) => new Date(ts).toISOString()),
        })
        .map((r) => ({ ...r }) as Record<string, unknown>);

      await fc.assert(
        fc.asyncProperty(
          // Generate 5-30 shipment entities
          fc.array(paginationEntityArb, { minLength: 5, maxLength: 30 }),
          // Small page size (1-5) to force multiple pages
          fc.integer({ min: 1, max: 5 }),
          async (entities, pageSize) => {
            // Mock the DB to return our generated entities
            mockFind.mockReturnValue(entities);

            // Collect all shipments across all pages
            const allCollected: Record<string, unknown>[] = [];
            let nextToken: string | undefined = undefined;

            // Safety limit to prevent infinite loops
            const maxPages = Math.ceil(entities.length / pageSize) + 2;
            let pageCount = 0;

            do {
              const queryParams: Record<string, string | undefined> = {
                maxResults: String(pageSize),
                paginationToken: nextToken,
              };

              const validationResult = makeValidationResult(queryParams);
              const result = await getShipmentsHandler(validationResult, {} as never);

              expect(result.statusCode).toBe(200);
              const body = result.data.body as { shipments: Record<string, unknown>[]; pagination?: { nextToken: string } };

              // Each page should not exceed the page size
              expect(body.shipments.length).toBeLessThanOrEqual(pageSize);

              allCollected.push(...body.shipments);
              nextToken = body.pagination?.nextToken;
              pageCount++;

              // Guard against infinite loops
              expect(pageCount).toBeLessThanOrEqual(maxPages);
            } while (nextToken !== undefined);

            // Assertion 1: No duplicates — each entity ID appears exactly once
            const collectedIds = allCollected.map((s) => s.id);
            const uniqueIds = new Set(collectedIds);
            expect(uniqueIds.size).toBe(collectedIds.length);

            // Assertion 2: No omissions — all entities appear in the collected results
            expect(allCollected.length).toBe(entities.length);

            // Assertion 3: Correct order preserved — order matches original entity order
            const expectedIds = entities.map((e) => e.id);
            expect(collectedIds).toEqual(expectedIds);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 1.12**
   *
   * Property 6: Invalid token graceful degradation
   * For any string that is NOT a valid base64-encoded `{ offset: number }` JSON object,
   * or encodes an offset beyond the filtered result set length, the handler returns
   * HTTP 200 with an empty `shipments` array.
   */
  describe("Property 6: Invalid token graceful degradation", () => {
    /** Entity arbitrary using integer-based timestamps to avoid Invalid Date issues */
    const tokenTestEntityArb = fc
      .record({
        id: fc.uuid(),
        _key: fc.uuid(),
        status: fc.constantFrom(...SHIPMENT_STATUSES),
        locationId: alphaNumStr,
        marketplaceAttributes: fc.record({
          marketplaceId: alphaNumStr,
          channelName: alphaNumStr,
        }),
        lastUpdatedDateTime: fc.integer({ min: 1577836800000, max: 1893456000000 }).map((ts) => new Date(ts).toISOString()),
      })
      .map((r) => ({ ...r }) as Record<string, unknown>);

    /** Arbitrary: random strings that are NOT valid base64-encoded { offset: number } JSON */
    const invalidTokenArb = fc.oneof(
      // Random ASCII strings (very unlikely to be valid base64 JSON with offset)
      fc.string({ minLength: 1, maxLength: 50 }),
      // Valid base64 of non-JSON content
      fc.string({ minLength: 1, maxLength: 30 }).map((s) => Buffer.from(s).toString("base64")),
      // Valid base64 of JSON without `offset` field
      fc
        .record({ notOffset: fc.integer(), name: fc.string() })
        .map((obj) => Buffer.from(JSON.stringify(obj)).toString("base64")),
      // Valid base64 of JSON with offset that is not a number
      fc.string({ minLength: 1, maxLength: 10 }).map((s) => Buffer.from(JSON.stringify({ offset: s })).toString("base64")),
      // Valid base64 of JSON with negative offset
      fc.integer({ min: -1000, max: -1 }).map((n) => Buffer.from(JSON.stringify({ offset: n })).toString("base64")),
    );

    it("returns 200 with empty shipments array for any non-valid pagination token", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(tokenTestEntityArb, { minLength: 1, maxLength: 10 }),
          invalidTokenArb,
          async (entities, invalidToken) => {
            mockFind.mockReturnValue(entities);

            const validationResult = makeValidationResult({
              maxResults: "100",
              paginationToken: invalidToken,
            });
            const result = await getShipmentsHandler(validationResult, {} as never);

            expect(result.statusCode).toBe(200);
            const body = result.data.body as { shipments: Record<string, unknown>[] };
            expect(body.shipments).toEqual([]);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("returns 200 with empty shipments array when token offset >= filtered result count", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(tokenTestEntityArb, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 0, max: 1000 }),
          async (entities, extraOffset) => {
            mockFind.mockReturnValue(entities);

            // Create a valid token but with offset >= entities.length
            const outOfRangeOffset = entities.length + extraOffset;
            const outOfRangeToken = Buffer.from(JSON.stringify({ offset: outOfRangeOffset })).toString("base64");

            const validationResult = makeValidationResult({
              maxResults: "100",
              paginationToken: outOfRangeToken,
            });
            const result = await getShipmentsHandler(validationResult, {} as never);

            expect(result.statusCode).toBe(200);
            const body = result.data.body as { shipments: Record<string, unknown>[] };
            expect(body.shipments).toEqual([]);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
