import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Request } from "express";
import { executeValidation } from "../../src/service/validationEngine.js";
import { RequestContext, UnifiedValidationPass, ValidationFail } from "../../src/validation/validationTypes.js";
import { OPERATIONS_REGISTRY } from "../../src/registry/operationRegistry.js";
import { Context, Api } from "../../src/database/Context.js";
import type { ExpectedPayoutRecord, PaymentMethodRecord, PayoutRecord } from "../../src/operation/transfersOperations.js";

/**
 * End-to-end integration tests for the four Transfers v2024-06-01 routes
 * (`initiatePayout`, `listPayouts`, `getPaymentMethods`, `listExpectedPayouts`).
 *
 * Each test drives the same path the Express catch-all route takes for an
 * unmatched SP-API request: the request context is run through
 * `executeValidation` (the pipeline stage keyed by `apiName:apiVersion:operationId`),
 * and — when validation passes — the registered `OperationHandler` resolved from
 * `OPERATIONS_REGISTRY` is invoked with the resulting `UnifiedValidationPass`.
 * This mirrors `financesOperations.integration.test.ts` (the closest analog), with
 * one difference: instead of mocking the Context to an empty engine, these tests
 * use the real in-memory `Context` and seed TRANSFERS records directly, so
 * filtering, ordering, and CARD-field shaping surface through the route rather
 * than always returning an empty page.
 *
 * MODE is left at its default (Seller) throughout, since Transfers is Seller-only.
 *
 * Requirements: 3.1, 4.1, 5.1, 6.1, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4
 */

const INITIATE_PAYOUT_KEY = "Transfers:2024-06-01:initiatePayout";
const LIST_PAYOUTS_KEY = "Transfers:2024-06-01:listPayouts";
const GET_PAYMENT_METHODS_KEY = "Transfers:2024-06-01:getPaymentMethods";
const LIST_EXPECTED_PAYOUTS_KEY = "Transfers:2024-06-01:listExpectedPayouts";

// One of the eight fixed EU marketplaces the Transfers payout/payment-method
// operations allow (DE), independent of REGION; and a NA id that is never in
// that allowlist so it is rejected before the handler runs.
const EU_MARKETPLACE_ID = "A1PA6795UKMFR9"; // DE
const NON_EU_MARKETPLACE_ID = "ATVPDKIKX0DER"; // US (NA)

type Handler = NonNullable<ReturnType<typeof OPERATIONS_REGISTRY.get>>;

/** Resolves a registered handler by composite key, failing the test if it is missing (and narrowing away `undefined`). */
function requireHandler(key: string): Handler {
  const handler = OPERATIONS_REGISTRY.get(key);
  expect(handler).toBeDefined();
  if (!handler) {
    throw new Error(`No handler registered for ${key}`);
  }
  return handler;
}

/** Builds a handler-input (UnifiedValidationPass) object, as the controller would after validation passes. */
function validationPass(
  operationId: string,
  queryParams: Record<string, unknown> = {},
  body?: Record<string, unknown>,
): UnifiedValidationPass {
  return {
    pass: true,
    operationId,
    apiName: "Transfers",
    apiVersion: "2024-06-01",
    pathParams: {},
    queryParams: queryParams as UnifiedValidationPass["queryParams"],
    body,
    resolvedEntities: {},
    operation: {},
  };
}

/** Minimal Express Request stub carrying only the body the handlers read. */
function req(body?: Record<string, unknown>): Request {
  return { body } as unknown as Request;
}

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

/** Seeds a PAYMENT_METHOD record directly into the TRANSFERS namespace. */
function seedPaymentMethod(record: PaymentMethodRecord): PaymentMethodRecord {
  Context.instance.engine.put(Api.TRANSFERS, record.paymentMethodId, record as unknown as Record<string, unknown>);
  return record;
}

/** Seeds an EXPECTED_PAYOUT record directly into the TRANSFERS namespace. */
function seedExpectedPayout(key: string, scheduledDate: string, marketplaceId: string, accountType: string): ExpectedPayoutRecord {
  const record: ExpectedPayoutRecord = {
    _key: key,
    _type: "EXPECTED_PAYOUT",
    scheduledDate,
    status: "SCHEDULED",
    partnerMetadata: { marketplaceId, accountType },
  };
  Context.instance.engine.put(Api.TRANSFERS, key, record as unknown as Record<string, unknown>);
  return record;
}

