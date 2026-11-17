import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { listPayoutsHandler, type PayoutRecord } from "../../src/operation/transfersOperations.js";
import { Context, Api } from "../../src/database/Context.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

/**
 * Property 8: listPayouts pagination completeness.
 *
 * Validates Requirements 4.14, 4.15.
 *
 * Paginating through all pages (following nextToken repeatedly with the same
 * filters) yields every matching record exactly once, in the correct global
 * order, with no duplicates or omissions. When results exceed the page size and
 * no nextToken was given, a nextToken is returned; following it returns the next
 * page starting immediately after the prior page. Every page except the last
 * carries exactly PAGE_SIZE items.
 *
 * listPayouts has no page-size query parameter, so the handler always uses its
 * fixed default page size (10); these properties assert against that constant.
 */

/** The handler's fixed listPayouts page size — there is no page-size query parameter. */
const PAGE_SIZE = 10;

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

/**
 * The globally correct expected order the handler should produce: creationDate
 * descending, ties broken by id ascending lexicographic.
 */
function expectedOrder(records: { id: string; creationDate: Date }[]): string[] {
  return [...records]
    .sort((a, b) => {
      const diff = b.creationDate.getTime() - a.creationDate.getTime();
      if (diff !== 0) return diff;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((r) => r.id);
}

describe("listPayouts pagination completeness Property-Based Tests", () => {
  beforeEach(() => {
    Context.reset();
    process.env.REGION = "NA";
  });

  afterEach(() => {
    Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
  });

  // Feature: transfers-api, Property 8: listPayouts pagination completeness
  it("Property 8: following nextToken through all pages yields every record exactly once, in order, with full pages until the last", async () => {
    await fc.assert(
      fc.asyncProperty(
        // N records (0..40), each with a unique id and a creationDate drawn from a small
        // set of day-offsets so that ties occur and the id tiebreak is exercised.
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s.trim().length > 0), {
          minLength: 0,
          maxLength: 40,
          selector: (s) => s,
        }),
        fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 40, maxLength: 40 }),
        async (ids, dayOffsets) => {
          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();

          const base = Date.UTC(2024, 0, 10);
          const seeded = ids.map((id, i) => {
            const creationDate = new Date(base - dayOffsets[i] * 24 * 60 * 60 * 1000);
            seedPayout(id, creationDate);
            return { id, creationDate };
          });

          const expected = expectedOrder(seeded);

          // Paginate: follow nextToken from the first page until it is absent.
          const collected: string[] = [];
          const pages: PayoutRecord[][] = [];
          let token: string | undefined;
          // Guard against runaway loops: at most one page per record plus one empty tail.
          let guard = seeded.length + 2;

          do {
            const qp: Record<string, string | string[] | undefined> = {};
            if (token !== undefined) qp.nextToken = token;

            const context = await listPayoutsHandler(buildPass(qp), {} as never);
            expect(context.statusCode).toBe(200);

            const body = context.data.body as ListPayoutsBody;
            pages.push(body.payouts);
            for (const p of body.payouts) collected.push(p.id);

            token = body.nextToken;
            guard -= 1;
            if (guard < 0) throw new Error("pagination did not terminate");
          } while (token !== undefined);

          // Completeness + ordering: concatenation equals the full expected ordered set.
          expect(collected).toEqual(expected);

          // No duplicates, no omissions (redundant with the above, but asserted directly).
          expect(new Set(collected).size).toBe(collected.length);
          expect(collected.length).toBe(seeded.length);

          // Every page except the last carries exactly PAGE_SIZE items; the last is 1..PAGE_SIZE
          // (or the single empty page when there were no records at all). Build the full list
          // of expected page lengths and compare in one unconditional assertion.
          const expectedPageLengths: number[] = [];
          if (seeded.length === 0) {
            expectedPageLengths.push(0);
          } else {
            let remaining = seeded.length;
            while (remaining > 0) {
              const take = Math.min(PAGE_SIZE, remaining);
              expectedPageLengths.push(take);
              remaining -= take;
            }
          }
          expect(pages.map((p) => p.length)).toEqual(expectedPageLengths);

          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: transfers-api, Property 8: listPayouts pagination completeness
  it("Property 8 (nextToken presence): a nextToken is returned exactly when more records remain beyond the current page", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 40 }),
        async (count) => {
          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();

          const base = Date.UTC(2024, 0, 10);
          for (let i = 0; i < count; i++) {
            // Distinct creationDates keep ordering unambiguous for this presence check.
            seedPayout(`id-${String(i).padStart(3, "0")}`, new Date(base - i * 60 * 1000));
          }

          const context = await listPayoutsHandler(buildPass({}), {} as never);
          expect(context.statusCode).toBe(200);
          const body = context.data.body as ListPayoutsBody;

          // First page holds min(count, PAGE_SIZE) items.
          expect(body.payouts.length).toBe(Math.min(count, PAGE_SIZE));

          // nextToken is present iff there are strictly more records than the first page shows.
          expect(typeof body.nextToken === "string").toBe(count > PAGE_SIZE);

          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });
});
