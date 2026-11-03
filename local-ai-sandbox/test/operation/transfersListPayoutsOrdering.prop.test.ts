import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { listPayoutsHandler, type PayoutRecord } from "../../src/operation/transfersOperations.js";
import { Context, Api } from "../../src/database/Context.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

/**
 * Property 6: listPayouts orders results by creationDate descending with id tiebreak.
 *
 * Validates Requirement 4.9.
 *
 * listPayouts returns payouts ordered by creationDate descending (most recent first),
 * with ties (equal creationDate) broken by id ascending lexicographic. We seed up to 100
 * Payout_Records with varied creationDates — including deliberate ties where several
 * records share a creationDate but differ in id — but no more than one page's worth (the
 * handler's fixed page size of 10, since listPayouts has no page-size parameter), so the
 * full ordering is observable in a single page. We then assert every adjacent pair in the
 * returned payouts array satisfies the (creationDate desc, id asc) ordering invariant.
 */

/** Builds a UnifiedValidationPass for a listPayouts call with the given query params. */
function buildValidationPass(queryParams: Record<string, string | string[] | undefined>): UnifiedValidationPass {
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
function seedPayout(id: string, creationDate: string): void {
  const record: PayoutRecord = {
    _key: id,
    _type: "PAYOUT",
    id,
    creationDate,
    currentStatus: "STARTED",
    partnerMetadata: { marketplaceId: "A1PA6795UKMFR9", accountType: "STANDARD_ORDERS" },
  };
  Context.instance.engine.put(Api.TRANSFERS, id, record as unknown as Record<string, unknown>);
}

describe("listPayouts ordering Property-Based Tests", () => {
  beforeEach(() => {
    Context.reset();
    process.env.REGION = "NA";
  });

  afterEach(() => {
    Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
  });

  // Feature: transfers-api, Property 6: listPayouts orders results by creationDate descending with id tiebreak
  it("Property 6: returned payouts are ordered by creationDate desc, ties broken by id asc", async () => {
    // A small pool of distinct timestamps so collisions (deliberate ties) are frequent.
    const timestampPool = [
      "2024-01-01T00:00:00.000Z",
      "2024-01-01T12:00:00.000Z",
      "2024-02-15T08:30:00.000Z",
      "2024-06-30T23:59:59.000Z",
      "2024-11-05T06:15:00.000Z",
      "2025-03-20T18:45:30.000Z",
    ];

    await fc.assert(
      fc.asyncProperty(
        // Up to 10 records (so the whole set fits in one page — listPayouts has no
        // page-size parameter and the handler's fixed page size is 10), each a
        // (unique id, creationDate drawn from the small pool) pair. Unique ids keep the
        // tiebreak well-defined; the shared timestamp pool guarantees frequent ties.
        fc.uniqueArray(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s.trim().length > 0),
            creationDate: fc.constantFrom(...timestampPool),
          }),
          { minLength: 1, maxLength: 10, selector: (r) => r.id },
        ),
        async (records) => {
          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();

          for (const { id, creationDate } of records) {
            seedPayout(id, creationDate);
          }

          const validationResult = buildValidationPass({});
          const context = await listPayoutsHandler(validationResult, {} as never);

          expect(context.statusCode).toBe(200);
          const payouts = (context.data.body as { payouts: PayoutRecord[] }).payouts;

          // At most 10 seeded records and a fixed page size of 10 => the full set is observable.
          expect(payouts).toHaveLength(records.length);

          // Every adjacent pair satisfies the ordering invariant:
          //   creationDate strictly descending, OR equal creationDate with id strictly ascending.
          for (let i = 0; i + 1 < payouts.length; i++) {
            const current = payouts[i];
            const next = payouts[i + 1];
            const currentTime = new Date(current.creationDate).getTime();
            const nextTime = new Date(next.creationDate).getTime();

            if (currentTime === nextTime) {
              // Tie on creationDate: id must be strictly ascending lexicographic.
              expect(current.id < next.id).toBe(true);
            } else {
              // Otherwise the earlier element must be more recent (descending).
              expect(currentTime).toBeGreaterThan(nextTime);
            }
          }

          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });
});
