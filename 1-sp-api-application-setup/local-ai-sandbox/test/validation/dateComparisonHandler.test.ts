import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeValidation } from "../../src/service/validationEngine.js";
import { RequestContext, ValidationFail, ValidationPass, ValidationPipeline } from "../../src/validation/validationTypes.js";
import { VALIDATION_REGISTRY } from "../../src/validation/validationRegistry.js";
import { buildKey } from "../../src/registry/operationRegistry.js";

// Mock the validation registry so we can inject test pipelines
vi.mock("../../src/validation/validationRegistry.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/validation/validationRegistry.js")>();
  return {
    ...original,
    VALIDATION_REGISTRY: new Map(),
  };
});

// Mock the Context singleton (required by module but not used by dateComparison handler)
vi.mock("../../src/database/Context.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/database/Context.js")>();
  return {
    ...original,
    Context: {
      get instance() {
        return {
          db: {
            data: {},
          },
        };
      },
    },
  };
});

beforeEach(() => {
  VALIDATION_REGISTRY.clear();
});

// Test helper constants
const TEST_API_NAME = "TestApi";
const TEST_API_VERSION = "v1";
const TEST_OP = "__test_dateComparison__";

// Concrete ISO 8601 date strings
const EARLIER_DATE = "2024-01-01T00:00:00Z";
const LATER_DATE = "2024-06-15T12:00:00Z";

// Helper to create a dateComparison pipeline with param-based second operand
function makeDateParamPipeline(operator: "before" | "after" | "beforeOrEqual" | "afterOrEqual"): ValidationPipeline {
  return [
    {
      checkType: "dateComparison",
      firstOperand: { name: "startDate", source: "query" },
      secondOperand: { kind: "param", name: "endDate", source: "query" },
      operator,
      failAction: { statusCode: 400, code: "InvalidInput", message: `startDate must be ${operator} endDate` },
    },
  ];
}

// Helper to create a dateComparison pipeline with "now" second operand
function makeDateNowPipeline(operator: "before" | "after" | "beforeOrEqual" | "afterOrEqual"): ValidationPipeline {
  return [
    {
      checkType: "dateComparison",
      firstOperand: { name: "targetDate", source: "query" },
      secondOperand: { kind: "now" },
      operator,
      failAction: { statusCode: 400, code: "InvalidInput", message: `targetDate must be ${operator} now` },
    },
  ];
}

describe("dateComparison handler", () => {
  describe("before operator", () => {
    it("passes when firstDate is before secondDate", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("before"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: EARLIER_DATE, endDate: LATER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("fails when firstDate equals secondDate", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("before"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: EARLIER_DATE, endDate: EARLIER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
    });

    it("fails when firstDate is after secondDate", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("before"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: LATER_DATE, endDate: EARLIER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
    });
  });

  describe("after operator", () => {
    it("passes when firstDate is after secondDate", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("after"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: LATER_DATE, endDate: EARLIER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("fails when firstDate equals secondDate", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("after"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: EARLIER_DATE, endDate: EARLIER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
    });

    it("fails when firstDate is before secondDate", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("after"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: EARLIER_DATE, endDate: LATER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
    });
  });

  describe("beforeOrEqual operator", () => {
    it("passes when firstDate is before secondDate", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("beforeOrEqual"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: EARLIER_DATE, endDate: LATER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("passes when firstDate equals secondDate", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("beforeOrEqual"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: EARLIER_DATE, endDate: EARLIER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("fails when firstDate is after secondDate", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("beforeOrEqual"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: LATER_DATE, endDate: EARLIER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
    });
  });

  describe("afterOrEqual operator", () => {
    it("passes when firstDate is after secondDate", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("afterOrEqual"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: LATER_DATE, endDate: EARLIER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("passes when firstDate equals secondDate", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("afterOrEqual"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: EARLIER_DATE, endDate: EARLIER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("fails when firstDate is before secondDate", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("afterOrEqual"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: EARLIER_DATE, endDate: LATER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
    });
  });

  describe('"now" second operand', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("passes when firstDate is before now (using 'before' operator)", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateNowPipeline("before"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { targetDate: "2024-01-01T00:00:00Z" },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("fails when firstDate is after now (using 'before' operator)", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateNowPipeline("before"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { targetDate: "2025-01-01T00:00:00Z" },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
    });
  });

  describe("first operand absent (rule skips)", () => {
    it("passes when first operand is not in query params", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("before"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { endDate: LATER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
      expect((result as ValidationPass).resolvedEntities).toEqual({});
    });

    it("passes when first operand is empty string", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("before"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: "", endDate: LATER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });
  });

  describe("second operand param absent (rule skips)", () => {
    it("passes when second operand param is not in query params", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("before"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: EARLIER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
      expect((result as ValidationPass).resolvedEntities).toEqual({});
    });

    it("passes when second operand param is empty string", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("before"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: EARLIER_DATE, endDate: "" },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });
  });

  describe("unparseable first operand", () => {
    it("returns HTTP 400 with parameter name for invalid first date", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("before"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: "not-a-date", endDate: LATER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].message).toContain("startDate");
      expect(fail.body.errors[0].message).toContain("unparseable");
    });

    it("returns HTTP 400 for gibberish date format", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("after"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: "2024-13-45T99:99:99Z", endDate: LATER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].message).toContain("startDate");
    });
  });

  describe("unparseable second operand", () => {
    it("returns HTTP 400 with parameter name for invalid second date", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("before"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: EARLIER_DATE, endDate: "not-a-date" },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].message).toContain("endDate");
      expect(fail.body.errors[0].message).toContain("unparseable");
    });

    it("returns HTTP 400 for gibberish second date format", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("after"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: EARLIER_DATE, endDate: "2024-13-45T99:99:99Z" },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].message).toContain("endDate");
    });
  });

  describe("pass result structure", () => {
    it("returns { pass: true, resolvedEntities: {} } on successful comparison", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), makeDateParamPipeline("before"));

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { startDate: EARLIER_DATE, endDate: LATER_DATE },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result).toEqual({ pass: true, resolvedEntities: {} });
    });
  });
});
