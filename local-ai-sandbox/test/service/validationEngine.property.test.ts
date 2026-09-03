import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { resolveParam, executeValidation } from "../../src/service/validationEngine.js";
import { AtLeastOneRequiredRule, EntityExistenceRule, MutualExclusivityRule, RequestContext, ValidationFail, ValidationPipeline } from "../../src/validation/validationTypes.js";
import { VALIDATION_REGISTRY } from "../../src/validation/validationRegistry.js";
import { Api } from "../../src/database/Context.js";

// Mutable mock database state — tests can populate this before assertions
const mockDbData: Record<string, Record<string, unknown>> = {};

// Mock the validation registry so we can inject test pipelines
vi.mock("../../src/validation/validationRegistry.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/validation/validationRegistry.js")>();
  return {
    ...original,
    VALIDATION_REGISTRY: new Map(),
  };
});

// Mock the Context singleton so database access uses our mutable mockDbData
vi.mock("../../src/database/Context.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/database/Context.js")>();
  return {
    ...original,
    Context: {
      get instance() {
        return {
          engine: {
            get: (api: string, key: string) => {
              const partition = mockDbData[api];
              if (!partition || !Object.hasOwn(partition, key)) return null;
              return partition[key] ?? null;
            },
          },
        };
      },
    },
  };
});

