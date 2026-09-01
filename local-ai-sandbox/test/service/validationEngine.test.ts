import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeValidation, registerRuleHandler } from "../../src/service/validationEngine.js";
import { RequestContext, ValidationFail, ValidationPipeline, ValidationResult, ValidationRule } from "../../src/validation/validationTypes.js";
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

// Mock the Context singleton so database access uses a controlled mock
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

describe("Validation Engine Pipeline Execution", () => {
  beforeEach(() => {
    VALIDATION_REGISTRY.clear();
  });

  it("empty pipeline returns pass", async () => {
    const operationId = "emptyPipelineOp";
    VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", operationId), [] as ValidationPipeline);

    const context: RequestContext = {
      apiName: "TestApi",
      apiVersion: "v1",
      operationId,
      method: "GET",
      pathParams: {},
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result).toEqual({ pass: true, resolvedEntities: {} });
  });

  it("unregistered operationId returns failure", async () => {
    const context: RequestContext = {
      apiName: "UnknownApi",
      apiVersion: "v99",
      operationId: "nonExistentOperation_xyz_12345",
      method: "GET",
      pathParams: {},
      queryParams: {},
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.statusCode).toBe(501);
      expect(result.body?.errors[0].code).toBe("NoValidationPipeline");
      expect(result.body?.errors[0].message).toContain("UnknownApi:v99:nonExistentOperation_xyz_12345");
    }
  });

  it("executes rules in order and short-circuits on first failure", async () => {
    const operationId = "shortCircuitOp";

    // Create 3 atLeastOneRequired rules with unique param names per rule
    const pipeline: ValidationPipeline = [
      {
        checkType: "atLeastOneRequired",
        params: [{ name: "paramA", source: "query" }],
        failAction: { statusCode: 400, code: "MissingA", message: "paramA is required" },
      },
      {
        checkType: "atLeastOneRequired",
        params: [{ name: "paramB", source: "query" }],
        failAction: { statusCode: 400, code: "MissingB", message: "paramB is required" },
      },
      {
        checkType: "atLeastOneRequired",
        params: [{ name: "paramC", source: "query" }],
        failAction: { statusCode: 400, code: "MissingC", message: "paramC is required" },
      },
    ];

    VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", operationId), pipeline);

    // Provide paramA and paramB but NOT paramC — rule at index 2 should fail
    const context: RequestContext = {
      apiName: "TestApi",
      apiVersion: "v1",
      operationId,
      method: "GET",
      pathParams: {},
      queryParams: { paramA: "value1", paramB: "value2" },
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result.pass).toBe(false);

    const failResult = result as ValidationFail;
    expect(failResult.statusCode).toBe(400);
    expect(failResult.body.errors[0].code).toBe("MissingC");
    expect(failResult.body.errors[0].message).toContain("paramC");
  });

  it("custom handler registration via registerRuleHandler", async () => {
    const operationId = "customHandlerOp";
    const customCheckType = "customCheck";

    // Register a custom handler that passes if body has a "token" field
    const customHandler = vi.fn(async (rule: ValidationRule, context: RequestContext, _resolvedEntities: Record<string, Record<string, unknown>>): Promise<ValidationResult> => {
      if (context.body && "token" in context.body) {
        return { pass: true, resolvedEntities: {} };
      }
      return {
        pass: false,
        statusCode: 401,
        body: { errors: [{ code: "Unauthorized", message: "Token is required" }] },
      };
    });

    registerRuleHandler(customCheckType, customHandler);

    // Create a pipeline that uses the custom check type
    const pipeline: ValidationPipeline = [
      {
        checkType: customCheckType,
        failAction: { statusCode: 401, code: "Unauthorized", message: "Token is required" },
      } as unknown as ValidationRule,
    ];

    VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", operationId), pipeline);

    // Test with token present — should pass
    const contextWithToken: RequestContext = {
      apiName: "TestApi",
      apiVersion: "v1",
      operationId,
      method: "POST",
      pathParams: {},
      queryParams: {},
      body: { token: "abc123" },
    };

    const passResult = await executeValidation(contextWithToken);
    expect(passResult.pass).toBe(true);
    expect(customHandler).toHaveBeenCalledTimes(1);

    // Test without token — should fail
    const contextWithoutToken: RequestContext = {
      apiName: "TestApi",
      apiVersion: "v1",
      operationId,
      method: "POST",
      pathParams: {},
      queryParams: {},
      body: {},
    };

    const failResult = await executeValidation(contextWithoutToken);
    expect(failResult.pass).toBe(false);
    expect(customHandler).toHaveBeenCalledTimes(2);

    if (!failResult.pass) {
      expect(failResult.statusCode).toBe(401);
      expect(failResult.body.errors[0].code).toBe("Unauthorized");
    }
  });

  it("all rules pass returns overall pass", async () => {
    const operationId = "allPassOp";

    // Create pipeline with 2 atLeastOneRequired rules
    const pipeline: ValidationPipeline = [
      {
        checkType: "atLeastOneRequired",
        params: [{ name: "alpha", source: "query" }],
        failAction: { statusCode: 400, code: "MissingAlpha", message: "alpha is required" },
      },
      {
        checkType: "atLeastOneRequired",
        params: [{ name: "beta", source: "query" }],
        failAction: { statusCode: 400, code: "MissingBeta", message: "beta is required" },
      },
    ];

    VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", operationId), pipeline);

    // Provide all required params
    const context: RequestContext = {
      apiName: "TestApi",
      apiVersion: "v1",
      operationId,
      method: "GET",
      pathParams: {},
      queryParams: { alpha: "val1", beta: "val2" },
      body: undefined,
    };

    const result = await executeValidation(context);
    expect(result).toEqual({ pass: true, resolvedEntities: {} });
  });
});
