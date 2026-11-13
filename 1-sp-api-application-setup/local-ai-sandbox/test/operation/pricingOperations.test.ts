import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OPERATIONS_REGISTRY } from "../../src/registry/operationRegistry.js";
import { executeValidation } from "../../src/service/validationEngine.js";
import { productionPassThroughHandler } from "../../src/operation/passThroughOperations.js";
import type { RequestContext, UnifiedValidationPass } from "../../src/validation/validationTypes.js";
import { getFeaturedOfferExpectedPriceBatchHandler, computeCompetingOfferPrice } from "../../src/operation/pricingOperations.js";
import { Context, Api } from "../../src/database/Context.js";

describe("Handler registration and validation pipeline", () => {
  describe("registry tests", () => {
    it("OPERATIONS_REGISTRY.get returns a handler for getFeaturedOfferExpectedPriceBatch", () => {
      const handler = OPERATIONS_REGISTRY.get("Product Pricing:2022-05-01:getFeaturedOfferExpectedPriceBatch");
      expect(handler).toBeTruthy();
      expect(typeof handler).toBe("function");
    });

    it("isAllowedInCurrentMode returns true for Seller mode", () => {
      // vitest.config.ts sets MODE=Seller
      const allowed = OPERATIONS_REGISTRY.isAllowedInCurrentMode("Product Pricing:2022-05-01:getFeaturedOfferExpectedPriceBatch");
      expect(allowed).toBe(true);
    });

    it("getCompetitiveSummary registration is unchanged (still productionPassThroughHandler)", () => {
      const handler = OPERATIONS_REGISTRY.get("Product Pricing:2022-05-01:getCompetitiveSummary");
      expect(handler).toBeTruthy();
      expect(handler).toBe(productionPassThroughHandler);
    });
  });

  describe("batchSizeLimit validation rule", () => {
    function makeRequestContext(batchSize: number): RequestContext {
      return {
        operationId: "getFeaturedOfferExpectedPriceBatch",
        apiName: "Product Pricing",
        apiVersion: "2022-05-01",
        method: "POST",
        pathParams: {},
        queryParams: {},
        body: {
          requests: Array.from({ length: batchSize }, (_, i) => ({
            marketplaceId: "ATVPDKIKX0DER",
            sku: `SKU-${i}`,
          })),
        },
      };
    }

    it("batch of size 1 passes validation", async () => {
      const result = await executeValidation(makeRequestContext(1));
      expect(result.pass).toBe(true);
    });

    it("batch of exactly 40 passes validation", async () => {
      const result = await executeValidation(makeRequestContext(40));
      expect(result.pass).toBe(true);
    });

    it("batch of 41 fails validation with statusCode 400 and code InvalidInput", async () => {
      const result = await executeValidation(makeRequestContext(41));
      expect(result.pass).toBe(false);
      if (!result.pass) {
        expect(result.statusCode).toBe(400);
        const body = result.body as { errors: Array<{ code: string; message: string }> };
        expect(body.errors[0].code).toBe("InvalidInput");
      }
    });
  });
});

/**
 * Creates a minimal valid UnifiedValidationPass for testing the pricing handler.
 */
function makeHandlerValidationResult(requests: Record<string, unknown>[]): UnifiedValidationPass {
  return {
    pass: true,
    operationId: "getFeaturedOfferExpectedPriceBatch",
    apiName: "Product Pricing",
    apiVersion: "2022-05-01",
    pathParams: {},
    queryParams: {},
    body: { requests },
    resolvedEntities: {},
    operation: {},
  };
}

