import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeValidation, getAllowedMarketplaceIds } from "../../src/service/validationEngine.js";
import { RequestContext, ValidationFail, ValidationPipeline } from "../../src/validation/validationTypes.js";
import { VALIDATION_REGISTRY } from "../../src/validation/validationRegistry.js";
import { Api } from "../../src/database/Context.js";
import { buildKey } from "../../src/registry/operationRegistry.js";

// Mock the validation registry so we can inject test pipelines
vi.mock("../../src/validation/validationRegistry.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/validation/validationRegistry.js")>();
  return {
    ...original,
    VALIDATION_REGISTRY: new Map(),
  };
});

// Mock the Context singleton (not used by this handler, but required by the engine)
vi.mock("../../src/database/Context.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/database/Context.js")>();
  return {
    ...original,
    Context: {
      get instance() {
        return {
          engine: {
            get: () => null,
          },
        };
      },
    },
  };
});

const TEST_API_NAME = "TestApi";
const TEST_API_VERSION = "v1";
const TEST_OP = "__test_marketplaceIdValidation__";

const marketplaceIdsQueryPipeline: ValidationPipeline = [
  {
    checkType: "marketplaceIdValidation",
    marketplaceIdsParam: { name: "marketplaceIds", source: "query" },
    failAction: {
      statusCode: 400,
      code: "InvalidInput",
      message: "One or more marketplace IDs are not valid for the configured region",
    },
  },
];

const marketplaceIdsBodyPipeline: ValidationPipeline = [
  {
    checkType: "marketplaceIdValidation",
    marketplaceIdsParam: { name: "marketplaceIds", source: "body" },
    failAction: {
      statusCode: 400,
      code: "InvalidInput",
      message: "One or more marketplace IDs are not valid for the configured region",
    },
  },
];

const marketplaceIdSingularQueryPipeline: ValidationPipeline = [
  {
    checkType: "marketplaceIdValidation",
    marketplaceIdsParam: { name: "marketplaceId", source: "query" },
    failAction: {
      statusCode: 400,
      code: "InvalidInput",
      message: "The marketplace ID is not valid for the configured region",
    },
  },
];

beforeEach(() => {
  VALIDATION_REGISTRY.clear();
});

afterEach(() => {
  delete process.env.REGION;
});

