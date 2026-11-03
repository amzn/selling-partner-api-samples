import { describe, it, expect, vi, afterEach } from "vitest";
import { executeValidation } from "../../src/service/validationEngine.js";
import { RequestContext, ValidationFail } from "../../src/validation/validationTypes.js";
import { OPERATIONS_REGISTRY } from "../../src/registry/operationRegistry.js";

// Mock the Context singleton: these are pure read handlers, so an empty engine
// (find → [], get → null) is enough to drive a 200 + response-shape check
// without seeding any FINANCES records. Mirrors the FBA Inventory integration test.
vi.mock("../../src/database/Context.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/database/Context.js")>();
  return {
    ...original,
    Context: {
      get instance() {
        return {
          engine: {
            get: () => null,
            find: () => [],
          },
        };
      },
    },
  };
});

const TRANSACTIONS_KEY = "Finances:2024-06-19:listTransactions";
const BALANCES_KEY = "Finances:2024-06-19:listBalances";
const SUMMARY_KEY = "Finances:2024-06-19:listSummary";

// A valid NA (default region) marketplace ID and a clearly invalid one.
const VALID_MARKETPLACE_ID = "ATVPDKIKX0DER";
const INVALID_MARKETPLACE_ID = "INVALID_MARKETPLACE_ID";

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
function validationPass(operationId: string, queryParams: Record<string, unknown>): Parameters<Handler>[0] {
  return {
    pass: true,
    operationId,
    apiName: "Finances",
    apiVersion: "2024-06-19",
    pathParams: {},
    queryParams,
    body: undefined,
    resolvedEntities: {},
    operation: {},
  } as never;
}

