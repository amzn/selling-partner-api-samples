import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Request } from "express";
import fc from "fast-check";
import { initiatePayoutHandler } from "../../src/operation/transfersOperations.js";
import { Context, Api } from "../../src/database/Context.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

describe("initiatePayout missing-field rejection — Property-Based Tests", () => {
  beforeEach(() => {
    Context.reset();
  });

  afterEach(() => {
    Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
  });

  /** Count of every record currently stored in the TRANSFERS namespace. */
  function transfersCount(): number {
    return Context.instance.engine.find(Api.TRANSFERS, {}).length;
  }

  function makeValidationResult(body: Record<string, unknown>): UnifiedValidationPass {
    return {
      pass: true,
      operationId: "initiatePayout",
      apiName: "Transfers",
      apiVersion: "2024-06-01",
      pathParams: {},
      queryParams: {},
      body,
      resolvedEntities: {},
      operation: {},
    };
  }

  // Feature: transfers-api, Property 3: initiatePayout rejects missing required fields without mutation
  it("Property 3: initiatePayout rejects missing required fields without mutation", async () => {
    /**
     * Validates: Requirements 3.2
     *
     * For any InitiatePayoutRequest body missing marketplaceId OR missing
     * accountType, initiatePayoutHandler rejects the request with HTTP 400 and
     * error code "InvalidInput", and the TRANSFERS namespace is unchanged (no
     * record written).
     */

    // A present field value: any non-undefined JSON-ish scalar.
    const presentValue = fc.oneof(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.integer(),
      fc.boolean(),
    );

    // Unrelated junk fields that must never satisfy the required-field check.
    const junkFields = fc.dictionary(
      fc
        .string({ minLength: 1, maxLength: 12 })
        .filter((k) => k !== "marketplaceId" && k !== "accountType"),
      fc.oneof(fc.string(), fc.integer(), fc.boolean()),
      { maxKeys: 4 },
    );

    // Which required field(s) to omit: omit marketplaceId, omit accountType, or omit both.
    const omissionMode = fc.constantFrom<"omitMarketplace" | "omitAccountType" | "omitBoth">(
      "omitMarketplace",
      "omitAccountType",
      "omitBoth",
    );

    await fc.assert(
      fc.asyncProperty(omissionMode, presentValue, presentValue, junkFields, async (mode, mkt, acct, junk) => {
        // Start from unrelated junk only, then add back exactly the field(s) that
        // the omission mode keeps present. The required field(s) stay absent.
        const body: Record<string, unknown> = { ...junk };
        if (mode === "omitMarketplace") {
          body.accountType = acct;
        } else if (mode === "omitAccountType") {
          body.marketplaceId = mkt;
        }
        // mode === "omitBoth": neither required field present.

        const before = transfersCount();

        const validationResult = makeValidationResult(body);
        const context = await initiatePayoutHandler(validationResult, { body } as Request);

        // HTTP 400 with error code "InvalidInput".
        expect(context.statusCode).toBe(400);
        const responseBody = context.data.body as { errors: { code: string; message: string }[] };
        expect(responseBody.errors).toBeInstanceOf(Array);
        expect(responseBody.errors.length).toBeGreaterThanOrEqual(1);
        expect(responseBody.errors[0].code).toBe("InvalidInput");

        // TRANSFERS namespace unchanged — no record written.
        expect(transfersCount()).toBe(before);

        // Reset between runs so each iteration starts from an empty namespace.
        Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
      }),
      { numRuns: 100 },
    );
  });
});
