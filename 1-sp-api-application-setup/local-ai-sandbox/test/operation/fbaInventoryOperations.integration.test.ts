import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeValidation } from "../../src/service/validationEngine.js";
import { RequestContext, ValidationFail } from "../../src/validation/validationTypes.js";
import { VALIDATION_REGISTRY } from "../../src/validation/validationRegistry.js";
import { buildKey, OPERATIONS_REGISTRY } from "../../src/registry/operationRegistry.js";

// Mock the Context singleton (needed by the validation engine but not exercised by these tests)
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

const FBA_KEY = "FBA Inventory:v1:getInventorySummaries";

describe("FBA Inventory getInventorySummaries Integration Tests", () => {
  describe("OPERATIONS_REGISTRY registration", () => {
    it("handler is registered with correct composite key", () => {
      const handler = OPERATIONS_REGISTRY.get(FBA_KEY);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });
  });

  describe("Validation pipeline rejects invalid marketplace IDs with 400", () => {
    afterEach(() => {
      delete process.env.REGION;
    });

    it("rejects an invalid marketplace ID for NA region (default) with 400 and code InvalidInput", async () => {
      delete process.env.REGION;

      const context: RequestContext = {
        apiName: "FBA Inventory",
        apiVersion: "v1",
        operationId: "getInventorySummaries",
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
      expect(fail.body.errors[0].message).toContain("INVALID_MARKETPLACE_ID");
    });

    it("rejects an EU marketplace ID in NA region with 400", async () => {
      delete process.env.REGION;

      const context: RequestContext = {
        apiName: "FBA Inventory",
        apiVersion: "v1",
        operationId: "getInventorySummaries",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: ["A1F83G8C2ARO7P"] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].code).toBe("InvalidInput");
    });

    it("passes validation when a valid NA marketplace ID is provided", async () => {
      delete process.env.REGION;

      const context: RequestContext = {
        apiName: "FBA Inventory",
        apiVersion: "v1",
        operationId: "getInventorySummaries",
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: ["ATVPDKIKX0DER"] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });
  });

  describe("Validation pipeline rejects startDateTime older than 18 months", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("rejects startDateTime older than 18 months with 400 and code InvalidInput", async () => {
      // 19 months ago from the fake now (2024-06-15) is well before the 18-month boundary
      const tooOldDate = new Date(Date.now() - 19 * 30 * 24 * 60 * 60 * 1000).toISOString();

      const context: RequestContext = {
        apiName: "FBA Inventory",
        apiVersion: "v1",
        operationId: "getInventorySummaries",
        method: "GET",
        pathParams: {},
        queryParams: {
          marketplaceIds: ["ATVPDKIKX0DER"],
          startDateTime: tooOldDate,
        },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].code).toBe("InvalidInput");
      expect(fail.body.errors[0].message).toContain("startDateTime");
    });

    it("passes when startDateTime is within the 18-month window", async () => {
      // 3 months ago — well within the 18-month window
      const recentDate = new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000).toISOString();

      const context: RequestContext = {
        apiName: "FBA Inventory",
        apiVersion: "v1",
        operationId: "getInventorySummaries",
        method: "GET",
        pathParams: {},
        queryParams: {
          marketplaceIds: ["ATVPDKIKX0DER"],
          startDateTime: recentDate,
        },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("rejects when startDateTime is exactly at the 18-month boundary (boundary test)", async () => {
      // Exactly 18 months + 1ms ago should fail (just barely too old)
      const boundaryDate = new Date(Date.now() - (18 * 30 * 24 * 60 * 60 * 1000) - 1).toISOString();

      const context: RequestContext = {
        apiName: "FBA Inventory",
        apiVersion: "v1",
        operationId: "getInventorySummaries",
        method: "GET",
        pathParams: {},
        queryParams: {
          marketplaceIds: ["ATVPDKIKX0DER"],
          startDateTime: boundaryDate,
        },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].code).toBe("InvalidInput");
    });
  });

  describe("End-to-end request flow from validation to handler response", () => {
    it("valid request passes validation and handler returns 200 with correct response shape", async () => {
      // First verify the validation pipeline passes for a valid request
      const context: RequestContext = {
        apiName: "FBA Inventory",
        apiVersion: "v1",
        operationId: "getInventorySummaries",
        method: "GET",
        pathParams: {},
        queryParams: {
          marketplaceIds: ["ATVPDKIKX0DER"],
          granularityType: "Marketplace",
          granularityId: "ATVPDKIKX0DER",
        },
        body: undefined,
      };

      const validationResult = await executeValidation(context);
      expect(validationResult.pass).toBe(true);

      // Then invoke the handler directly (as the controller would do after validation passes)
      const handler = OPERATIONS_REGISTRY.get(FBA_KEY);
      expect(handler).toBeDefined();

      const handlerResult = await handler!(
        {
          pass: true,
          operationId: "getInventorySummaries",
          apiName: "FBA Inventory",
          apiVersion: "v1",
          pathParams: {},
          queryParams: {
            marketplaceIds: ["ATVPDKIKX0DER"],
            granularityType: "Marketplace",
            granularityId: "ATVPDKIKX0DER",
          },
          body: undefined,
          resolvedEntities: {},
          operation: {},
        },
        {} as any,
      );

      expect(handlerResult.statusCode).toBe(200);
      const body = handlerResult.data.body as Record<string, unknown>;
      expect(body).toHaveProperty("payload");
      const payload = body.payload as Record<string, unknown>;
      expect(payload).toHaveProperty("granularity");
      expect(payload).toHaveProperty("inventorySummaries");
      expect(payload.granularity).toEqual({
        granularityType: "Marketplace",
        granularityId: "ATVPDKIKX0DER",
      });
      expect(Array.isArray(payload.inventorySummaries)).toBe(true);
    });

    it("invalid marketplace ID is rejected at validation before handler executes", async () => {
      const context: RequestContext = {
        apiName: "FBA Inventory",
        apiVersion: "v1",
        operationId: "getInventorySummaries",
        method: "GET",
        pathParams: {},
        queryParams: {
          marketplaceIds: ["COMPLETELY_FAKE_ID"],
          granularityType: "Marketplace",
          granularityId: "ATVPDKIKX0DER",
          startDateTime: new Date().toISOString(),
        },
        body: undefined,
      };

      const validationResult = await executeValidation(context);
      // Marketplace validation fires FIRST (before dateComparison), so it should fail here
      expect(validationResult.pass).toBe(false);
      const fail = validationResult as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].code).toBe("InvalidInput");
      expect(fail.body.errors[0].message).toContain("COMPLETELY_FAKE_ID");
    });
  });
});
