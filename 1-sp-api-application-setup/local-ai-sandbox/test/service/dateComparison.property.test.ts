import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { executeValidation } from "../../src/service/validationEngine.js";
import { DateComparisonRule, RequestContext, ValidationFail, ValidationPipeline } from "../../src/validation/validationTypes.js";
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

// Mock the Context singleton (not used directly by dateComparison but required by module)
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

/**
 * Feature: deterministic-validation-system
 * Property 18: Date comparison semantics
 *
 * For any date comparison rule with a given operator (before, after, beforeOrEqual, afterOrEqual)
 * and any two valid ISO 8601 date-time values extracted from the request context (or "now" as the
 * second operand), the rule passes if and only if the relational comparison holds between the first
 * and second date values. If the first date operand is absent from the request context, the rule
 * skips (passes). If the second date operand is a parameter reference that is absent from the
 * request context, the rule skips (passes). If either extracted date string cannot be parsed as a
 * valid ISO 8601 date-time, the rule returns HTTP 400 identifying the parameter with the
 * unparseable value.
 *
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7**
 */
describe("Feature: deterministic-validation-system, Property 18: Date comparison semantics", () => {
  const TEST_OPERATION_ID = "__test_dateComparison__";

  beforeEach(() => {
    VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
  });

  // Helper: generate a valid ISO 8601 date-time string within a reasonable range
  // Use integer timestamps to avoid fast-check generating invalid Date objects
  const isoDateArb = fc
    .integer({ min: new Date("2000-01-01T00:00:00Z").getTime(), max: new Date("2030-12-31T23:59:59Z").getTime() })
    .map((ts) => new Date(ts).toISOString());

  // Helper: operator arbitrary
  const operatorArb = fc.constantFrom("before" as const, "after" as const, "beforeOrEqual" as const, "afterOrEqual" as const);

  // Helper: source arbitrary
  const sourceArb = fc.constantFrom("path" as const, "query" as const, "body" as const);

  // Helper: param name arbitrary (valid identifier style)
  const paramNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/);

  // Helper: build a DateComparisonRule
  function buildRule(
    firstOperandName: string,
    firstOperandSource: "path" | "query" | "body",
    secondOperand: DateComparisonRule["secondOperand"],
    operator: DateComparisonRule["operator"],
  ): DateComparisonRule {
    return {
      checkType: "dateComparison",
      firstOperand: { name: firstOperandName, source: firstOperandSource },
      secondOperand,
      operator,
      failAction: {
        statusCode: 400,
        code: "InvalidDateRange",
        message: "Date comparison failed",
      },
    };
  }

  // Helper: evaluate operator semantics
  function evaluateOperator(operator: DateComparisonRule["operator"], first: Date, second: Date): boolean {
    switch (operator) {
      case "before":
        return first < second;
      case "after":
        return first > second;
      case "beforeOrEqual":
        return first <= second;
      case "afterOrEqual":
        return first >= second;
    }
  }

  // Helper: set param value in context based on source
  function setParam(
    context: { pathParams: Record<string, string>; queryParams: Record<string, string | string[] | undefined>; body: Record<string, unknown> | undefined },
    name: string,
    source: "path" | "query" | "body",
    value: string,
  ): void {
    switch (source) {
      case "path":
        context.pathParams[name] = value;
        break;
      case "query":
        context.queryParams[name] = value;
        break;
      case "body":
        if (!context.body) context.body = {};
        context.body[name] = value;
        break;
    }
  }

  it("Property 18: Valid date pairs with each operator → verify pass iff comparison holds", async () => {
    await fc.assert(
      fc.asyncProperty(
        paramNameArb, // firstOperand name
        sourceArb, // firstOperand source
        paramNameArb, // secondOperand name
        sourceArb, // secondOperand source
        isoDateArb, // first date value
        isoDateArb, // second date value
        operatorArb, // operator
        async (firstName, firstSource, secondName, secondSource, firstDateStr, secondDateStr, operator) => {
          // Ensure param names are different to avoid collision
          fc.pre(firstName !== secondName || firstSource !== secondSource);

          const rule = buildRule(firstName, firstSource, { kind: "param", name: secondName, source: secondSource }, operator);

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          const pathParams: Record<string, string> = {};
          const queryParams: Record<string, string | string[] | undefined> = {};
          let body: Record<string, unknown> | undefined = undefined;
          const contextBuilder = { pathParams, queryParams, body };

          setParam(contextBuilder, firstName, firstSource, firstDateStr);
          setParam(contextBuilder, secondName, secondSource, secondDateStr);

          const context: RequestContext = {
            apiName: "TestApi",
            apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: contextBuilder.pathParams,
            queryParams: contextBuilder.queryParams,
            body: contextBuilder.body,
          };

          const result = await executeValidation(context);

          // Determine expected outcome
          const firstDate = new Date(firstDateStr);
          const secondDate = new Date(secondDateStr);
          const shouldPass = evaluateOperator(operator, firstDate, secondDate);

          if (shouldPass) {
            expect(result.pass).toBe(true);
          } else {
            expect(result.pass).toBe(false);
            const failResult = result as ValidationFail;
            expect(failResult.statusCode).toBe(400);
          }

          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 18: First operand absent → always passes (rule skips)", async () => {
    await fc.assert(
      fc.asyncProperty(
        paramNameArb, // firstOperand name
        sourceArb, // firstOperand source
        paramNameArb, // secondOperand name
        sourceArb, // secondOperand source
        isoDateArb, // second date value (present but doesn't matter)
        operatorArb, // operator
        async (firstName, firstSource, secondName, secondSource, secondDateStr, operator) => {
          fc.pre(firstName !== secondName || firstSource !== secondSource);

          const rule = buildRule(firstName, firstSource, { kind: "param", name: secondName, source: secondSource }, operator);

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          // First operand is NOT present in context; second operand IS present
          const pathParams: Record<string, string> = {};
          const queryParams: Record<string, string | string[] | undefined> = {};
          let body: Record<string, unknown> | undefined = undefined;
          const contextBuilder = { pathParams, queryParams, body };

          // Only set the second operand
          setParam(contextBuilder, secondName, secondSource, secondDateStr);

          const context: RequestContext = {
            apiName: "TestApi",
            apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: contextBuilder.pathParams,
            queryParams: contextBuilder.queryParams,
            body: contextBuilder.body,
          };

          const result = await executeValidation(context);
          // Should always pass because first operand is absent
          expect(result.pass).toBe(true);

          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 18: Second operand (param kind) absent → always passes (rule skips)", async () => {
    await fc.assert(
      fc.asyncProperty(
        paramNameArb, // firstOperand name
        sourceArb, // firstOperand source
        paramNameArb, // secondOperand name
        sourceArb, // secondOperand source
        isoDateArb, // first date value (present)
        operatorArb, // operator
        async (firstName, firstSource, secondName, secondSource, firstDateStr, operator) => {
          fc.pre(firstName !== secondName || firstSource !== secondSource);

          const rule = buildRule(firstName, firstSource, { kind: "param", name: secondName, source: secondSource }, operator);

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          // First operand IS present; second operand is NOT present
          const pathParams: Record<string, string> = {};
          const queryParams: Record<string, string | string[] | undefined> = {};
          let body: Record<string, unknown> | undefined = undefined;
          const contextBuilder = { pathParams, queryParams, body };

          // Only set the first operand
          setParam(contextBuilder, firstName, firstSource, firstDateStr);

          const context: RequestContext = {
            apiName: "TestApi",
            apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: contextBuilder.pathParams,
            queryParams: contextBuilder.queryParams,
            body: contextBuilder.body,
          };

          const result = await executeValidation(context);
          // Should always pass because second operand (param kind) is absent
          expect(result.pass).toBe(true);

          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 18: Unparseable date strings → HTTP 400 identifying the offending parameter", async () => {
    // Strings that are definitely NOT valid dates
    const unparseableDateArb = fc.constantFrom("not-a-date", "abc123", "2024-13-45", "yesterday", "foo/bar/baz", "99:99:99");

    await fc.assert(
      fc.asyncProperty(
        paramNameArb, // firstOperand name
        sourceArb, // firstOperand source
        paramNameArb, // secondOperand name
        sourceArb, // secondOperand source
        operatorArb, // operator
        fc.constantFrom("first" as const, "second" as const), // which operand is unparseable
        unparseableDateArb, // the bad date string
        isoDateArb, // a valid date for the other operand
        async (firstName, firstSource, secondName, secondSource, operator, badOperand, badDateStr, validDateStr) => {
          fc.pre(firstName !== secondName || firstSource !== secondSource);

          const rule = buildRule(firstName, firstSource, { kind: "param", name: secondName, source: secondSource }, operator);

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          const pathParams: Record<string, string> = {};
          const queryParams: Record<string, string | string[] | undefined> = {};
          let body: Record<string, unknown> | undefined = undefined;
          const contextBuilder = { pathParams, queryParams, body };

          if (badOperand === "first") {
            setParam(contextBuilder, firstName, firstSource, badDateStr);
            setParam(contextBuilder, secondName, secondSource, validDateStr);
          } else {
            setParam(contextBuilder, firstName, firstSource, validDateStr);
            setParam(contextBuilder, secondName, secondSource, badDateStr);
          }

          const context: RequestContext = {
            apiName: "TestApi",
            apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: contextBuilder.pathParams,
            queryParams: contextBuilder.queryParams,
            body: contextBuilder.body,
          };

          const result = await executeValidation(context);

          // Should fail with HTTP 400
          expect(result.pass).toBe(false);
          const failResult = result as ValidationFail;
          expect(failResult.statusCode).toBe(400);
          expect(failResult.body.errors).toHaveLength(1);

          // Error message should identify the offending parameter name
          const offendingParamName = badOperand === "first" ? firstName : secondName;
          expect(failResult.body.errors[0].message).toContain(offendingParamName);
          // Should mention unparseable/ISO 8601
          expect(failResult.body.errors[0].message).toContain("unparseable");

          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 18: "now" as second operand → comparison uses current system time', async () => {
    await fc.assert(
      fc.asyncProperty(
        paramNameArb, // firstOperand name
        sourceArb, // firstOperand source
        operatorArb, // operator
        // Generate a date that is definitely in the past (before current time)
        fc.constantFrom("past" as const, "future" as const),
        async (firstName, firstSource, operator, timeRelation) => {
          const rule = buildRule(firstName, firstSource, { kind: "now" }, operator);

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          // Generate a date that is clearly in the past or future
          const now = new Date();
          let firstDateStr: string;
          if (timeRelation === "past") {
            // 1 day ago
            const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            firstDateStr = pastDate.toISOString();
          } else {
            // 1 day from now
            const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            firstDateStr = futureDate.toISOString();
          }

          const pathParams: Record<string, string> = {};
          const queryParams: Record<string, string | string[] | undefined> = {};
          let body: Record<string, unknown> | undefined = undefined;
          const contextBuilder = { pathParams, queryParams, body };

          setParam(contextBuilder, firstName, firstSource, firstDateStr);

          const context: RequestContext = {
            apiName: "TestApi",
            apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: contextBuilder.pathParams,
            queryParams: contextBuilder.queryParams,
            body: contextBuilder.body,
          };

          const result = await executeValidation(context);

          // Determine expected result based on time relation and operator
          const firstDate = new Date(firstDateStr);
          // "now" is approximately the current time; since we use 1-day offsets, this is reliable
          const isBeforeNow = timeRelation === "past";
          const isAfterNow = timeRelation === "future";

          let shouldPass: boolean;
          switch (operator) {
            case "before":
              shouldPass = isBeforeNow;
              break;
            case "after":
              shouldPass = isAfterNow;
              break;
            case "beforeOrEqual":
              shouldPass = isBeforeNow;
              break;
            case "afterOrEqual":
              shouldPass = isAfterNow;
              break;
          }

          if (shouldPass) {
            expect(result.pass).toBe(true);
          } else {
            expect(result.pass).toBe(false);
            const failResult = result as ValidationFail;
            expect(failResult.statusCode).toBe(400);
          }

          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        },
      ),
      { numRuns: 100 },
    );
  });
});
