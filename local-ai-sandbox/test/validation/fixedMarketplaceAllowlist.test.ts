import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { executeValidation } from "../../src/service/validationEngine.js";
import { FixedMarketplaceAllowlistRuleSchema, RequestContext, ValidationFail, ValidationPipeline } from "../../src/validation/validationTypes.js";
import { TRANSFERS_EU_MARKETPLACE_IDS, VALIDATION_REGISTRY } from "../../src/validation/validationRegistry.js";
import { buildKey } from "../../src/registry/operationRegistry.js";

// Inject test pipelines into an empty registry so the engine resolves our rule.
vi.mock("../../src/validation/validationRegistry.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/validation/validationRegistry.js")>();
  return { ...original, VALIDATION_REGISTRY: new Map() };
});

// The engine touches Context for other rule types; fixedMarketplaceAllowlist does not use it.
vi.mock("../../src/database/Context.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/database/Context.js")>();
  return {
    ...original,
    Context: {
      get instance() {
        return { engine: { get: () => null, find: () => [] } };
      },
    },
  };
});

const API = "Test";
const VERSION = "v1";
const OP = "__fixedMarketplaceAllowlist__";

// The eight fixed EU marketplace IDs the Transfers API restricts to (DE, FR, IT, ES, SE, NL, PL, BE).
// Imported from the registry rather than redeclared, so this test exercises the real
// production allowlist and fails if those two drift apart.
const EU_ALLOWLIST = TRANSFERS_EU_MARKETPLACE_IDS;

function pipeline(source: "path" | "query" | "body", allowedMarketplaceIds: string[] = EU_ALLOWLIST): ValidationPipeline {
  return [
    {
      checkType: "fixedMarketplaceAllowlist",
      param: { name: "marketplaceId", source },
      allowedMarketplaceIds,
      failAction: { statusCode: 400, code: "InvalidInput", message: "marketplaceId is not a supported marketplace" },
    },
  ];
}

function ctx(opts: { query?: Record<string, unknown>; body?: Record<string, unknown>; path?: Record<string, string> }): RequestContext {
  return {
    apiName: API,
    apiVersion: VERSION,
    operationId: OP,
    method: "POST",
    pathParams: (opts.path ?? {}) as Record<string, string>,
    queryParams: (opts.query ?? {}) as Record<string, string | string[] | undefined>,
    body: opts.body,
  };
}

beforeEach(() => {
  VALIDATION_REGISTRY.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FixedMarketplaceAllowlistRuleSchema (Zod)", () => {
  it("accepts a well-formed rule", () => {
    const rule = {
      checkType: "fixedMarketplaceAllowlist",
      param: { name: "marketplaceId", source: "body" },
      allowedMarketplaceIds: EU_ALLOWLIST,
      failAction: { statusCode: 400, code: "InvalidInput", message: "nope" },
    };
    const parsed = FixedMarketplaceAllowlistRuleSchema.safeParse(rule);
    expect(parsed.success).toBe(true);
  });

  it("rejects a rule with an empty allowedMarketplaceIds array", () => {
    const rule = {
      checkType: "fixedMarketplaceAllowlist",
      param: { name: "marketplaceId", source: "body" },
      allowedMarketplaceIds: [],
      failAction: { statusCode: 400, code: "InvalidInput", message: "nope" },
    };
    const parsed = FixedMarketplaceAllowlistRuleSchema.safeParse(rule);
    expect(parsed.success).toBe(false);
  });

  it("rejects a rule missing the param field", () => {
    const rule = {
      checkType: "fixedMarketplaceAllowlist",
      allowedMarketplaceIds: EU_ALLOWLIST,
      failAction: { statusCode: 400, code: "InvalidInput", message: "nope" },
    };
    const parsed = FixedMarketplaceAllowlistRuleSchema.safeParse(rule);
    expect(parsed.success).toBe(false);
  });
});

describe("fixedMarketplaceAllowlist rule handler", () => {
  // Validates: Requirement 8.9 (absent value proceeds to the handler)
  it("passes when the param is absent", async () => {
    VALIDATION_REGISTRY.set(buildKey(API, VERSION, OP), pipeline("body"));
    expect((await executeValidation(ctx({ body: {} }))).pass).toBe(true);
  });

  it("passes when the param is an empty string", async () => {
    VALIDATION_REGISTRY.set(buildKey(API, VERSION, OP), pipeline("body"));
    expect((await executeValidation(ctx({ body: { marketplaceId: "" } }))).pass).toBe(true);
  });

  // Validates: Requirements 8.5, 8.9 (exact allowlist match proceeds)
  it("passes on an exact allowlist match (body source)", async () => {
    VALIDATION_REGISTRY.set(buildKey(API, VERSION, OP), pipeline("body"));
    expect((await executeValidation(ctx({ body: { marketplaceId: "A1PA6795UKMFR9" } }))).pass).toBe(true);
  });

  it("passes on an exact allowlist match (query source)", async () => {
    VALIDATION_REGISTRY.set(buildKey(API, VERSION, OP), pipeline("query"));
    expect((await executeValidation(ctx({ query: { marketplaceId: "A13V1IB3VIYZZH" } }))).pass).toBe(true);
  });

  // Validates: Requirements 8.6, 8.5 (non-allowlisted value is rejected via failAction)
  it("fails via failAction when the value is not on the allowlist", async () => {
    VALIDATION_REGISTRY.set(buildKey(API, VERSION, OP), pipeline("body"));
    const result = await executeValidation(ctx({ body: { marketplaceId: "ATVPDKIKX0DER" } }));
    expect(result.pass).toBe(false);
    const fail = result as ValidationFail;
    expect(fail.statusCode).toBe(400);
    expect(fail.body.errors[0].code).toBe("InvalidInput");
  });

  // Validates: Requirement 8.10 (fixed list, case-sensitive, not region-derived)
  it("fails on a case-mismatched value (case-sensitive exact match)", async () => {
    VALIDATION_REGISTRY.set(buildKey(API, VERSION, OP), pipeline("body"));
    const result = await executeValidation(ctx({ body: { marketplaceId: "a1pa6795ukmfr9" } }));
    expect(result.pass).toBe(false);
    expect((result as ValidationFail).statusCode).toBe(400);
  });

  // Validates: Requirement 8.10 (the allowlist is fixed regardless of REGION)
  it("evaluates against the fixed list regardless of the configured REGION", async () => {
    VALIDATION_REGISTRY.set(buildKey(API, VERSION, OP), pipeline("body"));
    // A valid NA marketplace ID must still be rejected: the fixed EU list does not include it.
    for (const region of ["NA", "EU", "FE", undefined]) {
      if (region === undefined) delete process.env.REGION;
      else process.env.REGION = region;
      const result = await executeValidation(ctx({ body: { marketplaceId: "ATVPDKIKX0DER" } }));
      expect(result.pass).toBe(false);
      // An EU allowlist member always passes, independent of REGION.
      const ok = await executeValidation(ctx({ body: { marketplaceId: "A1PA6795UKMFR9" } }));
      expect(ok.pass).toBe(true);
    }
    delete process.env.REGION;
  });
});
