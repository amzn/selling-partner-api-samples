import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { listPayoutsHandler, type PayoutRecord } from "../../src/operation/transfersOperations.js";
import { Context, Api } from "../../src/database/Context.js";
import { encodePageToken } from "../../src/service/Paginator.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

/**
 * Property 9: listPayouts invalid pagination token degrades gracefully.
 *
 * Validates Requirement 4.16.
 *
 * For any nextToken that is malformed, expired, or does not correspond to the
 * other filter parameters supplied on the request, listPayouts returns HTTP 200
 * with payouts set to [] and omits the nextToken field from the response.
 */

/** Builds a UnifiedValidationPass for a listPayouts call carrying the given query params. */
function buildPass(queryParams: Record<string, string | string[] | undefined>): UnifiedValidationPass {
  return {
    pass: true,
    operationId: "listPayouts",
    apiName: "Transfers",
    apiVersion: "2024-06-01",
    pathParams: {},
    queryParams,
    body: undefined,
    resolvedEntities: {},
    operation: {},
  };
}

/** Seeds a PAYOUT record with a controlled id and creationDate directly into the namespace. */
function seedPayout(id: string, creationDate: Date): void {
  const record: PayoutRecord = {
    _key: id,
    _type: "PAYOUT",
    id,
    creationDate: creationDate.toISOString(),
    currentStatus: "STARTED",
    partnerMetadata: {},
  };
  Context.instance.engine.put(Api.TRANSFERS, id, record as unknown as Record<string, unknown>);
}

/** Response body shape returned by listPayoutsHandler on 200. */
interface ListPayoutsBody {
  payouts: PayoutRecord[];
  nextToken?: string;
}

/** Asserts the graceful-degradation contract for a given query. */
async function assertGracefulDegradation(qp: Record<string, string | string[] | undefined>): Promise<void> {
  const context = await listPayoutsHandler(buildPass(qp), {} as never);
  expect(context.statusCode).toBe(200);

  const body = context.data.body as ListPayoutsBody;
  expect(body.payouts).toEqual([]);
  expect("nextToken" in body).toBe(false);
  expect(body.nextToken).toBeUndefined();
}

describe("listPayouts invalid pagination token Property-Based Tests", () => {
  beforeEach(() => {
    Context.reset();
    process.env.REGION = "NA";
  });

  afterEach(() => {
    Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
  });

  // Feature: transfers-api, Property 9: listPayouts invalid pagination token degrades gracefully
  it("Property 9 (malformed token): a non-decodable nextToken yields HTTP 200 with payouts [] and no nextToken", async () => {
    await fc.assert(
      fc.asyncProperty(
        // A small, varied set of seeded records so there is real data to (not) page over.
        fc.integer({ min: 0, max: 20 }),
        // Arbitrary garbage strings: random non-base64 / non-JSON / wrong-shape tokens.
        fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim().length > 0),
        async (count, garbageToken) => {
          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();

          const base = Date.UTC(2024, 0, 10);
          for (let i = 0; i < count; i++) {
            seedPayout(`id-${String(i).padStart(3, "0")}`, new Date(base - i * 60 * 1000));
          }

          await assertGracefulDegradation({ nextToken: garbageToken });

          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: transfers-api, Property 9: listPayouts invalid pagination token degrades gracefully
  it("Property 9 (out-of-range token): a token encoding an offset at or beyond the result count yields HTTP 200 with payouts [] and no nextToken", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 20 }),
        // Extra offset pushing the token at or past the end of the result set.
        fc.integer({ min: 0, max: 50 }),
        async (count, overshoot) => {
          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();

          const base = Date.UTC(2024, 0, 10);
          for (let i = 0; i < count; i++) {
            seedPayout(`id-${String(i).padStart(3, "0")}`, new Date(base - i * 60 * 1000));
          }

          // Offset >= count is beyond the (possibly empty) result set -> empty page, no token.
          const outOfRangeToken = encodePageToken(count + overshoot);
          await assertGracefulDegradation({ nextToken: outOfRangeToken });

          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: transfers-api, Property 9: listPayouts invalid pagination token degrades gracefully
  it("Property 9 (filter-mismatched token): a token valid for a larger set but overshooting the filtered set yields HTTP 200 with payouts [] and no nextToken", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Records split across two account types so a filter shrinks the result set.
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 20 }),
        async (matchingCount, otherCount) => {
          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();

          const base = Date.UTC(2024, 0, 10);
          let seq = 0;
          for (let i = 0; i < matchingCount; i++) {
            const id = `match-${String(seq++).padStart(3, "0")}`;
            const record: PayoutRecord = {
              _key: id,
              _type: "PAYOUT",
              id,
              creationDate: new Date(base - seq * 60 * 1000).toISOString(),
              currentStatus: "STARTED",
              partnerMetadata: { accountType: "STANDARD_ORDERS" },
            };
            Context.instance.engine.put(Api.TRANSFERS, id, record as unknown as Record<string, unknown>);
          }
          for (let i = 0; i < otherCount; i++) {
            const id = `other-${String(seq++).padStart(3, "0")}`;
            const record: PayoutRecord = {
              _key: id,
              _type: "PAYOUT",
              id,
              creationDate: new Date(base - seq * 60 * 1000).toISOString(),
              currentStatus: "STARTED",
              partnerMetadata: { accountType: "EARLY_REVIEWER_PROGRAM" },
            };
            Context.instance.engine.put(Api.TRANSFERS, id, record as unknown as Record<string, unknown>);
          }

          // A token valid against the full set (matching + other) but at/beyond the
          // filtered subset (matching only) must degrade to an empty page.
          const tokenBeyondFilteredSet = encodePageToken(matchingCount + otherCount);
          await assertGracefulDegradation({ accountType: "STANDARD_ORDERS", nextToken: tokenBeyondFilteredSet });

          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });
});
