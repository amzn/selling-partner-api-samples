import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Request } from "express";
import fc from "fast-check";
import { listPayoutsHandler, type PayoutRecord } from "../../src/operation/transfersOperations.js";
import { Context, Api } from "../../src/database/Context.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

describe("listPayouts invalid/inverted date filters — Property-Based Tests", () => {
  beforeEach(() => {
    Context.reset();
    process.env.REGION = "NA";
  });

  afterEach(() => {
    Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
  });

  /** Count of every record currently stored in the TRANSFERS namespace. */
  function transfersCount(): number {
    return Context.instance.engine.find(Api.TRANSFERS, {}).length;
  }

  /**
   * Seeds a small, fixed set of Payout_Record documents into the TRANSFERS
   * namespace so the "namespace unchanged" assertion has something non-trivial to
   * protect. The handler rejects on date validation before it ever reads these,
   * so their exact contents don't matter — only that the count stays stable.
   */
  function seedPayouts(): void {
    const seeds: PayoutRecord[] = [
      {
        _key: "payout-1",
        _type: "PAYOUT",
        id: "payout-1",
        creationDate: "2024-01-01T00:00:00.000Z",
        currentStatus: "STARTED",
        partnerMetadata: { marketplaceId: "A1PA6795UKMFR9", accountType: "STANDARD_ORDERS" },
      },
      {
        _key: "payout-2",
        _type: "PAYOUT",
        id: "payout-2",
        creationDate: "2024-02-15T12:30:00.000Z",
        currentStatus: "STARTED",
        partnerMetadata: { marketplaceId: "A13V1IB3VIYZZH", accountType: "STANDARD_ORDERS" },
      },
      {
        _key: "payout-3",
        _type: "PAYOUT",
        id: "payout-3",
        creationDate: "2024-03-20T08:00:00.000Z",
        currentStatus: "STARTED",
        partnerMetadata: { marketplaceId: "APJ6JRA9NG5V4", accountType: "STANDARD_ORDERS" },
      },
    ];
    for (const record of seeds) {
      Context.instance.engine.put(Api.TRANSFERS, record._key, record as unknown as Record<string, unknown>);
    }
  }

  function makeValidationResult(queryParams: Record<string, string | string[] | undefined>): UnifiedValidationPass {
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

  function expectInvalidInput(context: Awaited<ReturnType<typeof listPayoutsHandler>>): void {
    expect(context.statusCode).toBe(400);
    const responseBody = context.data.body as { errors: { code: string; message: string }[] };
    expect(responseBody.errors).toBeInstanceOf(Array);
    expect(responseBody.errors.length).toBeGreaterThanOrEqual(1);
    expect(responseBody.errors[0].code).toBe("InvalidInput");
  }

  // Feature: transfers-api, Property 5: listPayouts rejects invalid or inverted date filters without mutation
  it("Property 5: listPayouts rejects invalid or inverted date filters without mutation", async () => {
    /**
     * Validates: Requirements 4.7, 4.8
     *
     * For any createdAfter or createdBefore value that does not parse as a valid
     * date-time, listPayoutsHandler rejects with HTTP 400 / code "InvalidInput";
     * for any createdAfter chronologically after createdBefore, listPayoutsHandler
     * rejects with HTTP 400 / "InvalidInput". In both cases the TRANSFERS
     * namespace is left unchanged.
     */

    // (a) Strings that never parse as a valid date-time. new Date(s).getTime()
    //     must be NaN for every one of these.
    const unparseableDate = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => !Number.isFinite(new Date(s).getTime()));

    await fc.assert(
      fc.asyncProperty(unparseableDate, unparseableDate, fc.constantFrom("after", "before", "both"), async (badAfter, badBefore, which) => {
        seedPayouts();
        const before = transfersCount();
        expect(before).toBe(3);

        const queryParams: Record<string, string | string[] | undefined> = {};
        if (which === "after" || which === "both") {
          queryParams.createdAfter = badAfter;
        }
        if (which === "before" || which === "both") {
          queryParams.createdBefore = badBefore;
        }

        const context = await listPayoutsHandler(makeValidationResult(queryParams), {} as Request);

        expectInvalidInput(context);
        // TRANSFERS namespace unchanged.
        expect(transfersCount()).toBe(before);

        Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
      }),
      { numRuns: 100 },
    );
  });

  // Feature: transfers-api, Property 5: listPayouts rejects invalid or inverted date filters without mutation
  it("Property 5 (inverted range): createdAfter strictly after createdBefore is rejected without mutation", async () => {
    /**
     * Validates: Requirements 4.8
     *
     * For any valid date-time pair where createdAfter is chronologically after
     * createdBefore, listPayoutsHandler rejects with HTTP 400 / "InvalidInput" and
     * leaves the TRANSFERS namespace unchanged.
     */

    // Two distinct epoch-millis instants; the larger becomes createdAfter so the
    // range is strictly inverted. Bounded to a realistic ISO-serializable span.
    const instant = fc.integer({ min: 0, max: 4_102_444_800_000 }); // 1970 .. 2100

    await fc.assert(
      fc.asyncProperty(instant, instant, async (a, b) => {
        fc.pre(a !== b);
        const laterMs = Math.max(a, b);
        const earlierMs = Math.min(a, b);
        const createdAfter = new Date(laterMs).toISOString();
        const createdBefore = new Date(earlierMs).toISOString();

        seedPayouts();
        const before = transfersCount();
        expect(before).toBe(3);

        const context = await listPayoutsHandler(makeValidationResult({ createdAfter, createdBefore }), {} as Request);

        expectInvalidInput(context);
        // TRANSFERS namespace unchanged.
        expect(transfersCount()).toBe(before);

        Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
      }),
      { numRuns: 100 },
    );
  });
});