describe("Transfers Integration Tests", () => {
  beforeEach(() => {
    Context.reset();
    delete process.env.REGION;
    delete process.env.MODE;
    Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
  });

  afterEach(() => {
    Context.instance.engine.getCollection(Api.TRANSFERS)?.clear();
    delete process.env.REGION;
    delete process.env.MODE;
  });

  // --- initiatePayout (Requirements 3.1, 7.1, 8.1) ---
  describe("initiatePayout", () => {
    it("handler is registered under its composite key as a function (Req 7.1)", () => {
      const handler = OPERATIONS_REGISTRY.get(INITIATE_PAYOUT_KEY);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });

    it("valid EU marketplaceId + accountType passes validation and returns 200 with a payoutReferenceId (Req 3.1)", async () => {
      const body = { marketplaceId: EU_MARKETPLACE_ID, accountType: "Standard Orders" };
      const context: RequestContext = {
        apiName: "Transfers",
        apiVersion: "2024-06-01",
        operationId: "initiatePayout",
        method: "POST",
        pathParams: {},
        queryParams: {},
        body,
      };

      const validationResult = await executeValidation(context);
      expect(validationResult.pass).toBe(true);

      const handler = requireHandler(INITIATE_PAYOUT_KEY);
      const handlerResult = await handler(validationPass("initiatePayout", {}, body), req(body));

      expect(handlerResult.statusCode).toBe(200);
      const responseBody = handlerResult.data.body as Record<string, unknown>;
      expect(responseBody).toHaveProperty("payoutReferenceId");
      expect(typeof responseBody.payoutReferenceId).toBe("string");
      expect((responseBody.payoutReferenceId as string).length).toBeGreaterThan(0);

      // The payout was actually persisted under the generated id, with the
      // request's marketplaceId/accountType attached.
      const persisted = Context.instance.engine.find(Api.TRANSFERS, { _type: "PAYOUT" }) as unknown as PayoutRecord[];
      expect(persisted).toHaveLength(1);
      expect(persisted[0].id).toBe(responseBody.payoutReferenceId);
      expect(persisted[0].partnerMetadata?.marketplaceId).toBe(EU_MARKETPLACE_ID);
      expect(persisted[0].partnerMetadata?.accountType).toBe("Standard Orders");
    });

    it("rejects a non-EU marketplaceId with 400/InvalidInput before the handler runs, regardless of REGION (Req 8.1)", async () => {
      // Even with REGION=NA (which would make this id valid for a REGION-driven
      // rule), the fixed EU allowlist rejects it.
      process.env.REGION = "NA";
      const body = { marketplaceId: NON_EU_MARKETPLACE_ID, accountType: "Standard Orders" };
      const context: RequestContext = {
        apiName: "Transfers",
        apiVersion: "2024-06-01",
        operationId: "initiatePayout",
        method: "POST",
        pathParams: {},
        queryParams: {},
        body,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].code).toBe("InvalidInput");

      // The handler never ran, so nothing was written.
      const persisted = Context.instance.engine.find(Api.TRANSFERS, { _type: "PAYOUT" }) as unknown as PayoutRecord[];
      expect(persisted).toHaveLength(0);
    });
  });

  // --- listPayouts (Requirements 4.1, 7.2, 8.2) ---
  describe("listPayouts", () => {
    it("handler is registered under its composite key as a function (Req 7.2)", () => {
      const handler = OPERATIONS_REGISTRY.get(LIST_PAYOUTS_KEY);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });

    it("rejects an invalid marketplaceIds value with 400/InvalidInput (Req 8.2)", async () => {
      process.env.REGION = "NA";
      const context: RequestContext = {
        apiName: "Transfers",
        apiVersion: "2024-06-01",
        operationId: "listPayouts",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: ["INVALID_MARKETPLACE_ID"] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].code).toBe("InvalidInput");
    });

    it("valid request passes validation and the handler returns 200 with { payouts } reflecting filtering and ordering (Req 4.1)", async () => {
      process.env.REGION = "NA";

      // Seed three payouts for the target marketplace (out of creationDate order)
      // plus one for a different marketplace that must be filtered out.
      seedPayout("payout-b", "2024-01-02T00:00:00.000Z", NON_EU_MARKETPLACE_ID, "Standard Orders");
      seedPayout("payout-a", "2024-01-03T00:00:00.000Z", NON_EU_MARKETPLACE_ID, "Standard Orders");
      seedPayout("payout-c", "2024-01-01T00:00:00.000Z", NON_EU_MARKETPLACE_ID, "Standard Orders");
      seedPayout("payout-other", "2024-01-04T00:00:00.000Z", "A2EUQ1WTGCTBG2", "Standard Orders");

      const queryParams = { marketplaceIds: [NON_EU_MARKETPLACE_ID] };
      const context: RequestContext = {
        apiName: "Transfers",
        apiVersion: "2024-06-01",
        operationId: "listPayouts",
        method: "GET",
        pathParams: {},
        queryParams,
        body: undefined,
      };

      const validationResult = await executeValidation(context);
      expect(validationResult.pass).toBe(true);

      const handler = requireHandler(LIST_PAYOUTS_KEY);
      const handlerResult = await handler(validationPass("listPayouts", queryParams), req());

      expect(handlerResult.statusCode).toBe(200);
      const responseBody = handlerResult.data.body as { payouts: PayoutRecord[]; nextToken?: string };
      expect(Array.isArray(responseBody.payouts)).toBe(true);

      // The other-marketplace payout is filtered out; the three matches are
      // ordered by creationDate descending.
      expect(responseBody.payouts.map((p) => p.id)).toEqual(["payout-a", "payout-b", "payout-c"]);
      // A three-record result under the default page size fits on one page.
      expect(responseBody.nextToken).toBeUndefined();
    });
  });

  // --- getPaymentMethods (Requirements 5.1, 7.3, 8.3) ---
  describe("getPaymentMethods", () => {
    it("handler is registered under its composite key as a function (Req 7.3)", () => {
      const handler = OPERATIONS_REGISTRY.get(GET_PAYMENT_METHODS_KEY);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });

    it("rejects a non-EU marketplaceId with 400/InvalidInput before the handler runs, regardless of REGION (Req 8.3)", async () => {
      process.env.REGION = "NA";
      const context: RequestContext = {
        apiName: "Transfers",
        apiVersion: "2024-06-01",
        operationId: "getPaymentMethods",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceId: NON_EU_MARKETPLACE_ID },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].code).toBe("InvalidInput");
    });

    it("valid request passes validation and the handler returns 200 with { paymentMethods }, CARD entries carrying countryCode/expiryDate (Req 5.1)", async () => {
      seedPaymentMethod({
        _key: "pm-bank",
        _type: "PAYMENT_METHOD",
        paymentMethodId: "pm-bank",
        paymentMethodType: "BANK_ACCOUNT",
        accountHolderName: "Acme GmbH",
        tail: "4321",
        marketplaceId: EU_MARKETPLACE_ID,
      });
      seedPaymentMethod({
        _key: "pm-card",
        _type: "PAYMENT_METHOD",
        paymentMethodId: "pm-card",
        paymentMethodType: "CARD",
        accountHolderName: "Acme GmbH",
        tail: "1111",
        marketplaceId: EU_MARKETPLACE_ID,
        countryCode: "DE",
        expiryDate: "2030-12",
      });
      // A payment method for a different marketplace that must be filtered out.
      seedPaymentMethod({
        _key: "pm-other",
        _type: "PAYMENT_METHOD",
        paymentMethodId: "pm-other",
        paymentMethodType: "BANK_ACCOUNT",
        marketplaceId: "A13V1IB3VIYZZH",
      });

      const queryParams = { marketplaceId: EU_MARKETPLACE_ID };
      const context: RequestContext = {
        apiName: "Transfers",
        apiVersion: "2024-06-01",
        operationId: "getPaymentMethods",
        method: "GET",
        pathParams: {},
        queryParams,
        body: undefined,
      };

      const validationResult = await executeValidation(context);
      expect(validationResult.pass).toBe(true);

      const handler = requireHandler(GET_PAYMENT_METHODS_KEY);
      const handlerResult = await handler(validationPass("getPaymentMethods", queryParams), req());

      expect(handlerResult.statusCode).toBe(200);
      const responseBody = handlerResult.data.body as { paymentMethods: Record<string, unknown>[] };
      expect(Array.isArray(responseBody.paymentMethods)).toBe(true);

      // Only the two methods for the requested marketplace surface.
      const byId = new Map(responseBody.paymentMethods.map((m) => [m.paymentMethodId as string, m]));
      expect([...byId.keys()].sort()).toEqual(["pm-bank", "pm-card"]);

      // Internal fields are never leaked.
      for (const method of responseBody.paymentMethods) {
        expect(method).not.toHaveProperty("_key");
        expect(method).not.toHaveProperty("_type");
        expect(method).not.toHaveProperty("marketplaceId");
      }

      // CARD entries carry countryCode/expiryDate; non-CARD entries do not.
      const card = byId.get("pm-card")!;
      expect(card.countryCode).toBe("DE");
      expect(card.expiryDate).toBe("2030-12");

      const bank = byId.get("pm-bank")!;
      expect(bank).not.toHaveProperty("countryCode");
      expect(bank).not.toHaveProperty("expiryDate");
    });

    it("treats an empty paymentMethodTypes (e.g. ?paymentMethodTypes=) as no filter, not a match-nothing filter", async () => {
      seedPaymentMethod({
        _key: "pm-bank",
        _type: "PAYMENT_METHOD",
        paymentMethodId: "pm-bank",
        paymentMethodType: "BANK_ACCOUNT",
        marketplaceId: EU_MARKETPLACE_ID,
      });
      seedPaymentMethod({
        _key: "pm-card",
        _type: "PAYMENT_METHOD",
        paymentMethodId: "pm-card",
        paymentMethodType: "CARD",
        marketplaceId: EU_MARKETPLACE_ID,
        countryCode: "DE",
        expiryDate: "2030-12",
      });

      // An empty value for paymentMethodTypes must not suppress all results.
      const queryParams = { marketplaceId: EU_MARKETPLACE_ID, paymentMethodTypes: "" };
      const handler = requireHandler(GET_PAYMENT_METHODS_KEY);
      const handlerResult = await handler(validationPass("getPaymentMethods", queryParams), req());

      expect(handlerResult.statusCode).toBe(200);
      const responseBody = handlerResult.data.body as { paymentMethods: Record<string, unknown>[] };
      const ids = responseBody.paymentMethods.map((m) => m.paymentMethodId as string).sort();
      expect(ids).toEqual(["pm-bank", "pm-card"]);
    });
  });

  // --- listExpectedPayouts (Requirements 6.1, 7.4, 8.4) ---
  describe("listExpectedPayouts", () => {
    it("handler is registered under its composite key as a function (Req 7.4)", () => {
      const handler = OPERATIONS_REGISTRY.get(LIST_EXPECTED_PAYOUTS_KEY);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });

    it("rejects an invalid marketplaceIds value with 400/InvalidInput (Req 8.4)", async () => {
      process.env.REGION = "NA";
      const context: RequestContext = {
        apiName: "Transfers",
        apiVersion: "2024-06-01",
        operationId: "listExpectedPayouts",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: ["INVALID_MARKETPLACE_ID"] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].code).toBe("InvalidInput");
    });

    it("valid request passes validation and the handler returns 200 with { expectedPayouts } reflecting filtering and ordering (Req 6.1)", async () => {
      process.env.REGION = "NA";

      seedExpectedPayout("exp-b", "2024-02-02T00:00:00.000Z", NON_EU_MARKETPLACE_ID, "Standard Orders");
      seedExpectedPayout("exp-a", "2024-02-03T00:00:00.000Z", NON_EU_MARKETPLACE_ID, "Standard Orders");
      seedExpectedPayout("exp-c", "2024-02-01T00:00:00.000Z", NON_EU_MARKETPLACE_ID, "Standard Orders");
      // Different marketplace: must be filtered out.
      seedExpectedPayout("exp-other", "2024-02-04T00:00:00.000Z", "A2EUQ1WTGCTBG2", "Standard Orders");

      const queryParams = { marketplaceIds: [NON_EU_MARKETPLACE_ID] };
      const context: RequestContext = {
        apiName: "Transfers",
        apiVersion: "2024-06-01",
        operationId: "listExpectedPayouts",
        method: "GET",
        pathParams: {},
        queryParams,
        body: undefined,
      };

      const validationResult = await executeValidation(context);
      expect(validationResult.pass).toBe(true);

      const handler = requireHandler(LIST_EXPECTED_PAYOUTS_KEY);
      const handlerResult = await handler(validationPass("listExpectedPayouts", queryParams), req());

      expect(handlerResult.statusCode).toBe(200);
      const responseBody = handlerResult.data.body as { expectedPayouts: ExpectedPayoutRecord[]; nextToken?: string };
      expect(Array.isArray(responseBody.expectedPayouts)).toBe(true);

      // The other-marketplace record is filtered out; the three matches are
      // ordered by scheduledDate descending. Internal _key/_type are stripped
      // from the response, so ordering is asserted on the public scheduledDate.
      expect(responseBody.expectedPayouts.map((p) => p.scheduledDate)).toEqual([
        "2024-02-03T00:00:00.000Z",
        "2024-02-02T00:00:00.000Z",
        "2024-02-01T00:00:00.000Z",
      ]);
      // Internal bookkeeping fields never leak into the response.
      for (const payout of responseBody.expectedPayouts) {
        expect(payout).not.toHaveProperty("_key");
        expect(payout).not.toHaveProperty("_type");
      }
      expect(responseBody.nextToken).toBeUndefined();
    });
  });
});
