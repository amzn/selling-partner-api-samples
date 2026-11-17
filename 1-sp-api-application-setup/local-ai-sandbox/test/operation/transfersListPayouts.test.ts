import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { listPayoutsHandler, type PayoutRecord } from "../../src/operation/transfersOperations.js";
import { Context, Api } from "../../src/database/Context.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

/**
 * Unit tests for `listPayouts` response shape and the empty-database case.
 *
 * Validates Requirements 4.1 and 4.10:
 *  - 4.1: a valid request returns matching records within a `payouts` array at
 *    HTTP 200 (the response envelope is `{ payouts, nextToken? }`).
 *  - 4.10: when no Payout_Record documents match, the handler returns HTTP 200
 *    with `payouts` set to an empty array.
 *
 * These are plain example-based unit tests (not property-based); the universal
 * filtering/ordering/pagination properties are covered by the sibling
 * `transfersListPayouts*.prop.test.ts` files.
 */

/** Seeds a PAYOUT record directly into the TRANSFERS namespace. */
function seedPayout(id: string, creationDate: string, marketplaceId: string, accountType: string): PayoutRecord {
  const record: PayoutRecord = {
    _key: id,
    _type: "PAYOUT",
    id,
    creationDate,
    currentStatus: "STARTED",
    partnerMetadata: { marketplaceId, accountType },
  };
  Context.instance.engine.put(Api.TRANSFERS, id, record as unknown as Record<string, unknown>);
  return record;
}

/** Builds the UnifiedValidationPass the handler reads query params from. */
function buildValidationPass(queryParams: Record<string, unknown> = {}): UnifiedValidationPass {
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

describe("listPayouts response shape and empty-database case", () => {
  beforeEach(() => {
    Context.reset();
    process.env.REGION = "NA";
    Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
  });

  afterEach(() => {
    Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
  });

  it("returns { payouts } containing the seeded records at HTTP 200 for a representative request (Requirement 4.1)", async () => {
    const seeded = [
      seedPayout("payout-1", "2024-01-03T00:00:00.000Z", "ATVPDKIKX0DER", "Standard Orders"),
      seedPayout("payout-2", "2024-01-02T00:00:00.000Z", "ATVPDKIKX0DER", "Standard Orders"),
      seedPayout("payout-3", "2024-01-01T00:00:00.000Z", "ATVPDKIKX0DER", "Standard Orders"),
    ];

    const context = await listPayoutsHandler(buildValidationPass(), { body: {} } as never);

    expect(context.statusCode).toBe(200);

    const body = context.data.body as { payouts: PayoutRecord[]; nextToken?: string };

    // Envelope has a `payouts` array...
    expect(Array.isArray(body.payouts)).toBe(true);

    // ...containing exactly the seeded records.
    const returnedIds = new Set(body.payouts.map((p) => p.id));
    expect(returnedIds).toEqual(new Set(seeded.map((p) => p.id)));
    expect(body.payouts).toHaveLength(seeded.length);

    // A small result set (3 records) under the default page size (10) fits on a
    // single page, so there is no continuation token.
    expect(body.nextToken).toBeUndefined();
    expect("nextToken" in body).toBe(false);

    // The envelope carries no keys beyond `payouts` for this request.
    expect(Object.keys(body)).toEqual(["payouts"]);
  });

  it("returns payouts: [] with HTTP 200 when the TRANSFERS namespace is empty (Requirement 4.10)", async () => {
    const context = await listPayoutsHandler(buildValidationPass(), { body: {} } as never);

    expect(context.statusCode).toBe(200);

    const body = context.data.body as { payouts: PayoutRecord[]; nextToken?: string };

    expect(body.payouts).toEqual([]);
    expect(body.nextToken).toBeUndefined();
  });
});