describe("Feature: deterministic-validation-system", () => {
  /**
   * **Validates: Requirements 1.3, 1.5**
   */
  it("Property 1: Parameter resolution correctness", () => {
    const sourceArb = fc.constantFrom("path" as const, "query" as const, "body" as const);

    const requestContextArb = fc.record({
      apiName: fc.string(),
      apiVersion: fc.string(),
      operationId: fc.string(),
      method: fc.constantFrom("GET", "POST", "PUT", "DELETE", "PATCH"),
      pathParams: fc.dictionary(fc.string(), fc.string()),
      queryParams: fc.dictionary(fc.string(), fc.string()),
      body: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: undefined }),
    }) as fc.Arbitrary<RequestContext>;

    const paramNameArb = fc.string();

    fc.assert(
      fc.property(requestContextArb, paramNameArb, sourceArb, (context, name, source) => {
        // resolveParam should never throw regardless of input
        let result: unknown;
        expect(() => {
          result = resolveParam(context, name, source);
        }).not.toThrow();

        // Verify correctness: returns the correct value when present, undefined when absent.
        // Presence is checked via Object.hasOwn (own properties only) to match resolveParam's
        // contract, which deliberately ignores inherited Object.prototype members (e.g. "toString",
        // "constructor") so they are never mistaken for actual request data.
        switch (source) {
          case "path":
            if (Object.hasOwn(context.pathParams, name)) {
              expect(result).toBe(context.pathParams[name]);
            } else {
              expect(result).toBeUndefined();
            }
            break;
          case "query":
            if (Object.hasOwn(context.queryParams, name)) {
              expect(result).toBe(context.queryParams[name]);
            } else {
              expect(result).toBeUndefined();
            }
            break;
          case "body":
            if (context.body !== undefined && Object.hasOwn(context.body, name)) {
              expect(result).toBe(context.body[name]);
            } else {
              expect(result).toBeUndefined();
            }
            break;
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.4, 3.5**
   */
  it("Property 5: At-least-one-required semantics", async () => {
    const TEST_OPERATION_ID = "__test_atLeastOneRequired__";

    // Generate 1-5 unique param names (non-empty alphanumeric strings)
    const paramNamesArb = fc
      .uniqueArray(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/), { minLength: 1, maxLength: 5 })
      .filter((names) => names.length >= 1);

    // Decide whether some params have values (true) or none do (false)
    const hasPresentArb = fc.boolean();

    // Index used to determine how many params are present (replaces Math.random())
    const presentCountArb = fc.nat();

    await fc.assert(
      fc.asyncProperty(paramNamesArb, hasPresentArb, presentCountArb, fc.context(), async (paramNames, hasPresent, presentCountSeed, ctx) => {
        // Build the atLeastOneRequired rule
        const rule: AtLeastOneRequiredRule = {
          checkType: "atLeastOneRequired",
          params: paramNames.map((name) => ({ name, source: "query" as const })),
          failAction: {
            statusCode: 400,
            code: "InvalidInput",
            message: `At least one of '${paramNames.join("', '")}' must be provided`,
          },
        };

        // Register the test pipeline in the mocked registry
        VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

        try {
          if (hasPresent) {
            // Pick a random subset (at least 1) of param names to have values
            const presentCount = Math.max(1, (presentCountSeed % paramNames.length) + 1);
            const presentNames = paramNames.slice(0, presentCount);

            const queryParams: Record<string, string> = {};
            for (const name of presentNames) {
              queryParams[name] = "some-value";
            }

            const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
              method: "GET",
              pathParams: {},
              queryParams,
              body: undefined,
            };

            ctx.log(`Testing with ${presentNames.length} present params: ${presentNames.join(", ")}`);

            const result = await executeValidation(context);
            expect(result.pass).toBe(true);
          } else {
            // None of the params are present
            const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
              method: "GET",
              pathParams: {},
              queryParams: {},
              body: undefined,
            };

            ctx.log(`Testing with 0 present params from: ${paramNames.join(", ")}`);

            const result = await executeValidation(context);
            expect(result.pass).toBe(false);

            const failResult = result as ValidationFail;
            expect(failResult.statusCode).toBe(400);

            // Verify the message lists all param names
            const message = failResult.body.errors[0].message;
            for (const name of paramNames) {
              expect(message).toContain(name);
            }
          }
        } finally {
          // Cleanup
          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        }
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 4: Mutual exclusivity semantics
 *
 * For any mutual exclusivity rule with N parameters and any request context,
 * the rule passes if and only if exactly one of the N parameters is present
 * and non-empty in the context. If zero are present, the failure message lists
 * all N parameter names as required options. If more than one are present,
 * the failure message identifies the conflicting parameter names.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 */
describe("Feature: deterministic-validation-system, Property 4: Mutual exclusivity semantics", () => {
  const TEST_OPERATION_ID = "__test_mutualExclusivity__";

  beforeEach(() => {
    VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
  });

  it("Property 4: Passes when exactly one parameter is present", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate N param names (N >= 2, unique, valid identifiers)
        fc.uniqueArray(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/), { minLength: 2, maxLength: 6 }),
        // Generate a non-empty value for the present param
        fc.string({ minLength: 1, maxLength: 20 }),
        // Index of which param to make present
        fc.nat(),
        async (paramNames, value, presentIdx) => {
          const rule: MutualExclusivityRule = {
            checkType: "mutualExclusivity",
            params: paramNames.map((name) => ({ name, source: "query" as const })),
            failAction: {
              statusCode: 400,
              code: "InvalidInput",
              message: `Exactly one of '${paramNames.join(", ")}' must be provided`,
            },
          };

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          // Only one param is present
          const chosenParam = paramNames[presentIdx % paramNames.length];
          const queryParams: Record<string, string> = { [chosenParam]: value };

          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: {},
            queryParams,
            body: undefined,
          };

          const result = await executeValidation(context);
          expect(result.pass).toBe(true);

          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 4: Fails with 400 when zero parameters are present", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate N param names (N >= 2, unique, valid identifiers)
        fc.uniqueArray(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/), { minLength: 2, maxLength: 6 }),
        async (paramNames) => {
          const rule: MutualExclusivityRule = {
            checkType: "mutualExclusivity",
            params: paramNames.map((name) => ({ name, source: "query" as const })),
            failAction: {
              statusCode: 400,
              code: "InvalidInput",
              message: `Exactly one of '${paramNames.join(", ")}' must be provided`,
            },
          };

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          // No params present — empty query
          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: {},
            queryParams: {},
            body: undefined,
          };

          const result = await executeValidation(context);
          expect(result.pass).toBe(false);

          const failResult = result as ValidationFail;
          expect(failResult.statusCode).toBe(400);
          expect(failResult.body.errors).toHaveLength(1);

          // Message should list all param names as required options
          const message = failResult.body.errors[0].message;
          for (const name of paramNames) {
            expect(message).toContain(name);
          }

          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 4: Fails with 400 when more than one parameter is present", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate N param names (N >= 2, unique, valid identifiers)
        fc.uniqueArray(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/), { minLength: 2, maxLength: 6 }),
        // Generate non-empty values
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        // How many extra params to set (at least 2 total present)
        fc.nat({ max: 4 }),
        async (paramNames, value1, value2, extraCount) => {
          const rule: MutualExclusivityRule = {
            checkType: "mutualExclusivity",
            params: paramNames.map((name) => ({ name, source: "query" as const })),
            failAction: {
              statusCode: 400,
              code: "InvalidInput",
              message: `Exactly one of '${paramNames.join(", ")}' must be provided`,
            },
          };

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          // Set at least 2 params present
          const numPresent = Math.min(2 + (extraCount % (paramNames.length - 1)), paramNames.length);
          const presentNames = paramNames.slice(0, numPresent);
          const queryParams: Record<string, string> = {};
          queryParams[presentNames[0]] = value1;
          queryParams[presentNames[1]] = value2;
          for (let i = 2; i < presentNames.length; i++) {
            queryParams[presentNames[i]] = `val${i}`;
          }

          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: {},
            queryParams,
            body: undefined,
          };

          const result = await executeValidation(context);
          expect(result.pass).toBe(false);

          const failResult = result as ValidationFail;
          expect(failResult.statusCode).toBe(400);
          expect(failResult.body.errors).toHaveLength(1);

          // Message should identify the conflicting param names
          const message = failResult.body.errors[0].message;
          for (const name of presentNames) {
            expect(message).toContain(name);
          }

          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 6: Conditional exclusion semantics
 *
 * For any conditional exclusion rule and any request context, the rule passes if the
 * trigger parameter is absent OR if the trigger is present and all forbidden parameters
 * are absent. The rule fails with HTTP 400 if and only if the trigger parameter is
 * present AND at least one forbidden parameter is also present and non-empty.
 *
 * **Validates: Requirements 3.6, 3.7**
 */
import { ConditionalExclusionRule } from "../../src/validation/validationTypes.js";
import { executeValidation as execValidation } from "../../src/service/validationEngine.js";
import { VALIDATION_REGISTRY as REGISTRY } from "../../src/validation/validationRegistry.js";

describe("Feature: deterministic-validation-system, Property 6: Conditional exclusion semantics", () => {
  const TEST_OPERATION_ID = "__test_conditionalExclusion__";

  beforeEach(() => {
    REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
  });

  it("Property 6: Passes when trigger is absent (regardless of forbidden params)", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a trigger param name (valid identifier-style)
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/),
        // Generate 1-4 forbidden param names (unique, valid identifiers)
        fc.uniqueArray(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/), { minLength: 1, maxLength: 4 }),
        // Generate values for forbidden params
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 4 }),
        async (triggerName, forbiddenNames, forbiddenValues) => {
          // Ensure trigger name is not in forbidden names
          const filteredForbidden = forbiddenNames.filter((n) => n !== triggerName);
          fc.pre(filteredForbidden.length >= 1);

          const rule: ConditionalExclusionRule = {
            checkType: "conditionalExclusion",
            trigger: { name: triggerName, source: "query" },
            forbidden: filteredForbidden.map((name) => ({ name, source: "query" as const })),
            failAction: {
              statusCode: 400,
              code: "InvalidInput",
              message: `Parameter cannot be provided when '${triggerName}' is present`,
            },
          };

          REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          // Build query params WITHOUT the trigger — forbidden may or may not be present
          const queryParams: Record<string, string> = {};
          for (let i = 0; i < filteredForbidden.length && i < forbiddenValues.length; i++) {
            queryParams[filteredForbidden[i]] = forbiddenValues[i];
          }
          // Trigger is NOT present in queryParams

          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: {},
            queryParams,
            body: undefined,
          };

          const result = await execValidation(context);
          // Should always pass when trigger is absent, regardless of forbidden params
          expect(result.pass).toBe(true);

          REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 6: Passes when trigger is present and all forbidden are absent", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a trigger param name
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/),
        // Generate a trigger value (non-empty)
        fc.string({ minLength: 1, maxLength: 20 }),
        // Generate 1-4 forbidden param names
        fc.uniqueArray(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/), { minLength: 1, maxLength: 4 }),
        async (triggerName, triggerValue, forbiddenNames) => {
          // Ensure trigger name is not in forbidden names
          const filteredForbidden = forbiddenNames.filter((n) => n !== triggerName);
          fc.pre(filteredForbidden.length >= 1);

          const rule: ConditionalExclusionRule = {
            checkType: "conditionalExclusion",
            trigger: { name: triggerName, source: "query" },
            forbidden: filteredForbidden.map((name) => ({ name, source: "query" as const })),
            failAction: {
              statusCode: 400,
              code: "InvalidInput",
              message: `Parameter cannot be provided when '${triggerName}' is present`,
            },
          };

          REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          // Trigger IS present, forbidden params are NOT present
          const queryParams: Record<string, string> = { [triggerName]: triggerValue };

          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: {},
            queryParams,
            body: undefined,
          };

          const result = await execValidation(context);
          // Should pass: trigger present but no forbidden params
          expect(result.pass).toBe(true);

          REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 6: Fails with 400 when trigger is present and at least one forbidden is present", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a trigger param name
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/),
        // Generate a trigger value (non-empty)
        fc.string({ minLength: 1, maxLength: 20 }),
        // Generate 1-4 forbidden param names
        fc.uniqueArray(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/), { minLength: 1, maxLength: 4 }),
        // Generate a forbidden value (non-empty)
        fc.string({ minLength: 1, maxLength: 20 }),
        // Index of which forbidden param to make present
        fc.nat(),
        async (triggerName, triggerValue, forbiddenNames, forbiddenValue, forbiddenIdx) => {
          // Ensure trigger name is not in forbidden names
          const filteredForbidden = forbiddenNames.filter((n) => n !== triggerName);
          fc.pre(filteredForbidden.length >= 1);

          const rule: ConditionalExclusionRule = {
            checkType: "conditionalExclusion",
            trigger: { name: triggerName, source: "query" },
            forbidden: filteredForbidden.map((name) => ({ name, source: "query" as const })),
            failAction: {
              statusCode: 400,
              code: "InvalidInput",
              message: `Parameter cannot be provided when '${triggerName}' is present`,
            },
          };

          REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          // Trigger IS present AND at least one forbidden param IS present
          const presentForbiddenName = filteredForbidden[forbiddenIdx % filteredForbidden.length];
          const queryParams: Record<string, string> = {
            [triggerName]: triggerValue,
            [presentForbiddenName]: forbiddenValue,
          };

          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: {},
            queryParams,
            body: undefined,
          };

          const result = await execValidation(context);
          // Should fail with 400
          expect(result.pass).toBe(false);

          const failResult = result as ValidationFail;
          expect(failResult.statusCode).toBe(400);
          expect(failResult.body.errors).toHaveLength(1);
          // Error message should reference the trigger name and the forbidden param
          expect(failResult.body.errors[0].message).toContain(triggerName);
          expect(failResult.body.errors[0].message).toContain(presentForbiddenName);

          REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: deterministic-validation-system
 * Property 3: Entity existence — nested lookup
 *
 * For any nested entity existence rule, if the parent entity does not exist in
 * the database, the rule returns HTTP 404 referencing the parent entity label
 * and identifier; if the parent exists but the child entity is not found within
 * the parent's specified collection, the rule returns HTTP 404 referencing the
 * child entity label and identifier; if both parent and child exist, the rule passes.
 *
 * **Validates: Requirements 2.3, 2.4, 2.5**
 */
describe("Feature: deterministic-validation-system, Property 3: Entity existence — nested lookup", () => {
  const TEST_OPERATION_ID = "__test_nested_entity_prop3__";

  beforeEach(() => {
    // Reset all API partitions in mock database
    for (const api of Object.values(Api)) {
      mockDbData[api] = {};
    }
    VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
  });

  it("should correctly handle nested entity lookup: pass when both exist, 404 for missing parent, 404 for missing child", async () => {
    // Arbitraries (excluding JS prototype-polluting keys that can't be used as plain object keys)
    const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype", "toString", "valueOf", "hasOwnProperty"]);
    const identifierArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0 && !RESERVED_KEYS.has(s));
    const labelArb = fc.string({ minLength: 1, maxLength: 15 }).filter((s) => s.trim().length > 0);
    const paramSourceArb = fc.constantFrom("path" as const, "query" as const);
    const fieldNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/);
    const scenarioArb = fc.constantFrom("both_exist" as const, "parent_missing" as const, "child_missing" as const);

    await fc.assert(
      fc.asyncProperty(
        fieldNameArb, // parentParamName
        paramSourceArb, // parentParamSource
        labelArb, // parentLabel
        fieldNameArb, // childParamName
        paramSourceArb, // childParamSource
        fieldNameArb, // childCollection
        fieldNameArb, // childIdField
        labelArb, // childLabel
        identifierArb, // parentId
        identifierArb, // childId
        scenarioArb, // scenario
        async (parentParamName, parentParamSource, parentLabel, childParamName, childParamSource, childCollection, childIdField, childLabel, parentId, childId, scenario) => {
          // Ensure parentParamName and childParamName are different to avoid collisions
          fc.pre(parentParamName !== childParamName);
          // Ensure childCollection is different from parentParamName to avoid field collisions
          fc.pre(childCollection !== parentParamName);

          // Build the EntityExistenceRule with nested config
          const rule: EntityExistenceRule = {
            checkType: "entityExistence",
            entity: {
              api: Api.ORDERS,
              paramName: parentParamName,
              paramSource: parentParamSource,
              entityLabel: parentLabel,
            },
            nested: {
              childParamName,
              childParamSource,
              childCollection,
              childIdField,
              childLabel,
            },
            failAction: {
              statusCode: 404,
              code: "NotFound",
              message: "Entity not found",
            },
          };

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          // Build request context
          const pathParams: Record<string, string> = {};
          const queryParams: Record<string, string | string[] | undefined> = {};

          if (parentParamSource === "path") {
            pathParams[parentParamName] = parentId;
          } else {
            queryParams[parentParamName] = parentId;
          }

          if (childParamSource === "path") {
            pathParams[childParamName] = childId;
          } else {
            queryParams[childParamName] = childId;
          }

          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams,
            queryParams,
            body: undefined,
          };

          // Set up database state based on scenario
          const parentEntity: Record<string, unknown> = {
            [parentParamName]: parentId,
          };

          // Reset the orders partition
          mockDbData[Api.ORDERS] = {};

          switch (scenario) {
            case "both_exist": {
              // Parent exists with child in its collection
              const childEntity = { [childIdField]: childId };
              parentEntity[childCollection] = [childEntity];
              mockDbData[Api.ORDERS] = { [parentId]: parentEntity };
              break;
            }
            case "parent_missing": {
              // Parent does NOT exist — leave db empty
              mockDbData[Api.ORDERS] = {};
              break;
            }
            case "child_missing": {
              // Parent exists but child has a different ID so it won't match
              parentEntity[childCollection] = [{ [childIdField]: `__nonmatch__${childId}__xyz` }];
              mockDbData[Api.ORDERS] = { [parentId]: parentEntity };
              break;
            }
          }

          const result = await executeValidation(context);

          // Verify based on scenario
          switch (scenario) {
            case "both_exist":
              expect(result.pass).toBe(true);
              break;
            case "parent_missing":
              expect(result.pass).toBe(false);
              if (!result.pass) {
                expect(result.statusCode).toBe(404);
                expect(result.body.errors[0].message).toContain(parentLabel);
              }
              break;
            case "child_missing":
              expect(result.pass).toBe(false);
              if (!result.pass) {
                expect(result.statusCode).toBe(404);
                expect(result.body.errors[0].message).toContain(childLabel);
              }
              break;
          }

          // Cleanup
          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
          mockDbData[Api.ORDERS] = {};
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: deterministic-validation-system
 * Property 8: Business rule skip on missing entity
 *
 * For any business rule and any request context where the referenced entity does
 * not exist in the database, the rule SHALL return a pass result without evaluating
 * the condition or producing an error.
 *
 * **Validates: Requirements 4.4**
 */
import { BusinessRuleCheck } from "../../src/validation/validationTypes.js";

describe("Feature: deterministic-validation-system, Property 8: Business rule skip on missing entity", () => {
  const TEST_OPERATION_ID = "__test_businessRule_missingEntity__";

  beforeEach(() => {
    // Reset all API partitions in mock database
    for (const api of Object.values(Api)) {
      mockDbData[api] = {};
    }
    VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
  });

  it("Property 8: Always passes when entity referenced by business rule is not found in database", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate an entity identifier (non-empty string used as the lookup key)
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        // Generate a field path for the condition
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}(\.[a-zA-Z][a-zA-Z0-9]{0,9}){0,2}$/),
        // Generate an operator
        fc.constantFrom("eq" as const, "neq" as const, "in" as const, "notIn" as const),
        // Generate a condition value
        fc.oneof(fc.string({ minLength: 1, maxLength: 10 }), fc.integer(), fc.boolean()),
        // Generate a param name for the entity identifier
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/),
        // Generate a param source
        fc.constantFrom("path" as const, "query" as const, "body" as const),
        async (entityId, fieldPath, operator, conditionValue, paramName, paramSource) => {
          // Build a business rule that references an entity
          const rule: BusinessRuleCheck = {
            checkType: "businessRule",
            entity: {
              api: Api.ORDERS,
              paramName,
              paramSource,
            },
            condition: {
              field: fieldPath,
              operator,
              value: operator === "in" || operator === "notIn" ? [conditionValue] : conditionValue,
            },
            failAction: {
              statusCode: 400,
              code: "BusinessRuleViolation",
              message: "Business rule violated",
            },
          };

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          // Set up database with NO entity matching the identifier.
          // Either empty or with different entities that don't match.
          mockDbData[Api.ORDERS] = {
            __other_entity_1__: { someField: "someValue" },
            __other_entity_2__: { anotherField: 42 },
          };

          // Build request context with the entity identifier
          const pathParams: Record<string, string> = {};
          const queryParams: Record<string, string | string[] | undefined> = {};
          let body: Record<string, unknown> | undefined;

          switch (paramSource) {
            case "path":
              pathParams[paramName] = entityId;
              break;
            case "query":
              queryParams[paramName] = entityId;
              break;
            case "body":
              body = { [paramName]: entityId };
              break;
          }

          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "POST",
            pathParams,
            queryParams,
            body,
          };

          const result = await executeValidation(context);

          // Key property: when entity is NOT found, the business rule always passes
          expect(result.pass).toBe(true);

          // Cleanup
          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
          mockDbData[Api.ORDERS] = {};
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: deterministic-validation-system
 * Property 7: Business rule evaluation correctness
 *
 * For any business rule with a given operator (eq, neq, in, notIn) and any entity
 * data in the database, the rule evaluates the condition by extracting the specified
 * field from the entity and comparing it to the expected value using the specified
 * operator. The rule fails (returning the Fail_Action) if and only if the condition
 * is satisfied (i.e., the business constraint is violated).
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
// BusinessRuleCheck already imported above

describe("Feature: deterministic-validation-system, Property 7: Business rule evaluation correctness", () => {
  const TEST_OPERATION_ID = "__test_businessRule_prop7__";

  beforeEach(() => {
    // Reset all API partitions in mock database
    for (const api of Object.values(Api)) {
      mockDbData[api] = {};
    }
    VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
  });

  it("Property 7 (eq): condition satisfied → fails; condition not satisfied → passes", async () => {
    // Generate a field value and a comparison value; test both matching and non-matching
    const fieldValueArb = fc.oneof(fc.string({ minLength: 1, maxLength: 20 }), fc.integer(), fc.boolean());
    const fieldNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/);
    const identifierArb = fc.stringMatching(/^[a-zA-Z0-9]{1,15}$/);

    await fc.assert(
      fc.asyncProperty(
        fieldNameArb,
        fieldValueArb,
        identifierArb,
        fc.boolean(), // shouldMatch: whether the condition matches (field === value)
        async (fieldName, fieldValue, identifier, shouldMatch) => {
          // Build entity in the database
          const entity: Record<string, unknown> = { [fieldName]: fieldValue };
          mockDbData[Api.ORDERS] = { [identifier]: entity };

          // Comparison value: same as fieldValue if shouldMatch, otherwise different
          const comparisonValue = shouldMatch ? fieldValue : `__different__${String(fieldValue)}`;

          const rule: BusinessRuleCheck = {
            checkType: "businessRule",
            entity: {
              api: Api.ORDERS,
              paramName: "orderId",
              paramSource: "path",
            },
            condition: {
              field: fieldName,
              operator: "eq",
              value: comparisonValue,
            },
            failAction: {
              statusCode: 400,
              code: "BusinessRuleViolation",
              message: "Business rule violated",
            },
          };

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: { orderId: identifier },
            queryParams: {},
            body: undefined,
          };

          const result = await executeValidation(context);

          if (shouldMatch) {
            // Condition satisfied → fails (business constraint violated)
            expect(result.pass).toBe(false);
            if (!result.pass) {
              expect(result.statusCode).toBe(400);
              expect(result.body.errors[0].code).toBe("BusinessRuleViolation");
            }
          } else {
            // Condition NOT satisfied → passes
            expect(result.pass).toBe(true);
          }

          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
          mockDbData[Api.ORDERS] = {};
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 7 (neq): condition satisfied → fails; condition not satisfied → passes", async () => {
    const fieldValueArb = fc.oneof(fc.string({ minLength: 1, maxLength: 20 }), fc.integer(), fc.boolean());
    const fieldNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/);
    const identifierArb = fc.stringMatching(/^[a-zA-Z0-9]{1,15}$/);

    await fc.assert(
      fc.asyncProperty(
        fieldNameArb,
        fieldValueArb,
        identifierArb,
        fc.boolean(), // shouldSatisfyCondition: whether fieldValue !== comparisonValue (neq satisfied)
        async (fieldName, fieldValue, identifier, shouldSatisfyCondition) => {
          const entity: Record<string, unknown> = { [fieldName]: fieldValue };
          mockDbData[Api.ORDERS] = { [identifier]: entity };

          // For neq: condition is satisfied when fieldValue !== comparisonValue
          // shouldSatisfyCondition=true means we want neq to be TRUE → values must differ
          // shouldSatisfyCondition=false means we want neq to be FALSE → values must be equal
          const comparisonValue = shouldSatisfyCondition ? `__different__${String(fieldValue)}` : fieldValue;

          const rule: BusinessRuleCheck = {
            checkType: "businessRule",
            entity: {
              api: Api.ORDERS,
              paramName: "orderId",
              paramSource: "path",
            },
            condition: {
              field: fieldName,
              operator: "neq",
              value: comparisonValue,
            },
            failAction: {
              statusCode: 400,
              code: "BusinessRuleViolation",
              message: "Business rule violated",
            },
          };

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: { orderId: identifier },
            queryParams: {},
            body: undefined,
          };

          const result = await executeValidation(context);

          if (shouldSatisfyCondition) {
            // neq condition satisfied (field !== value) → fails
            expect(result.pass).toBe(false);
            if (!result.pass) {
              expect(result.statusCode).toBe(400);
              expect(result.body.errors[0].code).toBe("BusinessRuleViolation");
            }
          } else {
            // neq condition NOT satisfied (field === value) → passes
            expect(result.pass).toBe(true);
          }

          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
          mockDbData[Api.ORDERS] = {};
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 7 (in): condition satisfied → fails; condition not satisfied → passes", async () => {
    const fieldValueArb = fc.string({ minLength: 1, maxLength: 15 });
    const fieldNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/);
    const identifierArb = fc.stringMatching(/^[a-zA-Z0-9]{1,15}$/);
    // Generate an array of strings for the "in" comparison
    const arrayValuesArb = fc.array(fc.string({ minLength: 1, maxLength: 15 }), { minLength: 1, maxLength: 5 });

    await fc.assert(
      fc.asyncProperty(
        fieldNameArb,
        fieldValueArb,
        identifierArb,
        arrayValuesArb,
        fc.boolean(), // shouldSatisfyCondition: whether fieldValue is in the array
        async (fieldName, fieldValue, identifier, arrayValues, shouldSatisfyCondition) => {
          const entity: Record<string, unknown> = { [fieldName]: fieldValue };
          mockDbData[Api.ORDERS] = { [identifier]: entity };

          // For "in": condition is satisfied when array.includes(fieldValue)
          let comparisonArray: string[];
          if (shouldSatisfyCondition) {
            // Ensure fieldValue IS in the array
            comparisonArray = [...arrayValues.filter((v) => v !== fieldValue), fieldValue];
          } else {
            // Ensure fieldValue is NOT in the array
            comparisonArray = arrayValues.filter((v) => v !== fieldValue);
            if (comparisonArray.length === 0) {
              comparisonArray = [`__noMatch__${fieldValue}`];
            }
          }

          const rule: BusinessRuleCheck = {
            checkType: "businessRule",
            entity: {
              api: Api.ORDERS,
              paramName: "orderId",
              paramSource: "path",
            },
            condition: {
              field: fieldName,
              operator: "in",
              value: comparisonArray,
            },
            failAction: {
              statusCode: 400,
              code: "BusinessRuleViolation",
              message: "Business rule violated",
            },
          };

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: { orderId: identifier },
            queryParams: {},
            body: undefined,
          };

          const result = await executeValidation(context);

          if (shouldSatisfyCondition) {
            // "in" condition satisfied → fails
            expect(result.pass).toBe(false);
            if (!result.pass) {
              expect(result.statusCode).toBe(400);
              expect(result.body.errors[0].code).toBe("BusinessRuleViolation");
            }
          } else {
            // "in" condition NOT satisfied → passes
            expect(result.pass).toBe(true);
          }

          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
          mockDbData[Api.ORDERS] = {};
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 7 (notIn): condition satisfied → fails; condition not satisfied → passes", async () => {
    const fieldValueArb = fc.string({ minLength: 1, maxLength: 15 });
    const fieldNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/);
    const identifierArb = fc.stringMatching(/^[a-zA-Z0-9]{1,15}$/);
    // Generate an array of strings for the "notIn" comparison
    const arrayValuesArb = fc.array(fc.string({ minLength: 1, maxLength: 15 }), { minLength: 1, maxLength: 5 });

    await fc.assert(
      fc.asyncProperty(
        fieldNameArb,
        fieldValueArb,
        identifierArb,
        arrayValuesArb,
        fc.boolean(), // shouldSatisfyCondition: whether fieldValue is NOT in the array (notIn satisfied)
        async (fieldName, fieldValue, identifier, arrayValues, shouldSatisfyCondition) => {
          const entity: Record<string, unknown> = { [fieldName]: fieldValue };
          mockDbData[Api.ORDERS] = { [identifier]: entity };

          // For "notIn": condition is satisfied when !array.includes(fieldValue)
          let comparisonArray: string[];
          if (shouldSatisfyCondition) {
            // Ensure fieldValue is NOT in the array (so notIn is satisfied → fails)
            comparisonArray = arrayValues.filter((v) => v !== fieldValue);
            if (comparisonArray.length === 0) {
              comparisonArray = [`__noMatch__${fieldValue}`];
            }
          } else {
            // Ensure fieldValue IS in the array (so notIn is NOT satisfied → passes)
            comparisonArray = [...arrayValues.filter((v) => v !== fieldValue), fieldValue];
          }

          const rule: BusinessRuleCheck = {
            checkType: "businessRule",
            entity: {
              api: Api.ORDERS,
              paramName: "orderId",
              paramSource: "path",
            },
            condition: {
              field: fieldName,
              operator: "notIn",
              value: comparisonArray,
            },
            failAction: {
              statusCode: 400,
              code: "BusinessRuleViolation",
              message: "Business rule violated",
            },
          };

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: { orderId: identifier },
            queryParams: {},
            body: undefined,
          };

          const result = await executeValidation(context);

          if (shouldSatisfyCondition) {
            // "notIn" condition satisfied (field not in array) → fails
            expect(result.pass).toBe(false);
            if (!result.pass) {
              expect(result.statusCode).toBe(400);
              expect(result.body.errors[0].code).toBe("BusinessRuleViolation");
            }
          } else {
            // "notIn" condition NOT satisfied (field is in array) → passes
            expect(result.pass).toBe(true);
          }

          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
          mockDbData[Api.ORDERS] = {};
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: deterministic-validation-system
 * Property 9: Pipeline short-circuit execution
 *
 * For any validation pipeline of length N where rule at position K (0 ≤ K < N)
 * is the first to fail, the pipeline returns the failure result of rule K,
 * and rules at positions K+1 through N-1 are never evaluated. If all N rules
 * pass, the pipeline returns a pass result.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */
describe("Feature: deterministic-validation-system, Property 9: Pipeline short-circuit execution", () => {
  const TEST_OPERATION_ID = "__test_pipeline_shortcircuit__";

  beforeEach(() => {
    VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
  });

  it("Property 9: Pipeline short-circuits at first failing rule K, returning rule K's failure", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Pipeline length N (2-5)
        fc.integer({ min: 2, max: 5 }),
        // Position K where the failing rule is (will be constrained to [0, N-1])
        fc.nat(),
        async (pipelineLength, rawK) => {
          const K = rawK % pipelineLength;

          // Create unique param names for each rule to detect which rules are evaluated
          const ruleParamNames: string[] = [];
          for (let i = 0; i < pipelineLength; i++) {
            ruleParamNames.push(`param_rule_${i}`);
          }

          // Build the pipeline: each rule is an atLeastOneRequired with a unique param
          const pipeline: AtLeastOneRequiredRule[] = ruleParamNames.map((paramName, idx) => ({
            checkType: "atLeastOneRequired" as const,
            params: [{ name: paramName, source: "query" as const }],
            failAction: {
              statusCode: 400,
              code: "InvalidInput",
              message: `At least one of '${paramName}' must be provided`,
            },
          }));

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), pipeline as ValidationPipeline);

          // Build query params: provide values for rules 0..K-1, omit for K and beyond
          const queryParams: Record<string, string> = {};
          for (let i = 0; i < K; i++) {
            queryParams[ruleParamNames[i]] = "present-value";
          }
          // Rule at K does NOT have its param → it will fail
          // Rules K+1..N-1 also don't have their params, but should never be reached

          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: {},
            queryParams,
            body: undefined,
          };

          const result = await executeValidation(context);

          // Pipeline should fail at rule K
          expect(result.pass).toBe(false);

          const failResult = result as ValidationFail;
          expect(failResult.statusCode).toBe(400);
          expect(failResult.body.errors).toHaveLength(1);

          // The error message should reference rule K's param, not any later rule's param
          const errorMessage = failResult.body.errors[0].message;
          expect(errorMessage).toContain(ruleParamNames[K]);

          // Verify error does NOT reference any param from rules K+1..N-1
          for (let i = K + 1; i < pipelineLength; i++) {
            expect(errorMessage).not.toContain(ruleParamNames[i]);
          }

          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 9: Pipeline returns pass when all rules pass", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Pipeline length N (2-5)
        fc.integer({ min: 2, max: 5 }),
        async (pipelineLength) => {
          // Create unique param names for each rule
          const ruleParamNames: string[] = [];
          for (let i = 0; i < pipelineLength; i++) {
            ruleParamNames.push(`param_allpass_${i}`);
          }

          // Build the pipeline: each rule is atLeastOneRequired with a unique param
          const pipeline: AtLeastOneRequiredRule[] = ruleParamNames.map((paramName) => ({
            checkType: "atLeastOneRequired" as const,
            params: [{ name: paramName, source: "query" as const }],
            failAction: {
              statusCode: 400,
              code: "InvalidInput",
              message: `At least one of '${paramName}' must be provided`,
            },
          }));

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), pipeline as ValidationPipeline);

          // Provide ALL params so every rule passes
          const queryParams: Record<string, string> = {};
          for (const paramName of ruleParamNames) {
            queryParams[paramName] = "present-value";
          }

          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: {},
            queryParams,
            body: undefined,
          };

          const result = await executeValidation(context);

          // All rules pass → pipeline returns pass
          expect(result.pass).toBe(true);

          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: deterministic-validation-system
 * Property 10: Error response structure conformance
 *
 * For any validation rule that fails, the returned body SHALL be a JSON object with
 * an `errors` array containing exactly one entry, and that entry SHALL contain a `code`
 * string field and a `message` string field. The returned statusCode SHALL equal the
 * rule's failAction.statusCode.
 *
 * **Validates: Requirements 8.1, 8.2, 8.3**
 */
describe("Feature: deterministic-validation-system, Property 10: Error response structure conformance", () => {
  const TEST_OPERATION_ID = "__test_errorStructure_prop10__";

  beforeEach(() => {
    VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
  });

  it("Property 10: Failing rules produce conformant SP-API error response structure", async () => {
    // Generate a random statusCode (400-599) and a non-empty code string
    const statusCodeArb = fc.integer({ min: 400, max: 599 });
    const codeArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0);
    const messageArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);
    // Generate 1-5 unique param names that we will NOT provide — guaranteeing failure
    const paramNamesArb = fc.uniqueArray(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/), { minLength: 1, maxLength: 5 });

    await fc.assert(
      fc.asyncProperty(statusCodeArb, codeArb, messageArb, paramNamesArb, async (statusCode, code, message, paramNames) => {
        fc.pre(paramNames.length >= 1);

        // Build an atLeastOneRequired rule that will definitely fail (no params provided)
        const rule: AtLeastOneRequiredRule = {
          checkType: "atLeastOneRequired",
          params: paramNames.map((name) => ({ name, source: "query" as const })),
          failAction: {
            statusCode,
            code,
            message,
          },
        };

        VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

        try {
          // Execute with empty query params — guaranteed to fail
          const context: RequestContext = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: {},
            queryParams: {},
            body: undefined,
          };

          const result = await executeValidation(context);

          // Verify: result must indicate failure
          expect(result.pass).toBe(false);

          if (!result.pass) {
            // Verify: statusCode matches the rule's failAction.statusCode
            expect(result.statusCode).toBe(statusCode);

            // Verify: body is an object
            expect(result.body).toBeDefined();
            expect(typeof result.body).toBe("object");
            expect(result.body).not.toBeNull();

            // Verify: body.errors is an array with exactly one entry
            expect(Array.isArray(result.body.errors)).toBe(true);
            expect(result.body.errors).toHaveLength(1);

            // Verify: the single error entry has code (string) and message (string)
            const errorEntry = result.body.errors[0];
            expect(typeof errorEntry.code).toBe("string");
            expect(typeof errorEntry.message).toBe("string");
          }
        } finally {
          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
        }
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: deterministic-validation-system
 * Property 12: Unregistered Validation_Key fails validation
 *
 * For any composite Validation_Key (formed from apiName, apiVersion, and operationId)
 * that does not have a pipeline registered in the Validation_Registry, executing
 * validation SHALL return a fail result with HTTP 400 and a NoValidationPipeline error code.
 *
 * **Validates: Requirements 6.2, 9.3, 9.5**
 */
describe("Feature: deterministic-validation-system, Property 12: Unregistered Validation_Key fails validation", () => {
  beforeEach(() => {
    // Ensure the registry is empty so no composite key collides with registered entries
    VALIDATION_REGISTRY.clear();
  });

  it("Property 12: Any unregistered three-part composite key (apiName:apiVersion:operationId) always returns a fail result", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary apiName (non-empty, prefixed to avoid collisions)
        fc.string({ minLength: 1, maxLength: 30 }).map((s) => `UnregApi_${s}`),
        // Generate arbitrary apiVersion (non-empty, varied formats like "v0", "2024-01-01", etc.)
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 20 }).map((s) => `v${s}`),
          fc.tuple(fc.integer({ min: 2020, max: 2030 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 })).map(([y, m, d]) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`),
        ),
        // Generate arbitrary operationId (non-empty)
        fc.string({ minLength: 1, maxLength: 40 }).map((s) => `unregisteredOp_${s}`),
        // Generate arbitrary HTTP methods
        fc.constantFrom("GET", "POST", "PUT", "DELETE", "PATCH"),
        // Generate arbitrary path params
        fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ maxLength: 20 })),
        // Generate arbitrary query params
        fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ maxLength: 20 })),
        // Generate arbitrary body (or undefined)
        fc.option(fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.jsonValue()), { nil: undefined }),
        async (apiName, apiVersion, operationId, method, pathParams, queryParams, body) => {
          const key = buildKey(apiName, apiVersion, operationId);
          // Ensure the composite key is NOT in the registry
          fc.pre(!VALIDATION_REGISTRY.has(key));

          const context: RequestContext = {
            apiName,
            apiVersion,
            operationId,
            method,
            pathParams,
            queryParams,
            body,
          };

          const result = await executeValidation(context);

          // Key property: unregistered composite keys always fail validation
          expect(result.pass).toBe(false);
          if (!result.pass) {
            expect(result.statusCode).toBe(501);
            expect(result.body?.errors[0].code).toBe("NoValidationPipeline");
            expect(result.body?.errors[0].message).toContain(key);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 11: Default error code fallback
 *
 * For any validation rule whose failAction does not specify a `code` value,
 * when the rule fails, the error entry's `code` field SHALL equal the rule's
 * checkType string.
 *
 * **Validates: Requirements 8.4**
 */
describe("Feature: deterministic-validation-system, Property 11: Default error code fallback", () => {
  const TEST_OPERATION_ID = "__test_defaultErrorCodeFallback__";

  beforeEach(() => {
    VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
  });

  it("Property 11: When failAction.code is undefined, error code equals checkType", async () => {
    // Strategy: randomly choose among rule types that can be made to fail,
    // set failAction.code to undefined, create a failing context, and verify
    // that the error response uses checkType as the code.
    const ruleTypeArb = fc.constantFrom("atLeastOneRequired" as const, "mutualExclusivity" as const, "conditionalExclusion" as const);

    // Generate unique param names for building rules
    const paramNamesArb = fc.uniqueArray(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/), { minLength: 2, maxLength: 5 });

    await fc.assert(
      fc.asyncProperty(ruleTypeArb, paramNamesArb, fc.string({ minLength: 1, maxLength: 20 }), async (ruleType, paramNames, triggerValue) => {
        fc.pre(paramNames.length >= 2);

        let rule: AtLeastOneRequiredRule | MutualExclusivityRule | ConditionalExclusionRule;
        let context: RequestContext;

        switch (ruleType) {
          case "atLeastOneRequired": {
            // Rule with no code specified — all params absent causes failure
            rule = {
              checkType: "atLeastOneRequired",
              params: paramNames.map((name) => ({ name, source: "query" as const })),
              failAction: {
                statusCode: 400,
                code: undefined,
                message: `At least one of '${paramNames.join("', '")}' must be provided`,
              },
            };

            // Context where none of the params are present → rule fails
            context = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
              method: "GET",
              pathParams: {},
              queryParams: {},
              body: undefined,
            };
            break;
          }
          case "mutualExclusivity": {
            // Rule with no code specified — zero params present causes failure
            rule = {
              checkType: "mutualExclusivity",
              params: paramNames.map((name) => ({ name, source: "query" as const })),
              failAction: {
                statusCode: 400,
                code: undefined,
                message: `Exactly one of '${paramNames.join(", ")}' must be provided`,
              },
            };

            // Context where none of the params are present → rule fails
            context = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
              method: "GET",
              pathParams: {},
              queryParams: {},
              body: undefined,
            };
            break;
          }
          case "conditionalExclusion": {
            // Rule with no code specified — trigger present + forbidden present causes failure
            const triggerName = paramNames[0];
            const forbiddenNames = paramNames.slice(1);

            rule = {
              checkType: "conditionalExclusion",
              trigger: { name: triggerName, source: "query" },
              forbidden: forbiddenNames.map((name) => ({ name, source: "query" as const })),
              failAction: {
                statusCode: 400,
                code: undefined,
                message: `Parameter cannot be provided when '${triggerName}' is present`,
              },
            };

            // Context where trigger AND at least one forbidden param are present → rule fails
            const queryParams: Record<string, string> = {
              [triggerName]: triggerValue,
              [forbiddenNames[0]]: "some-forbidden-value",
            };

            context = {
              apiName: "TestApi",
              apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
              method: "GET",
              pathParams: {},
              queryParams,
              body: undefined,
            };
            break;
          }
        }

        VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

        const result = await executeValidation(context);

        // The rule should fail
        expect(result.pass).toBe(false);

        if (!result.pass) {
          // The error code should fall back to the checkType since code is undefined
          expect(result.body.errors).toHaveLength(1);
          expect(result.body.errors[0].code).toBe(ruleType);
        }

        VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: deterministic-validation-system
 * Property 13: Composite key guarantees cross-domain uniqueness
 *
 * For any two distinct combinations of API name and API version, and any shared
 * operationId, registering different validation pipelines under each composite key
 * (`apiName1:apiVersion1:operationId` and `apiName2:apiVersion2:operationId`) SHALL
 * result in lookups resolving to distinct pipelines — the pipeline returned for one
 * key is not the same as the pipeline returned for the other.
 *
 * **Validates: Requirements 9.1, 9.6**
 */
describe("Feature: deterministic-validation-system, Property 13: Composite key guarantees cross-domain uniqueness", () => {
  beforeEach(() => {
    VALIDATION_REGISTRY.clear();
  });

  it("Property 13: Cross-domain — different apiName with same operationId resolves to distinct pipelines", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate two distinct apiNames
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,19}$/),
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,19}$/),
        // Shared apiVersion
        fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9.\-]{0,14}$/),
        // Shared operationId
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,19}$/),
        async (apiName1, apiName2, apiVersion, operationId) => {
          // Ensure the two apiNames are distinct
          fc.pre(apiName1 !== apiName2);

          // Create two distinct pipelines with different failAction messages
          const pipeline1: ValidationPipeline = [
            {
              checkType: "atLeastOneRequired",
              params: [{ name: "pipeline1Param", source: "query" }],
              failAction: {
                statusCode: 400,
                code: "Pipeline1",
                message: "Pipeline 1 failure",
              },
            },
          ];

          const pipeline2: ValidationPipeline = [
            {
              checkType: "atLeastOneRequired",
              params: [{ name: "pipeline2Param", source: "query" }],
              failAction: {
                statusCode: 400,
                code: "Pipeline2",
                message: "Pipeline 2 failure",
              },
            },
          ];

          // Register both pipelines under the same operationId but different apiNames
          const key1 = buildKey(apiName1, apiVersion, operationId);
          const key2 = buildKey(apiName2, apiVersion, operationId);
          VALIDATION_REGISTRY.set(key1, pipeline1);
          VALIDATION_REGISTRY.set(key2, pipeline2);

          // Verify keys are distinct
          expect(key1).not.toBe(key2);

          // Lookup pipeline 1 via executeValidation — provide pipeline1Param absent to trigger failure
          const context1: RequestContext = {
            apiName: apiName1,
            apiVersion,
            operationId,
            method: "GET",
            pathParams: {},
            queryParams: {},
            body: undefined,
          };

          const result1 = await executeValidation(context1);
          expect(result1.pass).toBe(false);
          if (!result1.pass) {
            expect(result1.body.errors[0].code).toBe("Pipeline1");
          }

          // Lookup pipeline 2 via executeValidation — provide pipeline2Param absent to trigger failure
          const context2: RequestContext = {
            apiName: apiName2,
            apiVersion,
            operationId,
            method: "GET",
            pathParams: {},
            queryParams: {},
            body: undefined,
          };

          const result2 = await executeValidation(context2);
          expect(result2.pass).toBe(false);
          if (!result2.pass) {
            expect(result2.body.errors[0].code).toBe("Pipeline2");
          }

          // Cleanup
          VALIDATION_REGISTRY.delete(key1);
          VALIDATION_REGISTRY.delete(key2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 13: Cross-version — same apiName with different apiVersion resolves to distinct pipelines", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Shared apiName
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,19}$/),
        // Generate two distinct apiVersions (e.g., "v0" vs "2026-01-01")
        fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9.\-]{0,14}$/),
        fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9.\-]{0,14}$/),
        // Shared operationId
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,19}$/),
        async (apiName, apiVersion1, apiVersion2, operationId) => {
          // Ensure the two apiVersions are distinct
          fc.pre(apiVersion1 !== apiVersion2);

          // Create two distinct pipelines with different failAction messages
          const pipeline1: ValidationPipeline = [
            {
              checkType: "atLeastOneRequired",
              params: [{ name: "versionPipeline1Param", source: "query" }],
              failAction: {
                statusCode: 400,
                code: "VersionPipeline1",
                message: "Version Pipeline 1 failure",
              },
            },
          ];

          const pipeline2: ValidationPipeline = [
            {
              checkType: "atLeastOneRequired",
              params: [{ name: "versionPipeline2Param", source: "query" }],
              failAction: {
                statusCode: 400,
                code: "VersionPipeline2",
                message: "Version Pipeline 2 failure",
              },
            },
          ];

          // Register both pipelines under same apiName + operationId but different apiVersions
          const key1 = buildKey(apiName, apiVersion1, operationId);
          const key2 = buildKey(apiName, apiVersion2, operationId);
          VALIDATION_REGISTRY.set(key1, pipeline1);
          VALIDATION_REGISTRY.set(key2, pipeline2);

          // Verify keys are distinct
          expect(key1).not.toBe(key2);

          // Lookup pipeline 1 via executeValidation
          const context1: RequestContext = {
            apiName,
            apiVersion: apiVersion1,
            operationId,
            method: "GET",
            pathParams: {},
            queryParams: {},
            body: undefined,
          };

          const result1 = await executeValidation(context1);
          expect(result1.pass).toBe(false);
          if (!result1.pass) {
            expect(result1.body.errors[0].code).toBe("VersionPipeline1");
          }

          // Lookup pipeline 2 via executeValidation
          const context2: RequestContext = {
            apiName,
            apiVersion: apiVersion2,
            operationId,
            method: "GET",
            pathParams: {},
            queryParams: {},
            body: undefined,
          };

          const result2 = await executeValidation(context2);
          expect(result2.pass).toBe(false);
          if (!result2.pass) {
            expect(result2.body.errors[0].code).toBe("VersionPipeline2");
          }

          // Cleanup
          VALIDATION_REGISTRY.delete(key1);
          VALIDATION_REGISTRY.delete(key2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 13: Real-world scenario — Orders:v0:getOrder vs Orders:2026-01-01:getOrder resolve independently", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary non-empty param names to differentiate pipelines
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/),
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/),
        async (param1, param2) => {
          fc.pre(param1 !== param2);

          const pipeline1: ValidationPipeline = [
            {
              checkType: "atLeastOneRequired",
              params: [{ name: param1, source: "query" }],
              failAction: {
                statusCode: 400,
                code: "OrdersV0",
                message: `Orders v0 requires '${param1}'`,
              },
            },
          ];

          const pipeline2: ValidationPipeline = [
            {
              checkType: "atLeastOneRequired",
              params: [{ name: param2, source: "query" }],
              failAction: {
                statusCode: 400,
                code: "Orders2026",
                message: `Orders 2026-01-01 requires '${param2}'`,
              },
            },
          ];

          const key1 = buildKey("Orders", "v0", "getOrder");
          const key2 = buildKey("Orders", "2026-01-01", "getOrder");
          VALIDATION_REGISTRY.set(key1, pipeline1);
          VALIDATION_REGISTRY.set(key2, pipeline2);

          // Verify the keys are "Orders:v0:getOrder" and "Orders:2026-01-01:getOrder"
          expect(key1).toBe("Orders:v0:getOrder");
          expect(key2).toBe("Orders:2026-01-01:getOrder");
          expect(key1).not.toBe(key2);

          // Execute with context targeting Orders v0 — should use pipeline1
          const context1: RequestContext = {
            apiName: "Orders",
            apiVersion: "v0",
            operationId: "getOrder",
            method: "GET",
            pathParams: {},
            queryParams: {},
            body: undefined,
          };

          const result1 = await executeValidation(context1);
          expect(result1.pass).toBe(false);
          if (!result1.pass) {
            expect(result1.body.errors[0].code).toBe("OrdersV0");
            expect(result1.body.errors[0].message).toContain(param1);
          }

          // Execute with context targeting Orders 2026-01-01 — should use pipeline2
          const context2: RequestContext = {
            apiName: "Orders",
            apiVersion: "2026-01-01",
            operationId: "getOrder",
            method: "GET",
            pathParams: {},
            queryParams: {},
            body: undefined,
          };

          const result2 = await executeValidation(context2);
          expect(result2.pass).toBe(false);
          if (!result2.pass) {
            expect(result2.body.errors[0].code).toBe("Orders2026");
            expect(result2.body.errors[0].message).toContain(param2);
          }

          // Additionally verify: providing param1 makes pipeline1 pass but pipeline2 still fails
          const context1WithParam: RequestContext = {
            apiName: "Orders",
            apiVersion: "v0",
            operationId: "getOrder",
            method: "GET",
            pathParams: {},
            queryParams: { [param1]: "value" },
            body: undefined,
          };

          const result1Pass = await executeValidation(context1WithParam);
          expect(result1Pass.pass).toBe(true);

          // Same param1 should NOT satisfy pipeline2 (which needs param2)
          const context2WithParam1: RequestContext = {
            apiName: "Orders",
            apiVersion: "2026-01-01",
            operationId: "getOrder",
            method: "GET",
            pathParams: {},
            queryParams: { [param1]: "value" },
            body: undefined,
          };

          const result2StillFails = await executeValidation(context2WithParam1);
          expect(result2StillFails.pass).toBe(false);
          if (!result2StillFails.pass) {
            expect(result2StillFails.body.errors[0].code).toBe("Orders2026");
          }

          // Cleanup
          VALIDATION_REGISTRY.delete(key1);
          VALIDATION_REGISTRY.delete(key2);
        },
      ),
      { numRuns: 100 },
    );
  });
});



/**
 * Feature: deterministic-validation-system
 * Property 15: Nested entity resolution populates both parent and child
 *
 * For any nested entity existence rule and any request context where both the parent
 * entity and child entity exist in the database, the handler SHALL return a pass result
 * that includes the parent entity record keyed by `entityLabel` and the child entity
 * record keyed by `childLabel` in `resolvedEntities`.
 *
 * **Validates: Requirements 10.2**
 */
describe("Feature: deterministic-validation-system, Property 15: Nested entity resolution populates both parent and child", () => {
  const TEST_OPERATION_ID = "__test_nested_resolvedEntities_prop15__";

  beforeEach(() => {
    for (const api of Object.values(Api)) {
      mockDbData[api] = {};
    }
    VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
  });

  it("Property 15: When both parent and child exist, resolvedEntities contains parent keyed by entityLabel and child keyed by childLabel", async () => {
    // Arbitraries for generating nested entity existence rules
    const identifierArb = fc.stringMatching(/^[a-zA-Z0-9]{1,15}$/);
    const labelArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/);
    const fieldNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/);
    const paramSourceArb = fc.constantFrom("path" as const, "query" as const);
    // Generate extra field values for richer entity data
    const extraFieldValueArb = fc.oneof(fc.string({ minLength: 1, maxLength: 15 }), fc.integer(), fc.boolean());

    await fc.assert(
      fc.asyncProperty(
        fieldNameArb, // parentParamName
        paramSourceArb, // parentParamSource
        labelArb, // parentLabel (entityLabel)
        fieldNameArb, // childParamName
        paramSourceArb, // childParamSource
        fieldNameArb, // childCollection
        fieldNameArb, // childIdField
        labelArb, // childLabel
        identifierArb, // parentId
        identifierArb, // childId
        extraFieldValueArb, // extra parent field value
        extraFieldValueArb, // extra child field value
        async (parentParamName, parentParamSource, parentLabel, childParamName, childParamSource, childCollection, childIdField, childLabel, parentId, childId, extraParentValue, extraChildValue) => {
          // Preconditions to avoid collisions
          fc.pre(parentParamName !== childParamName);
          fc.pre(childCollection !== parentParamName);
          fc.pre(childCollection !== childIdField);
          fc.pre(parentLabel !== childLabel);

          // Build the nested EntityExistenceRule
          const rule: EntityExistenceRule = {
            checkType: "entityExistence",
            entity: {
              api: Api.ORDERS,
              paramName: parentParamName,
              paramSource: parentParamSource,
              entityLabel: parentLabel,
            },
            nested: {
              childParamName,
              childParamSource,
              childCollection,
              childIdField,
              childLabel,
            },
            failAction: {
              statusCode: 404,
              code: "NotFound",
              message: "Entity not found",
            },
          };

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          // Build the parent entity with the child in its collection
          const childEntity: Record<string, unknown> = {
            [childIdField]: childId,
            extraChildField: extraChildValue,
          };

          const parentEntity: Record<string, unknown> = {
            [parentParamName]: parentId,
            [childCollection]: [childEntity],
            extraParentField: extraParentValue,
          };

          // Populate mock database — use the parentId as key for direct lookup
          mockDbData[Api.ORDERS] = { [parentId]: parentEntity };

          // Build request context with both parent and child IDs
          const pathParams: Record<string, string> = {};
          const queryParams: Record<string, string | string[] | undefined> = {};

          if (parentParamSource === "path") {
            pathParams[parentParamName] = parentId;
          } else {
            queryParams[parentParamName] = parentId;
          }

          if (childParamSource === "path") {
            pathParams[childParamName] = childId;
          } else {
            queryParams[childParamName] = childId;
          }

          const context: RequestContext = {
            apiName: "TestApi",
            apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams,
            queryParams,
            body: undefined,
          };

          const result = await executeValidation(context);

          // The rule should pass since both parent and child exist
          expect(result.pass).toBe(true);

          if (result.pass) {
            // resolvedEntities should contain the parent keyed by entityLabel
            expect(result.resolvedEntities).toHaveProperty(parentLabel);
            expect(result.resolvedEntities[parentLabel]).toEqual(parentEntity);

            // resolvedEntities should contain the child keyed by childLabel
            expect(result.resolvedEntities).toHaveProperty(childLabel);
            expect(result.resolvedEntities[childLabel]).toEqual(childEntity);
          }

          // Cleanup
          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
          mockDbData[Api.ORDERS] = {};
        },
      ),
      { numRuns: 100 },
    );
  });
});



/**
 * Feature: deterministic-validation-system
 * Property 14: Flat entity resolution populates resolvedEntities
 *
 * For any entity existence rule (flat, non-nested) and any request context where
 * the entity identifier resolves and the entity exists in the database, the handler
 * SHALL return a pass result that includes the full database record of the resolved
 * entity in `resolvedEntities`, keyed by the rule's `entityLabel`.
 *
 * **Validates: Requirements 10.1**
 */
describe("Feature: deterministic-validation-system, Property 14: Flat entity resolution populates resolvedEntities", () => {
  const TEST_OPERATION_ID = "__test_flat_entity_resolution_prop14__";

  beforeEach(() => {
    // Reset all API partitions in mock database
    for (const api of Object.values(Api)) {
      mockDbData[api] = {};
    }
    VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
  });

  it("Property 14: Flat entity existence pass includes full entity record in resolvedEntities keyed by entityLabel", async () => {
    // Generate arbitrary entity data fields (non-trivial objects)
    const entityFieldsArb = fc.dictionary(
      fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/),
      fc.oneof(fc.string({ minLength: 1, maxLength: 20 }), fc.integer(), fc.boolean()),
      { minKeys: 1, maxKeys: 5 },
    );

    // Generate an entity identifier (non-empty, valid string)
    const identifierArb = fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/);

    // Generate a paramName for the entity identifier
    const paramNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/);

    // Generate a paramSource
    const paramSourceArb = fc.constantFrom("path" as const, "query" as const, "body" as const);

    // Generate an entityLabel
    const entityLabelArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/).filter((s) => s.trim().length > 0);

    // Pick an API partition
    const apiArb = fc.constantFrom(Api.ORDERS, Api.LISTINGS, Api.CATALOG, Api.INVENTORY, Api.EXT_FULFILLMENT_SHIPMENTS);

    await fc.assert(
      fc.asyncProperty(
        entityFieldsArb,
        identifierArb,
        paramNameArb,
        paramSourceArb,
        entityLabelArb,
        apiArb,
        async (entityFields, identifier, paramName, paramSource, entityLabel, api) => {
          // Build the full entity record: must include the paramName field so the handler can find it
          const fullEntity: Record<string, unknown> = {
            ...entityFields,
            [paramName]: identifier,
          };

          // Store entity in the mock database under the chosen API partition
          mockDbData[api] = { [identifier]: fullEntity };

          // Build the EntityExistenceRule (flat, no nested)
          const rule: EntityExistenceRule = {
            checkType: "entityExistence",
            entity: {
              api,
              paramName,
              paramSource,
              entityLabel,
            },
            failAction: {
              statusCode: 404,
              code: "NotFound",
              message: `${entityLabel} not found`,
            },
          };

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule] as ValidationPipeline);

          // Build request context with the entity identifier in the correct source
          const pathParams: Record<string, string> = {};
          const queryParams: Record<string, string | string[] | undefined> = {};
          let body: Record<string, unknown> | undefined;

          switch (paramSource) {
            case "path":
              pathParams[paramName] = identifier;
              break;
            case "query":
              queryParams[paramName] = identifier;
              break;
            case "body":
              body = { [paramName]: identifier };
              break;
          }

          const context: RequestContext = {
            apiName: "TestApi",
            apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams,
            queryParams,
            body,
          };

          const result = await executeValidation(context);

          // Key property: result passes and resolvedEntities contains the full entity record
          expect(result.pass).toBe(true);

          if (result.pass) {
            // resolvedEntities must be keyed by the entityLabel
            expect(result.resolvedEntities).toHaveProperty(entityLabel);
            // The resolved entity must be the full database record
            expect(result.resolvedEntities[entityLabel]).toEqual(fullEntity);
          }

          // Cleanup
          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
          mockDbData[api] = {};
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: deterministic-validation-system
 * Property 16: Pipeline accumulates resolvedEntities and passes them to handlers
 *
 * For any validation pipeline containing one or more entity existence rules that all pass,
 * the final pass result SHALL contain a `resolvedEntities` map that aggregates entries from
 * every passing entity existence rule. Additionally, each rule handler in the pipeline SHALL
 * receive the accumulated `resolvedEntities` map (containing entries from all prior passing
 * entity existence rules) as a parameter. If the pipeline contains no entity existence rules
 * or none resolve an entity, the `resolvedEntities` map SHALL be empty (not omitted).
 *
 * **Validates: Requirements 10.3, 10.4, 10.5, 10.6**
 */
import { registerRuleHandler } from "../../src/service/validationEngine.js";
import { ValidationPass } from "../../src/validation/validationTypes.js";
import { buildKey } from "../../src/registry/operationRegistry.js";

describe("Feature: deterministic-validation-system, Property 16: Pipeline accumulates resolvedEntities and passes them to handlers", () => {
  const TEST_OPERATION_ID = "__test_pipeline_resolvedEntities_prop16__";

  beforeEach(() => {
    // Reset all API partitions in mock database
    for (const api of Object.values(Api)) {
      mockDbData[api] = {};
    }
    VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
  });

  it("Property 16: Final result aggregates resolvedEntities from all passing entity existence rules", async () => {
    // Generate 2-4 distinct entity labels, each with unique entity data
    const entityCountArb = fc.integer({ min: 2, max: 4 });
    const identifierArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,10}$/);

    await fc.assert(
      fc.asyncProperty(
        entityCountArb,
        fc.array(identifierArb, { minLength: 4, maxLength: 4 }),
        async (entityCount, identifiers) => {
          // Use unique labels and param names for each entity existence rule
          const labels: string[] = [];
          const paramNames: string[] = [];
          const entityIds: string[] = [];

          for (let i = 0; i < entityCount; i++) {
            labels.push(`entity_label_${i}`);
            paramNames.push(`entityId_${i}`);
            entityIds.push(`${identifiers[i]}_${i}`);
          }

          // Ensure all labels are unique
          fc.pre(new Set(labels).size === labels.length);
          fc.pre(new Set(paramNames).size === paramNames.length);

          // Build entity existence rules for each entity
          const pipeline: EntityExistenceRule[] = labels.map((label, idx) => ({
            checkType: "entityExistence" as const,
            entity: {
              api: Api.ORDERS,
              paramName: paramNames[idx],
              paramSource: "path" as const,
              entityLabel: label,
            },
            failAction: {
              statusCode: 404,
              code: "NotFound",
              message: `${label} not found`,
            },
          }));

          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), pipeline as ValidationPipeline);

          // Populate the database with entities that match the identifiers
          const expectedEntities: Record<string, Record<string, unknown>> = {};
          for (let i = 0; i < entityCount; i++) {
            const entityData: Record<string, unknown> = {
              [paramNames[i]]: entityIds[i],
              someField: `value_${i}`,
              index: i,
            };
            mockDbData[Api.ORDERS] = mockDbData[Api.ORDERS] ?? {};
            (mockDbData[Api.ORDERS] as Record<string, unknown>)[entityIds[i]] = entityData;
            expectedEntities[labels[i]] = entityData;
          }

          // Build path params with all entity identifiers
          const pathParams: Record<string, string> = {};
          for (let i = 0; i < entityCount; i++) {
            pathParams[paramNames[i]] = entityIds[i];
          }

          const context: RequestContext = {
            apiName: "TestApi",
            apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams,
            queryParams: {},
            body: undefined,
          };

          const result = await executeValidation(context);

          // All rules pass → result should be pass with aggregated resolvedEntities
          expect(result.pass).toBe(true);

          const passResult = result as ValidationPass;
          expect(passResult.resolvedEntities).toBeDefined();

          // Verify all entity labels are present in the result's resolvedEntities
          for (let i = 0; i < entityCount; i++) {
            expect(passResult.resolvedEntities[labels[i]]).toBeDefined();
            expect(passResult.resolvedEntities[labels[i]][paramNames[i]]).toBe(entityIds[i]);
          }

          // Cleanup
          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
          mockDbData[Api.ORDERS] = {};
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 16: Each subsequent handler receives accumulated resolvedEntities from prior rules", async () => {
    // Strategy: Use a custom handler that captures the resolvedEntities it receives.
    // Place entity existence rules before it in the pipeline. Verify the custom handler
    // sees all entities resolved by prior entityExistence rules.

    const CUSTOM_CHECK_TYPE = "__test_custom_spy_prop16__";
    const capturedEntitiesList: Record<string, Record<string, unknown>>[] = [];

    // Register a custom spy handler that captures the resolvedEntities parameter
    registerRuleHandler(CUSTOM_CHECK_TYPE, async (_rule, _context, resolvedEntities) => {
      capturedEntitiesList.push({ ...resolvedEntities });
      return { pass: true, resolvedEntities: {} };
    });

    const entityCountArb = fc.integer({ min: 1, max: 3 });
    const identifierArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,10}$/);

    await fc.assert(
      fc.asyncProperty(
        entityCountArb,
        fc.array(identifierArb, { minLength: 3, maxLength: 3 }),
        async (entityCount, identifiers) => {
          capturedEntitiesList.length = 0;

          const labels: string[] = [];
          const paramNames: string[] = [];
          const entityIds: string[] = [];

          for (let i = 0; i < entityCount; i++) {
            labels.push(`spy_entity_${i}`);
            paramNames.push(`spyId_${i}`);
            entityIds.push(`${identifiers[i]}_${i}`);
          }

          fc.pre(new Set(labels).size === labels.length);
          fc.pre(new Set(paramNames).size === paramNames.length);

          // Build pipeline: entityExistence rules followed by a spy handler
          const entityRules: EntityExistenceRule[] = labels.map((label, idx) => ({
            checkType: "entityExistence" as const,
            entity: {
              api: Api.ORDERS,
              paramName: paramNames[idx],
              paramSource: "path" as const,
              entityLabel: label,
            },
            failAction: {
              statusCode: 404,
              code: "NotFound",
              message: `${label} not found`,
            },
          }));

          // Add the spy rule at the end of the pipeline
          const spyRule = {
            checkType: CUSTOM_CHECK_TYPE,
            failAction: {
              statusCode: 400,
              code: "Spy",
              message: "Spy rule",
            },
          };

          const pipeline = [...entityRules, spyRule] as ValidationPipeline;
          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), pipeline);

          // Populate database with entities
          mockDbData[Api.ORDERS] = {};
          for (let i = 0; i < entityCount; i++) {
            const entityData: Record<string, unknown> = {
              [paramNames[i]]: entityIds[i],
              data: `data_${i}`,
            };
            (mockDbData[Api.ORDERS] as Record<string, unknown>)[entityIds[i]] = entityData;
          }

          // Build path params
          const pathParams: Record<string, string> = {};
          for (let i = 0; i < entityCount; i++) {
            pathParams[paramNames[i]] = entityIds[i];
          }

          const context: RequestContext = {
            apiName: "TestApi",
            apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams,
            queryParams: {},
            body: undefined,
          };

          const result = await executeValidation(context);
          expect(result.pass).toBe(true);

          // The spy handler should have been called once
          expect(capturedEntitiesList.length).toBe(1);

          // The captured resolvedEntities should contain ALL entity labels from prior rules
          const captured = capturedEntitiesList[0];
          for (let i = 0; i < entityCount; i++) {
            expect(captured[labels[i]]).toBeDefined();
            expect(captured[labels[i]][paramNames[i]]).toBe(entityIds[i]);
          }

          // Cleanup
          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
          mockDbData[Api.ORDERS] = {};
          capturedEntitiesList.length = 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 16: Pipelines with no entity existence rules return empty resolvedEntities map (not absent)", async () => {
    // Generate pipelines with only parameter constraint rules (no entity existence)
    const paramCountArb = fc.integer({ min: 1, max: 4 });

    await fc.assert(
      fc.asyncProperty(paramCountArb, async (paramCount) => {
        // Build a pipeline with only atLeastOneRequired rules (all will pass)
        const paramNames: string[] = [];
        for (let i = 0; i < paramCount; i++) {
          paramNames.push(`nonEntityParam_${i}`);
        }

        const pipeline: AtLeastOneRequiredRule[] = paramNames.map((name) => ({
          checkType: "atLeastOneRequired" as const,
          params: [{ name, source: "query" as const }],
          failAction: {
            statusCode: 400,
            code: "InvalidInput",
            message: `At least one of '${name}' must be provided`,
          },
        }));

        VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), pipeline as ValidationPipeline);

        // Provide all params so every rule passes
        const queryParams: Record<string, string> = {};
        for (const name of paramNames) {
          queryParams[name] = "present-value";
        }

        const context: RequestContext = {
          apiName: "TestApi",
          apiVersion: "v1",
          operationId: TEST_OPERATION_ID,
          method: "GET",
          pathParams: {},
          queryParams,
          body: undefined,
        };

        const result = await executeValidation(context);

        // Should pass with empty resolvedEntities (not absent/undefined)
        expect(result.pass).toBe(true);

        const passResult = result as ValidationPass;
        expect(passResult.resolvedEntities).toBeDefined();
        expect(passResult.resolvedEntities).toEqual({});

        // Cleanup
        VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: deterministic-validation-system
 * Property 17: Last-write-wins for duplicate entity labels
 *
 * For any validation pipeline containing two entity existence rules that both pass
 * and produce a resolved entity with the same label key, the final `resolvedEntities`
 * map SHALL contain only the entity data from the later (higher array-index) rule,
 * overwriting the earlier entry.
 *
 * **Validates: Requirements 10.7**
 */
describe("Feature: deterministic-validation-system, Property 17: Last-write-wins for duplicate entity labels", () => {
  const TEST_OPERATION_ID = "__test_last_write_wins_prop17__";

  beforeEach(() => {
    for (const api of Object.values(Api)) {
      mockDbData[api] = {};
    }
    VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
  });

  it("Property 17: When two entity existence rules use the same entityLabel, the final resolvedEntities contains only the later rule's entity data", async () => {
    // Generate two distinct identifiers and entity data for the same label
    const identifierArb = fc.stringMatching(/^[a-zA-Z0-9]{3,15}$/);
    const entityLabelArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/);
    const extraFieldValueArb = fc.oneof(fc.string({ minLength: 1, maxLength: 15 }), fc.integer(), fc.boolean());

    await fc.assert(
      fc.asyncProperty(
        entityLabelArb, // shared entityLabel for both rules
        identifierArb, // first entity identifier
        identifierArb, // second entity identifier
        extraFieldValueArb, // extra field value for first entity
        extraFieldValueArb, // extra field value for second entity
        async (sharedLabel, firstId, secondId, firstExtra, secondExtra) => {
          // Ensure the two identifiers are different so we get two distinct entities
          fc.pre(firstId !== secondId);

          // Use different paramNames so the rules look up different identifiers
          const firstParamName = "firstEntityId";
          const secondParamName = "secondEntityId";

          // Build two entity existence rules with the SAME entityLabel
          const rule1: EntityExistenceRule = {
            checkType: "entityExistence",
            entity: {
              api: Api.ORDERS,
              paramName: firstParamName,
              paramSource: "path",
              entityLabel: sharedLabel,
            },
            failAction: {
              statusCode: 404,
              code: "NotFound",
              message: `${sharedLabel} not found`,
            },
          };

          const rule2: EntityExistenceRule = {
            checkType: "entityExistence",
            entity: {
              api: Api.ORDERS,
              paramName: secondParamName,
              paramSource: "path",
              entityLabel: sharedLabel,
            },
            failAction: {
              statusCode: 404,
              code: "NotFound",
              message: `${sharedLabel} not found`,
            },
          };

          // Register pipeline with rule1 first, then rule2 (later in array)
          VALIDATION_REGISTRY.set(buildKey("TestApi", "v1", TEST_OPERATION_ID), [rule1, rule2] as ValidationPipeline);

          // Create two distinct entities in the database
          const firstEntity: Record<string, unknown> = {
            [firstParamName]: firstId,
            extraField: firstExtra,
            source: "first_rule",
          };

          const secondEntity: Record<string, unknown> = {
            [secondParamName]: secondId,
            extraField: secondExtra,
            source: "second_rule",
          };

          mockDbData[Api.ORDERS] = {
            [firstId]: firstEntity,
            [secondId]: secondEntity,
          };

          // Build request context with both identifiers
          const context: RequestContext = {
            apiName: "TestApi",
            apiVersion: "v1",
            operationId: TEST_OPERATION_ID,
            method: "GET",
            pathParams: {
              [firstParamName]: firstId,
              [secondParamName]: secondId,
            },
            queryParams: {},
            body: undefined,
          };

          const result = await executeValidation(context);

          // Both rules should pass since both entities exist
          expect(result.pass).toBe(true);

          if (result.pass) {
            // Key property: the resolvedEntities map should contain ONLY the second entity's data
            // under the shared label (last-write-wins)
            expect(result.resolvedEntities).toHaveProperty(sharedLabel);
            expect(result.resolvedEntities[sharedLabel]).toEqual(secondEntity);

            // Verify it does NOT contain the first entity's data
            expect(result.resolvedEntities[sharedLabel]).not.toEqual(firstEntity);

            // Only one entry should be in the map for this label
            const labelEntries = Object.keys(result.resolvedEntities).filter((k) => k === sharedLabel);
            expect(labelEntries).toHaveLength(1);
          }

          // Cleanup
          VALIDATION_REGISTRY.delete(buildKey("TestApi", "v1", TEST_OPERATION_ID));
          mockDbData[Api.ORDERS] = {};
        },
      ),
      { numRuns: 100 },
    );
  });
});
