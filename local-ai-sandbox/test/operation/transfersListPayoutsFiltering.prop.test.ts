import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { listPayoutsHandler, type PayoutRecord } from "../../src/operation/transfersOperations.js";
import { Context, Api } from "../../src/database/Context.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

/**
 * Property 4: listPayouts AND-composed filtering.
 *
 * Validates Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.10.
 *
 * For any set of Payout_Record documents and any combination of the supported
 * filters (marketplaceIds, accountType, payoutId, createdAfter, createdBefore),
 * listPayouts returns exactly the records satisfying every supplied filter
 * simultaneously (AND composition). A record failing any one supplied condition is
 * excluded; a record satisfying all supplied conditions is included. listPayouts
 * has no page-size query parameter and paginates in fixed pages, so the test seeds
 * <=100 records and follows nextToken through every page to collect all matches,
 * then compares the collected id-set against an independently-computed expected set.
 */

// A small, fixed pool so filter values collide with seeded records often enough
// for AND composition to actually prune.
const MARKETPLACE_POOL = ["A1PA6795UKMFR9", "A13V1IB3VIYZZH", "APJ6JRA9NG5V4", "A1RKKUPIHCS9HS"];
const ACCOUNT_TYPE_POOL = ["Standard Orders", "Early Reviewer Program", "B2B"];

// A bounded instant pool (ms) so createdAfter/createdBefore bounds land near
// record creationDates rather than always outside the data.
const BASE_MS = Date.parse("2024-01-01T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

/** A single generated payout record's raw fields. */
interface SeedSpec {
  id: string;
  marketplaceId: string;
  accountType: string;
  creationMs: number;
}

const seedSpecArb: fc.Arbitrary<SeedSpec[]> = fc
  .array(
    fc.record({
      id: fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s.trim().length > 0),
      marketplaceId: fc.constantFrom(...MARKETPLACE_POOL),
      accountType: fc.constantFrom(...ACCOUNT_TYPE_POOL),
      // creationDate within a ~30-day band around BASE so date bounds bite.
      creationMs: fc.integer({ min: 0, max: 30 }).map((d) => BASE_MS + d * DAY_MS),
    }),
    { minLength: 0, maxLength: 100 },
  )
  // Ensure ids are unique so the id-set comparison is well defined.
  .map((specs) => {
    const seen = new Set<string>();
    const unique: SeedSpec[] = [];
    for (const s of specs) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      unique.push(s);
    }
    return unique;
  });

/** The optional filter combination applied to a given run. */
interface FilterSpec {
  marketplaceIds?: string | string[];
  accountType?: string;
  payoutId?: string;
  createdAfter?: string;
  createdBefore?: string;
}

const filterArb: fc.Arbitrary<FilterSpec> = fc.record(
  {
    // Either a single string or a (possibly multi-value) subset of the pool.
    marketplaceIds: fc.option(
      fc.oneof(
        fc.constantFrom(...MARKETPLACE_POOL),
        fc.uniqueArray(fc.constantFrom(...MARKETPLACE_POOL), { minLength: 1, maxLength: MARKETPLACE_POOL.length }),
      ),
      { nil: undefined },
    ),
    accountType: fc.option(fc.constantFrom(...ACCOUNT_TYPE_POOL), { nil: undefined }),
    payoutId: fc.option(fc.string({ minLength: 1, maxLength: 12 }), { nil: undefined }),
    createdAfter: fc.option(
      fc.integer({ min: -2, max: 32 }).map((d) => new Date(BASE_MS + d * DAY_MS).toISOString()),
      { nil: undefined },
    ),
    createdBefore: fc.option(
      fc.integer({ min: -2, max: 32 }).map((d) => new Date(BASE_MS + d * DAY_MS).toISOString()),
      { nil: undefined },
    ),
  },
  { requiredKeys: [] },
);

/** Seeds a PAYOUT record directly into the TRANSFERS namespace. */
function seedPayout(spec: SeedSpec): void {
  const record: PayoutRecord = {
    _key: spec.id,
    _type: "PAYOUT",
    id: spec.id,
    creationDate: new Date(spec.creationMs).toISOString(),
    currentStatus: "STARTED",
    partnerMetadata: { marketplaceId: spec.marketplaceId, accountType: spec.accountType },
  };
  Context.instance.engine.put(Api.TRANSFERS, spec.id, record as unknown as Record<string, unknown>);
}