describe("marketplaceIdValidation handler", () => {
  describe("NA region (default)", () => {
    beforeEach(() => {
      delete process.env.REGION;
    });

    it("passes when marketplaceIds contains a valid NA marketplace ID in query", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsQueryPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: ["ATVPDKIKX0DER"] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("passes when all marketplaceIds are valid NA marketplace IDs", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsQueryPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: ["ATVPDKIKX0DER", "A2EUQ1WTGCTBG2", "A1AM78C64UM0Y8", "A2Q3Y263D00KWC"] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("fails when marketplaceIds contains an invalid marketplace ID", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsQueryPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: ["INVALID_ID"] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].code).toBe("InvalidInput");
      expect(fail.body.errors[0].message).toContain("INVALID_ID");
      expect(fail.body.errors[0].message).toContain("NA");
    });

    it("fails when marketplaceIds contains an EU marketplace ID in NA region", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsQueryPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: ["A1F83G8C2ARO7P"] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].message).toContain("A1F83G8C2ARO7P");
    });

    it("fails when mix of valid and invalid marketplace IDs provided", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsQueryPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: ["ATVPDKIKX0DER", "INVALID_ID"] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].message).toContain("INVALID_ID");
      // Only the invalid ID should appear in the "Invalid marketplace ID(s)" prefix
      expect(fail.body.errors[0].message).toMatch(/^Invalid marketplace ID\(s\): INVALID_ID\./);
    });
  });

  describe("EU region", () => {
    beforeEach(() => {
      process.env.REGION = "EU";
    });

    it("passes when marketplaceIds contains valid EU marketplace IDs", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsQueryPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: ["A1F83G8C2ARO7P", "A1PA6795UKMFR9"] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("fails when marketplaceIds contains an NA marketplace ID in EU region", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsQueryPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: ["ATVPDKIKX0DER"] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].message).toContain("ATVPDKIKX0DER");
      expect(fail.body.errors[0].message).toContain("EU");
    });

    it("passes for all 16 EU marketplace IDs", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsQueryPipeline);

      const allEuIds = [
        "A28R8C7NBKEWEA",
        "A1RKKUPIHCS9HS",
        "A1F83G8C2ARO7P",
        "A13V1IB3VIYZZH",
        "AMEN7PMS3EDWL",
        "A1805IZSGTT6HS",
        "A1PA6795UKMFR9",
        "APJ6JRA9NG5V4",
        "A2NODRKZP88ZB9",
        "AE08WJ6YKNBMC",
        "A1C3SOZRARQ6R3",
        "ARBP9OOSHTCHU",
        "A33AVAJ2PDY3EV",
        "A17E79C6D8DWNP",
        "A2VIGQ35RCS4UG",
        "A21TJRUUN4KGV",
      ];

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: allEuIds },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });
  });

  describe("FE region", () => {
    beforeEach(() => {
      process.env.REGION = "FE";
    });

    it("passes when marketplaceIds contains valid FE marketplace IDs", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsQueryPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: ["A1VC38T7YXB528", "A39IBJ37TRP1C6", "A19VAU5U5O7RUS"] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("fails when marketplaceIds contains an NA marketplace ID in FE region", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsQueryPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: ["A2EUQ1WTGCTBG2"] },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].message).toContain("FE");
    });
  });

  describe("body source", () => {
    it("passes when marketplaceIds in body contains valid IDs", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsBodyPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "POST",
        pathParams: {},
        queryParams: {},
        body: { marketplaceIds: ["ATVPDKIKX0DER", "A2EUQ1WTGCTBG2"] },
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("fails when marketplaceIds in body contains invalid IDs", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsBodyPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "POST",
        pathParams: {},
        queryParams: {},
        body: { marketplaceIds: ["INVALID_BODY_ID"] },
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].message).toContain("INVALID_BODY_ID");
    });
  });

  describe("singular marketplaceId (query)", () => {
    it("passes when singular marketplaceId is valid", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdSingularQueryPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceId: "ATVPDKIKX0DER" },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("fails when singular marketplaceId is invalid", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdSingularQueryPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceId: "INVALID_SINGLE" },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(false);
      const fail = result as ValidationFail;
      expect(fail.statusCode).toBe(400);
      expect(fail.body.errors[0].message).toContain("INVALID_SINGLE");
    });
  });

  describe("skip when param absent", () => {
    it("passes when marketplaceIds is undefined", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsQueryPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: {},
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("passes when marketplaceIds is null", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsQueryPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: undefined },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("passes when marketplaceIds is empty string", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsQueryPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "GET",
        pathParams: {},
        queryParams: { marketplaceIds: "" },
        body: undefined,
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });

    it("passes when marketplaceIds is empty array in body", async () => {
      VALIDATION_REGISTRY.set(buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OP), marketplaceIdsBodyPipeline);

      const context: RequestContext = {
        apiName: TEST_API_NAME,
        apiVersion: TEST_API_VERSION,
        operationId: TEST_OP,
        method: "POST",
        pathParams: {},
        queryParams: {},
        body: { marketplaceIds: [] },
      };

      const result = await executeValidation(context);
      expect(result.pass).toBe(true);
    });
  });

  describe("region fallback", () => {
    it("defaults to NA when REGION is unset", () => {
      delete process.env.REGION;
      const allowed = getAllowedMarketplaceIds();
      expect(allowed).toContain("ATVPDKIKX0DER");
      expect(allowed).toHaveLength(4);
    });

    it("defaults to NA when REGION is an invalid value", () => {
      process.env.REGION = "INVALID";
      const allowed = getAllowedMarketplaceIds();
      expect(allowed).toContain("ATVPDKIKX0DER");
      expect(allowed).toHaveLength(4);
    });

    it("returns EU marketplace IDs when REGION is EU", () => {
      process.env.REGION = "EU";
      const allowed = getAllowedMarketplaceIds();
      expect(allowed).toContain("A1F83G8C2ARO7P");
      expect(allowed).toHaveLength(16);
    });

    it("returns FE marketplace IDs when REGION is FE", () => {
      process.env.REGION = "FE";
      const allowed = getAllowedMarketplaceIds();
      expect(allowed).toContain("A1VC38T7YXB528");
      expect(allowed).toHaveLength(3);
    });
  });
});