describe("getFeaturedOfferExpectedPriceBatch edge cases", () => {
  beforeEach(() => {
    Context.reset();
    process.env.REGION = "NA";
  });

  afterEach(() => {
    Context.instance.engine.getCollection(Api.LISTINGS)?.clear();
  });

  describe("missing purchasable_offer falls back to default price 29.99", () => {
    it("competing offer price is computed from default price 29.99", async () => {
      Context.instance.engine.put(Api.LISTINGS, "SKU1", { _key: "SKU1", sku: "SKU1" });

      const result = await getFeaturedOfferExpectedPriceBatchHandler(
        makeHandlerValidationResult([{ marketplaceId: "ATVPDKIKX0DER", sku: "SKU1" }]),
        {} as never,
      );

      const responses = (result.data.body as { responses: Record<string, unknown>[] }).responses;
      const subResponse = responses[0] as {
        status: { statusCode: number };
        body: {
          featuredOfferExpectedPriceResults: Array<{
            competingFeaturedOffer: { price: { listingPrice: { amount: number } } };
          }>;
        };
      };

      expect(subResponse.status.statusCode).toBe(200);

      const expectedCompetingPrice = computeCompetingOfferPrice(29.99, "SKU1");
      const actualCompetingPrice = subResponse.body.featuredOfferExpectedPriceResults[0].competingFeaturedOffer.price.listingPrice.amount;
      expect(actualCompetingPrice).toBe(expectedCompetingPrice);
    });
  });

  describe("missing externally_assigned_product_identifier generates deterministic ASIN", () => {
    it("generates an ASIN starting with B0 when listing has no ASIN identifiers", async () => {
      Context.instance.engine.put(Api.LISTINGS, "SKU2", { _key: "SKU2", sku: "SKU2" });

      const result = await getFeaturedOfferExpectedPriceBatchHandler(
        makeHandlerValidationResult([{ marketplaceId: "ATVPDKIKX0DER", sku: "SKU2" }]),
        {} as never,
      );

      const responses = (result.data.body as { responses: Record<string, unknown>[] }).responses;
      const body = responses[0].body as { offerIdentifier: { asin: string } };

      expect(body.offerIdentifier.asin).toMatch(/^B0/);
    });

    it("generates the same ASIN deterministically for the same SKU", async () => {
      Context.instance.engine.put(Api.LISTINGS, "SKU2", { _key: "SKU2", sku: "SKU2" });

      const result1 = await getFeaturedOfferExpectedPriceBatchHandler(
        makeHandlerValidationResult([{ marketplaceId: "ATVPDKIKX0DER", sku: "SKU2" }]),
        {} as never,
      );

      const result2 = await getFeaturedOfferExpectedPriceBatchHandler(
        makeHandlerValidationResult([{ marketplaceId: "ATVPDKIKX0DER", sku: "SKU2" }]),
        {} as never,
      );

      const asin1 = (result1.data.body as { responses: Array<{ body: { offerIdentifier: { asin: string } } }> }).responses[0].body
        .offerIdentifier.asin;
      const asin2 = (result2.data.body as { responses: Array<{ body: { offerIdentifier: { asin: string } } }> }).responses[0].body
        .offerIdentifier.asin;

      expect(asin1).toBe(asin2);
    });
  });

  describe("fulfillment_channel_code AMAZON_NA maps to AFN", () => {
    it("returns fulfillmentType AFN when fulfillment_channel_code is AMAZON_NA", async () => {
      Context.instance.engine.put(Api.LISTINGS, "SKU3", {
        _key: "SKU3",
        sku: "SKU3",
        fulfillment_availability: [{ fulfillment_channel_code: "AMAZON_NA" }],
      });

      const result = await getFeaturedOfferExpectedPriceBatchHandler(
        makeHandlerValidationResult([{ marketplaceId: "ATVPDKIKX0DER", sku: "SKU3" }]),
        {} as never,
      );

      const responses = (result.data.body as { responses: Record<string, unknown>[] }).responses;
      const body = responses[0].body as { offerIdentifier: { fulfillmentType: string } };

      expect(body.offerIdentifier.fulfillmentType).toBe("AFN");
    });
  });

  describe("default fulfillment maps to MFN", () => {
    it("returns fulfillmentType MFN when listing has no fulfillment_availability", async () => {
      Context.instance.engine.put(Api.LISTINGS, "SKU4", { _key: "SKU4", sku: "SKU4" });

      const result = await getFeaturedOfferExpectedPriceBatchHandler(
        makeHandlerValidationResult([{ marketplaceId: "ATVPDKIKX0DER", sku: "SKU4" }]),
        {} as never,
      );

      const responses = (result.data.body as { responses: Record<string, unknown>[] }).responses;
      const body = responses[0].body as { offerIdentifier: { fulfillmentType: string } };

      expect(body.offerIdentifier.fulfillmentType).toBe("MFN");
    });
  });
});
