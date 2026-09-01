import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";
import { executeValidation } from "../../src/service/validationEngine.js";
import { RequestContext, ValidationFail, ValidationPipeline } from "../../src/validation/validationTypes.js";
import { VALIDATION_REGISTRY } from "../../src/validation/validationRegistry.js";
import { buildKey } from "../../src/registry/operationRegistry.js";

// Inject test pipelines into an empty registry.
vi.mock("../../src/validation/validationRegistry.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/validation/validationRegistry.js")>();
  return { ...original, VALIDATION_REGISTRY: new Map() };
});

// The engine touches Context for other rule types; stringLengthLimit does not use it.
vi.mock("../../src/database/Context.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/database/Context.js")>();
  return {
    ...original,
    Context: { get instance() { return { engine: { get: () => null, find: () => [] } }; } },
  };
});

const API = "Test";
const VERSION = "v1";
const OP = "__stringLengthLimit__";

function pipeline(max: number, normalizeWhitespace: boolean): ValidationPipeline {
  return [
    {
      checkType: "stringLengthLimit",
      param: { name: "query", source: "body" },
      max,
      normalizeWhitespace,
      failAction: { statusCode: 400, code: "InvalidInput", message: `must be at most ${String(max)} characters` },
    },
  ];
}

function ctx(query: unknown): RequestContext {
  return { apiName: API, apiVersion: VERSION, operationId: OP, method: "POST", pathParams: {}, queryParams: {}, body: query === undefined ? {} : { query } };
}

beforeEach(() => {
  VALIDATION_REGISTRY.clear();
});

describe("stringLengthLimit rule handler", () => {
  it("passes when length is within the limit", async () => {
    VALIDATION_REGISTRY.set(buildKey(API, VERSION, OP), pipeline(10, false));
    expect((await executeValidation(ctx("short"))).pass).toBe(true);
  });

  it("fails with the configured failAction when length exceeds the limit", async () => {
    VALIDATION_REGISTRY.set(buildKey(API, VERSION, OP), pipeline(5, false));
    const result = await executeValidation(ctx("waytoolong"));
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].code).toBe("InvalidInput");
  });

  it("skips when the value is absent or empty (length check is not a presence check)", async () => {
    VALIDATION_REGISTRY.set(buildKey(API, VERSION, OP), pipeline(3, false));
    expect((await executeValidation(ctx(undefined))).pass).toBe(true);
    expect((await executeValidation(ctx(""))).pass).toBe(true);
  });

  it("normalizeWhitespace collapses runs of whitespace before measuring", async () => {
    VALIDATION_REGISTRY.set(buildKey(API, VERSION, OP), pipeline(5, true));
    // Raw length 11, normalized "a b c" length 5 -> passes.
    expect((await executeValidation(ctx("a   b   c"))).pass).toBe(true);
    // Without normalization the same value would exceed 5.
    VALIDATION_REGISTRY.set(buildKey(API, VERSION, OP), pipeline(5, false));
    expect((await executeValidation(ctx("a   b   c"))).pass).toBe(false);
  });

  // Feature: data-kiosk, Property 10: 8000-Character Boundary
  // **Validates: Requirements 9.1**
  it("Property 10: normalized length <= 8000 passes; > 8000 fails", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 16000 }), async (n) => {
        VALIDATION_REGISTRY.set(buildKey(API, VERSION, OP), pipeline(8000, true));
        // A run of `n` non-space chars normalizes to length n.
        const result = await executeValidation(ctx("x".repeat(n)));
        expect(result.pass).toBe(n <= 8000);
      }),
      { numRuns: 100 },
    );
  });
});