describe("Finances Integration Tests", () => {
  afterEach(() => {
    delete process.env.REGION;
  });

  // --- listTransactions (Requirements 3.1, 6.1, 7.1, 7.4, 7.7) ---
  describe("listTransactions", () => {
    it("handler is registered under its composite key as a function (Req 6.1)", () => {
      const handler = OPERATIONS_REGISTRY.get(TRANSACTIONS_KEY);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });

    it("rejects an invalid marketplaceId with 400 and code InvalidInput (Req 7.4)", async () => {
      delete process.env.REGION;
      const context: RequestContext = {
        apiName: "Finances",
        apiVersion: "2024-06-19",
        operationId: "listTransactions",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceId: INVALID_MARKETPLACE_ID },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].code).toBe("InvalidInput");
    });

    it("passes validation when a valid marketplaceId is provided (Req 7.7)", async () => {
      delete process.env.REGION;
      const context: RequestContext = {
        apiName: "Finances",
        apiVersion: "2024-06-19",
        operationId: "listTransactions",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceId: VALID_MARKETPLACE_ID },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("rejects a lone relatedIdentifierName (without relatedIdentifierValue) with 400 (Req 3.8)", async () => {
      const context: RequestContext = {
        apiName: "Finances",
        apiVersion: "2024-06-19",
        operationId: "listTransactions",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceId: VALID_MARKETPLACE_ID, relatedIdentifierName: "ORDER_ID" },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].code).toBe("InvalidInput");
    });

    it("valid request passes validation and the handler returns 200 with a payload.transactions array (Req 3.1)", async () => {
      delete process.env.REGION;
      const context: RequestContext = {
        apiName: "Finances",
        apiVersion: "2024-06-19",
        operationId: "listTransactions",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceId: VALID_MARKETPLACE_ID },
        body: undefined,
      };

      const validationResult = await executeValidation(context);
      expect(validationResult.pass).toBe(true);

      const handler = requireHandler(TRANSACTIONS_KEY);
      const handlerResult = await handler(validationPass("listTransactions", { marketplaceId: VALID_MARKETPLACE_ID }), {} as never);

      expect(handlerResult.statusCode).toBe(200);
      const body = handlerResult.data.body as Record<string, unknown>;
      expect(body).toHaveProperty("payload");
      const payload = body.payload as Record<string, unknown>;
      expect(payload).toHaveProperty("transactions");
      expect(Array.isArray(payload.transactions)).toBe(true);
    });
  });

  // --- listBalances (Requirements 4.1, 6.2, 7.2, 7.5, 7.7) ---
  describe("listBalances", () => {
    it("handler is registered under its composite key as a function (Req 6.2)", () => {
      const handler = OPERATIONS_REGISTRY.get(BALANCES_KEY);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });

    it("rejects an invalid marketplaceIds value with 400 and code InvalidInput (Req 7.5)", async () => {
      delete process.env.REGION;
      const context: RequestContext = {
        apiName: "Finances",
        apiVersion: "2024-06-19",
        operationId: "listBalances",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: [INVALID_MARKETPLACE_ID] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].code).toBe("InvalidInput");
    });

    it("passes validation when a valid marketplaceIds value is provided (Req 7.7)", async () => {
      delete process.env.REGION;
      const context: RequestContext = {
        apiName: "Finances",
        apiVersion: "2024-06-19",
        operationId: "listBalances",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: [VALID_MARKETPLACE_ID] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("valid request passes validation and the handler returns 200 with a flat balances array (Req 4.1)", async () => {
      delete process.env.REGION;
      const context: RequestContext = {
        apiName: "Finances",
        apiVersion: "2024-06-19",
        operationId: "listBalances",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: [VALID_MARKETPLACE_ID] },
        body: undefined,
      };

      const validationResult = await executeValidation(context);
      expect(validationResult.pass).toBe(true);

      const handler = requireHandler(BALANCES_KEY);
      const handlerResult = await handler(validationPass("listBalances", { marketplaceIds: [VALID_MARKETPLACE_ID] }), {} as never);

      expect(handlerResult.statusCode).toBe(200);
      const body = handlerResult.data.body as Record<string, unknown>;
      expect(body).toHaveProperty("balances");
      expect(Array.isArray(body.balances)).toBe(true);
    });
  });

  // --- listSummary (Requirements 5.1, 6.3, 7.3, 7.6, 7.7) ---
  describe("listSummary", () => {
    it("handler is registered under its composite key as a function (Req 6.3)", () => {
      const handler = OPERATIONS_REGISTRY.get(SUMMARY_KEY);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });

    it("rejects an invalid marketplaceIds value with 400 and code InvalidInput (Req 7.6)", async () => {
      delete process.env.REGION;
      const context: RequestContext = {
        apiName: "Finances",
        apiVersion: "2024-06-19",
        operationId: "listSummary",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: [INVALID_MARKETPLACE_ID] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].code).toBe("InvalidInput");
    });

    it("passes validation when a valid marketplaceIds value is provided (Req 7.7)", async () => {
      delete process.env.REGION;
      const context: RequestContext = {
        apiName: "Finances",
        apiVersion: "2024-06-19",
        operationId: "listSummary",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: [VALID_MARKETPLACE_ID] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("rejects a lone relatedIdentifierName (without relatedIdentifierValue) with 400 (Req 5.4 / together-rule)", async () => {
      const context: RequestContext = {
        apiName: "Finances",
        apiVersion: "2024-06-19",
        operationId: "listSummary",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: [VALID_MARKETPLACE_ID], relatedIdentifierName: "SETTLEMENT_ID" },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].code).toBe("InvalidInput");
    });

    it("valid request passes validation and the handler returns 200 with a flat summaries array (Req 5.1)", async () => {
      delete process.env.REGION;
      const context: RequestContext = {
        apiName: "Finances",
        apiVersion: "2024-06-19",
        operationId: "listSummary",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: [VALID_MARKETPLACE_ID] },
        body: undefined,
      };

      const validationResult = await executeValidation(context);
      expect(validationResult.pass).toBe(true);

      const handler = requireHandler(SUMMARY_KEY);
      const handlerResult = await handler(validationPass("listSummary", { marketplaceIds: [VALID_MARKETPLACE_ID] }), {} as never);

      expect(handlerResult.statusCode).toBe(200);
      const body = handlerResult.data.body as Record<string, unknown>;
      expect(body).toHaveProperty("summaries");
      expect(Array.isArray(body.summaries)).toBe(true);
    });
  });
});
