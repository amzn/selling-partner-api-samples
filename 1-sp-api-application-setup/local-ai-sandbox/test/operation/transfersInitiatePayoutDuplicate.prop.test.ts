import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { initiatePayoutHandler, type PayoutRecord } from "../../src/operation/transfersOperations.js";
import { Context, Api } from "../../src/database/Context.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

/**
 * Property 2: initiatePayout enforces the 24-hour one-payout-per-marketplace-and-account-type rule.
 *
 * Validates Requirements 3.4, 3.5.
 *
 * For any marketplaceId/accountType pair, if a Payout_Record created by initiatePayout
 * already exists with a creationDate within 24 hours before the current request, a second
 * initiatePayout request for that same pair is rejected with HTTP 429 and leaves the
 * TRANSFERS namespace unchanged; for any such pair with no matching record within that
 * window (including one whose only prior record is older than 24 hours), the request is
 * permitted (HTTP 200, new record created).
 */

/** Builds a UnifiedValidationPass + fake Express Request for an initiatePayout call. */
function buildRequest(marketplaceId: string, accountType: string): {
  validationResult: UnifiedValidationPass;
  request: { body: Record<string, unknown> };
} {
  const validationResult: UnifiedValidationPass = {
    pass: true,
    operationId: "initiatePayout",
    apiName: "Transfers",
    apiVersion: "2024-06-01",
    pathParams: {},
    queryParams: {},
    body: { marketplaceId, accountType },
    resolvedEntities: {},
    operation: {},
  };
  return { validationResult, request: { body: { marketplaceId, accountType } } };
}

/** Returns every PAYOUT-typed record currently in the TRANSFERS namespace. */
function allPayouts(): PayoutRecord[] {
  return Context.instance.engine.find(Api.TRANSFERS, { _type: "PAYOUT" }) as unknown as PayoutRecord[];
}

/** Seeds a PAYOUT record with a controlled creationDate directly into the namespace. */
function seedPayout(marketplaceId: string, accountType: string, creationDate: Date): string {
  const id = `seed-${marketplaceId}-${accountType}-${creationDate.getTime().toString()}`;
  const record: PayoutRecord = {
    _key: id,
    _type: "PAYOUT",
    id,
    creationDate: creationDate.toISOString(),
    currentStatus: "STARTED",
    partnerMetadata: { marketplaceId, accountType },
  };
  Context.instance.engine.put(Api.TRANSFERS, id, record as unknown as Record<string, unknown>);
  return id;
}

describe("initiatePayout 24-hour duplicate rejection Property-Based Tests", () => {
  beforeEach(() => {
    Context.reset();
    process.env.REGION = "NA";
  });

  afterEach(() => {
    Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
  });

  // Feature: transfers-api, Property 2: initiatePayout enforces the 24-hour one-payout-per-marketplace-and-account-type rule
  it("Property 2 (within window): a prior payout <24h ago rejects with 429 and leaves the namespace unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        // Age of the prior record, in minutes before now, strictly inside the 24h window.
        // Capped below 24h with a safety margin so the window boundary is never straddled.
        fc.integer({ min: 0, max: 24 * 60 - 2 }),
        async (marketplaceId, accountType, ageMinutes) => {
          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();

          const priorDate = new Date(Date.now() - ageMinutes * 60 * 1000);
          const seededId = seedPayout(marketplaceId, accountType, priorDate);

          const before = allPayouts();
          expect(before).toHaveLength(1);

          const { validationResult, request } = buildRequest(marketplaceId, accountType);
          const context = await initiatePayoutHandler(validationResult, request as never);

          // Rejected with HTTP 429.
          expect(context.statusCode).toBe(429);

          // Namespace unchanged: still exactly the seeded record, byte-for-byte.
          const after = allPayouts();
          expect(after).toHaveLength(1);
          expect(after[0].id).toBe(seededId);
          expect(after[0].creationDate).toBe(priorDate.toISOString());

          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: transfers-api, Property 2: initiatePayout enforces the 24-hour one-payout-per-marketplace-and-account-type rule
  it("Property 2 (outside window): a prior payout >24h ago permits the request (200) and creates a new record", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        // Age of the prior record, in minutes before now, strictly outside the 24h window
        // (at least 2 minutes past the boundary to avoid straddling it).
        fc.integer({ min: 24 * 60 + 2, max: 90 * 24 * 60 }),
        async (marketplaceId, accountType, ageMinutes) => {
          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();

          const priorDate = new Date(Date.now() - ageMinutes * 60 * 1000);
          const seededId = seedPayout(marketplaceId, accountType, priorDate);

          const { validationResult, request } = buildRequest(marketplaceId, accountType);
          const context = await initiatePayoutHandler(validationResult, request as never);

          // Permitted with HTTP 200 and a non-empty payoutReferenceId.
          expect(context.statusCode).toBe(200);
          const payoutReferenceId = (context.data.body as { payoutReferenceId: string }).payoutReferenceId;
          expect(typeof payoutReferenceId).toBe("string");
          expect(payoutReferenceId.length).toBeGreaterThan(0);

          // A new record was created: the seeded record plus the fresh one.
          const after = allPayouts();
          expect(after).toHaveLength(2);
          const freshIds = after.map((p) => p.id);
          expect(freshIds).toContain(seededId);
          expect(freshIds).toContain(payoutReferenceId);
          expect(payoutReferenceId).not.toBe(seededId);

          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: transfers-api, Property 2: initiatePayout enforces the 24-hour one-payout-per-marketplace-and-account-type rule
  it("Property 2 (empty namespace): no prior record for the pair permits the request (200) and creates a new record", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        async (marketplaceId, accountType) => {
          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();

          const { validationResult, request } = buildRequest(marketplaceId, accountType);
          const context = await initiatePayoutHandler(validationResult, request as never);

          expect(context.statusCode).toBe(200);
          const payoutReferenceId = (context.data.body as { payoutReferenceId: string }).payoutReferenceId;
          expect(payoutReferenceId.length).toBeGreaterThan(0);

          const after = allPayouts();
          expect(after).toHaveLength(1);
          expect(after[0].id).toBe(payoutReferenceId);
          expect(after[0].partnerMetadata?.marketplaceId).toBe(marketplaceId);
          expect(after[0].partnerMetadata?.accountType).toBe(accountType);

          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });
});