/**
 * Independently computes the id-set the handler should return for a filter spec,
 * mirroring the handler's documented semantics: AND composition, marketplaceIds
 * membership (array or comma/single string), exact accountType/payoutId match,
 * createdAfter inclusive (>=), createdBefore exclusive (<).
 */
function expectedIds(specs: SeedSpec[], filter: FilterSpec): Set<string> {
  const mkList =
    filter.marketplaceIds === undefined
      ? undefined
      : Array.isArray(filter.marketplaceIds)
        ? filter.marketplaceIds
        : filter.marketplaceIds.split(",").filter((m) => m !== "");

  const afterTime = filter.createdAfter === undefined ? undefined : Date.parse(filter.createdAfter);
  const beforeTime = filter.createdBefore === undefined ? undefined : Date.parse(filter.createdBefore);

  const result = new Set<string>();
  for (const s of specs) {
    if (mkList !== undefined && !mkList.includes(s.marketplaceId)) continue;
    if (filter.accountType !== undefined && s.accountType !== filter.accountType) continue;
    if (filter.payoutId !== undefined && s.id !== filter.payoutId) continue;
    if (afterTime !== undefined && !(s.creationMs >= afterTime)) continue;
    if (beforeTime !== undefined && !(s.creationMs < beforeTime)) continue;
    result.add(s.id);
  }
  return result;
}

/** Builds the UnifiedValidationPass the handler reads filters from. */
function buildValidationPass(filter: FilterSpec, nextToken?: string): UnifiedValidationPass {
  const queryParams: Record<string, unknown> = {};
  if (nextToken !== undefined) queryParams.nextToken = nextToken;
  if (filter.marketplaceIds !== undefined) queryParams.marketplaceIds = filter.marketplaceIds;
  if (filter.accountType !== undefined) queryParams.accountType = filter.accountType;
  if (filter.payoutId !== undefined) queryParams.payoutId = filter.payoutId;
  if (filter.createdAfter !== undefined) queryParams.createdAfter = filter.createdAfter;
  if (filter.createdBefore !== undefined) queryParams.createdBefore = filter.createdBefore;

  return {
    pass: true,
    operationId: "listPayouts",
    apiName: "Transfers",
    apiVersion: "2024-06-01",
    pathParams: {},
    queryParams: queryParams as UnifiedValidationPass["queryParams"],
    body: {},
    resolvedEntities: {},
    operation: {},
  };
}

describe("listPayouts AND-composed filtering Property-Based Tests", () => {
  beforeEach(() => {
    Context.reset();
    process.env.REGION = "NA";
  });

  afterEach(() => {
    Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
  });

  // Feature: transfers-api, Property 4: listPayouts AND-composed filtering
  it("Property 4: listPayouts returns exactly the records satisfying every supplied filter (AND)", async () => {
    await fc.assert(
      fc.asyncProperty(seedSpecArb, filterArb, async (specs, rawFilter) => {
        Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();

        // A createdAfter after createdBefore is a 400 (a separate property covers
        // that path); skip those draws so this property only exercises filtering.
        if (
          rawFilter.createdAfter !== undefined &&
          rawFilter.createdBefore !== undefined &&
          Date.parse(rawFilter.createdAfter) > Date.parse(rawFilter.createdBefore)
        ) {
          return;
        }

        for (const s of specs) seedPayout(s);

        // listPayouts paginates in fixed pages with no page-size parameter, so
        // follow nextToken through every page to collect the complete match set.
        const collected: PayoutRecord[] = [];
        let token: string | undefined;
        let guard = specs.length + 2;
        do {
          const context = await listPayoutsHandler(buildValidationPass(rawFilter, token), { body: {} } as never);
          expect(context.statusCode).toBe(200);
          const body = context.data.body as { payouts: PayoutRecord[]; nextToken?: string };
          collected.push(...body.payouts);
          token = body.nextToken;
          guard -= 1;
          if (guard < 0) throw new Error("pagination did not terminate");
        } while (token !== undefined);

        const actualIds = new Set(collected.map((p) => p.id));
        const expected = expectedIds(specs, rawFilter);

        // Exact set equality: no extra records, no missing records.
        expect(actualIds).toEqual(expected);

        // Every returned record independently satisfies every supplied filter.
        for (const p of collected) {
          expect(expected.has(p.id)).toBe(true);
        }

        Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
      }),
      { numRuns: 100 },
    );
  });
});
