import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { initiatePayoutHandler, type PayoutRecord } from "../../src/operation/transfersOperations.js";
import { Context, Api } from "../../src/database/Context.js";
import { TRANSFERS_EU_MARKETPLACE_IDS } from "../../src/validation/validationRegistry.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

describe("initiatePayout Property-Based Tests", () => {
  beforeEach(() => {
    Context.reset();
    process.env.REGION = "NA";
  });

  afterEach(() => {
    Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
  });

  /**
   * Builds the validation pass the handler expects. The handler only reads
   * `marketplaceId`/`accountType` off the Express `request.body`; the metadata
   * fields on the pass are copied verbatim into the OperationContext, so any
   * well-formed values suffice.
   */
  function buildValidationPass(): UnifiedValidationPass {
    return {
      pass: true,
      operationId: "initiatePayout",
      apiName: "Transfers",
      apiVersion: "2024-06-01",
      pathParams: {},
      queryParams: {},
      body: {},
      resolvedEntities: {},
      operation: {},
    };
  }

  // The eight EU Supported_Marketplace values the validation pipeline admits for
  // initiatePayout. The handler accepts any string, but drawing from the real
  // production allowlist keeps the generated pair "valid" in the spec's sense
  // and prevents this pool from drifting from the pipeline.
  const supportedMarketplaceIds = TRANSFERS_EU_MARKETPLACE_IDS;

  // Feature: transfers-api, Property 1: initiatePayout creates a unique, correctly-attributed Payout_Record
  it("Property 1: initiatePayout creates a unique, correctly-attributed Payout_Record", async () => {
    /**
     * Validates: Requirements 3.1, 3.3, 3.5, 3.6
     *
     * For any valid marketplaceId/accountType pair with no matching Payout_Record
     * created within the preceding 24 hours, calling initiatePayoutHandler creates
     * exactly one new Payout_Record whose `id` is unique among all Payout_Record
     * documents in the TRANSFERS namespace, whose partnerMetadata.marketplaceId/
     * accountType equal the request's values, and returns HTTP 200 with
     * payoutReferenceId equal to that record's id.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...supportedMarketplaceIds),
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        async (marketplaceId, accountType) => {
          // Start each run from an empty TRANSFERS namespace so no prior record
          // can collide with the 24-hour duplicate rule for this exact pair.
          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();

          const payoutsBefore = Context.instance.engine.find(Api.TRANSFERS, { _type: "PAYOUT" }) as unknown as PayoutRecord[];
          const countBefore = payoutsBefore.length;

          const validationResult = buildValidationPass();
          const request = { body: { marketplaceId, accountType } } as never;

          const context = await initiatePayoutHandler(validationResult, request);

          // Returns HTTP 200.
          expect(context.statusCode).toBe(200);

          const body = context.data.body as { payoutReferenceId: string };
          expect(typeof body.payoutReferenceId).toBe("string");
          expect(body.payoutReferenceId.length).toBeGreaterThan(0);

          // Exactly one new Payout_Record was created.
          const payoutsAfter = Context.instance.engine.find(Api.TRANSFERS, { _type: "PAYOUT" }) as unknown as PayoutRecord[];
          expect(payoutsAfter.length).toBe(countBefore + 1);

          // The returned reference id matches a stored record's id.
          const created = payoutsAfter.find((p) => p.id === body.payoutReferenceId);
          expect(created).toBeDefined();

          // payoutReferenceId equals that record's id.
          expect(created!.id).toBe(body.payoutReferenceId);

          // id is unique among all Payout_Record documents in the namespace.
          const idMatches = payoutsAfter.filter((p) => p.id === body.payoutReferenceId);
          expect(idMatches.length).toBe(1);

          // Correct attribution: partnerMetadata mirrors the request's values.
          expect(created!.partnerMetadata?.marketplaceId).toBe(marketplaceId);
          expect(created!.partnerMetadata?.accountType).toBe(accountType);

          // Clean up for the next iteration.
          Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });
});
