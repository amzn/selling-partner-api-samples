import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { executeValidation } from "../../src/service/validationEngine.js";
import type { RequestContext, UnifiedValidationPass } from "../../src/validation/validationTypes.js";
import { OPERATIONS_REGISTRY } from "../../src/registry/operationRegistry.js";
import { Context, Api } from "../../src/database/Context.js";

const PRICING_KEY = "Product Pricing:2022-05-01:getFeaturedOfferExpectedPriceBatch";

describe("Product Pricing getFeaturedOfferExpectedPriceBatch Integration Tests", () => {
  beforeEach(() => {
    Context.reset();
    process.env.REGION = "NA";
    process.env.MODE = "Seller";
  });

  afterEach(() => {
    Context.instance.engine.getCollection(Api.LISTINGS)?.clear();
    delete process.env.REGION;
  });

  describe("End-to-end request flow: validation → handler with mixed batch", () => {
    it("returns outer HTTP 200 with correct per-item responses for found SKU, not-found SKU, and invalid marketplace", async () => {
      // Insert a listing for the "found" SKU
      Context.instance.engine.put(Api.LISTINGS, "FOUND-SKU-001", {
        _key: "FOUND-SKU-001",
        sku: "FOUND-SKU-001",
        purchasable_offer: [{ our_price: [{ schedule: [{ value_with_tax: 49.99 }] }] }],
        externally_assigned_product_identifier: [{ value: "B0TESTASN01", type: "asin" }],
        fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT" }],
      });

      const requests = [
        // Item 1: valid marketplace, SKU exists in DB → should succeed
        { marketplaceId: "ATVPDKIKX0DER", sku: "FOUND-SKU-001" },
        // Item 2: valid marketplace, SKU does NOT exist → should get INVALID_SKU error
        { marketplaceId: "ATVPDKIKX0DER", sku: "NONEXISTENT-SKU-999" },
        // Item 3: invalid marketplace ID for NA region → should get InvalidMarketplaceId error
        { marketplaceId: "INVALID_MARKETPLACE_XYZ", sku: "FOUND-SKU-001" },
      ];

      // Step 1: Run validation pipeline
      const validationContext: RequestContext = {
        apiName: "Product Pricing",
        apiVersion: "2022-05-01",
        operationId: "getFeaturedOfferExpectedPriceBatch",
        method: "POST",
        pathParams: {},
        queryParams: {},
        body: { requests },
      };

      const validationResult = await executeValidation(validationContext);
      expect(validationResult.pass).toBe(true);

      // Step 2: Invoke the handler directly (as the controller would after validation passes)
      const handler = OPERATIONS_REGISTRY.get(PRICING_KEY);
      expect(handler).toBeDefined();

      const handlerResult = await handler!(
        {
          pass: true,
          operationId: "getFeaturedOfferExpectedPriceBatch",
          apiName: "Product Pricing",
          apiVersion: "2022-05-01",
          pathParams: {},
          queryParams: {},
          body: { requests },
          resolvedEntities: {},
          operation: {},
        },
        {} as never,
      );

      // Verify outer response is HTTP 200
      expect(handlerResult.statusCode).toBe(200);

      const body = handlerResult.data.body as { responses: Record<string, unknown>[] };
      expect(body.responses).toBeDefined();
      expect(body.responses).toHaveLength(3);

      // Item 1: Found SKU — expect 200 with pricing data
      const item1 = body.responses[0] as {
        request: { marketplaceId: string; sku: string };
        status: { statusCode: number; reasonPhrase: string };
        headers: Record<string, string>;
        body: {
          offerIdentifier: { marketplaceId: string; sku: string; asin: string; fulfillmentType: string };
          featuredOfferExpectedPriceResults: Array<{
            resultStatus: string;
            featuredOfferExpectedPrice: { listingPrice: { currencyCode: string; amount: number } };
            competingFeaturedOffer: {
              offerIdentifier: { marketplaceId: string; sellerId: string; asin: string; fulfillmentType: string };
              condition: string;
              price: { listingPrice: { currencyCode: string; amount: number }; shippingPrice: { currencyCode: string; amount: number } };
            };
            currentFeaturedOffer: {
              offerIdentifier: { marketplaceId: string; sellerId: string; asin: string; fulfillmentType: string };
              condition: string;
              price: { listingPrice: { currencyCode: string; amount: number } };
            };
          }>;
        };
      };

      expect(item1.status.statusCode).toBe(200);
      expect(item1.request.sku).toBe("FOUND-SKU-001");
      expect(item1.request.marketplaceId).toBe("ATVPDKIKX0DER");
      expect(item1.body.offerIdentifier).toBeDefined();
      expect(item1.body.offerIdentifier.marketplaceId).toBe("ATVPDKIKX0DER");
      expect(item1.body.offerIdentifier.sku).toBe("FOUND-SKU-001");
      expect(item1.body.offerIdentifier.asin).toBe("B0TESTASN01");
      expect(item1.body.offerIdentifier.fulfillmentType).toBe("MFN");
      expect(item1.body.featuredOfferExpectedPriceResults).toHaveLength(1);
      expect(item1.body.featuredOfferExpectedPriceResults[0].resultStatus).toBe("VALID_FOEP");
      expect(item1.body.featuredOfferExpectedPriceResults[0].featuredOfferExpectedPrice.listingPrice.currencyCode).toBe("USD");
      expect(item1.body.featuredOfferExpectedPriceResults[0].featuredOfferExpectedPrice.listingPrice.amount).toBeGreaterThan(0);
      expect(item1.body.featuredOfferExpectedPriceResults[0].competingFeaturedOffer.condition).toBe("New");
      expect(item1.body.featuredOfferExpectedPriceResults[0].competingFeaturedOffer.price.listingPrice.currencyCode).toBe("USD");
      expect(item1.body.featuredOfferExpectedPriceResults[0].competingFeaturedOffer.price.shippingPrice.currencyCode).toBe("USD");
      expect(item1.body.featuredOfferExpectedPriceResults[0].currentFeaturedOffer.price.listingPrice.currencyCode).toBe("USD");

      // Item 2: Not-found SKU — expect 400 with INVALID_SKU
      const item2 = body.responses[1] as {
        request: { marketplaceId: string; sku: string };
        status: { statusCode: number; reasonPhrase: string };
        body: { errors: Array<{ code: string; message: string }> };
      };

      expect(item2.status.statusCode).toBe(400);
      expect(item2.request.sku).toBe("NONEXISTENT-SKU-999");
      expect(item2.body.errors).toHaveLength(1);
      expect(item2.body.errors[0].code).toBe("INVALID_SKU");

      // Item 3: Invalid marketplace ID — expect 400 with InvalidMarketplaceId
      const item3 = body.responses[2] as {
        request: { marketplaceId: string; sku: string };
        status: { statusCode: number; reasonPhrase: string };
        body: { errors: Array<{ code: string; message: string }> };
      };

      expect(item3.status.statusCode).toBe(400);
      expect(item3.request.marketplaceId).toBe("INVALID_MARKETPLACE_XYZ");
      expect(item3.body.errors).toHaveLength(1);
      expect(item3.body.errors[0].code).toBe("InvalidMarketplaceId");
    });

    it("response shape matches OpenAPI spec structure for success items", async () => {
      // Insert a listing with full data
      Context.instance.engine.put(Api.LISTINGS, "SHAPE-TEST-SKU", {
        _key: "SHAPE-TEST-SKU",
        sku: "SHAPE-TEST-SKU",
        purchasable_offer: [{ our_price: [{ schedule: [{ value_with_tax: 99.99 }] }] }],
        externally_assigned_product_identifier: [{ value: "B0SHAPEASIN", type: "asin" }],
        fulfillment_availability: [{ fulfillment_channel_code: "AMAZON_NA" }],
      });

      const handler = OPERATIONS_REGISTRY.get(PRICING_KEY)!;
      const result = await handler(
        {
          pass: true,
          operationId: "getFeaturedOfferExpectedPriceBatch",
          apiName: "Product Pricing",
          apiVersion: "2022-05-01",
          pathParams: {},
          queryParams: {},
          body: { requests: [{ marketplaceId: "ATVPDKIKX0DER", sku: "SHAPE-TEST-SKU" }] },
          resolvedEntities: {},
          operation: {},
        },
        {} as never,
      );

      const body = result.data.body as { responses: Record<string, unknown>[] };
      const subResponse = body.responses[0] as Record<string, unknown>;

      // Verify top-level sub-response structure per OpenAPI spec
      expect(subResponse).toHaveProperty("request");
      expect(subResponse).toHaveProperty("status");
      expect(subResponse).toHaveProperty("headers");
      expect(subResponse).toHaveProperty("body");

      const status = subResponse.status as { statusCode: number; reasonPhrase: string };
      expect(status.statusCode).toBe(200);
      expect(status.reasonPhrase).toBe("Success");

      const headers = subResponse.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");

      const responseBody = subResponse.body as Record<string, unknown>;
      expect(responseBody).toHaveProperty("offerIdentifier");
      expect(responseBody).toHaveProperty("featuredOfferExpectedPriceResults");

      // Verify offerIdentifier shape
      const offerIdentifier = responseBody.offerIdentifier as Record<string, unknown>;
      expect(offerIdentifier).toHaveProperty("marketplaceId");
      expect(offerIdentifier).toHaveProperty("sku");
      expect(offerIdentifier).toHaveProperty("asin");
      expect(offerIdentifier).toHaveProperty("fulfillmentType");
      expect(offerIdentifier.fulfillmentType).toBe("AFN"); // AMAZON_NA → AFN

      // Verify featuredOfferExpectedPriceResults shape
      const foepResults = responseBody.featuredOfferExpectedPriceResults as Array<Record<string, unknown>>;
      expect(foepResults).toHaveLength(1);

      const foepResult = foepResults[0];
      expect(foepResult).toHaveProperty("resultStatus");
      expect(foepResult).toHaveProperty("featuredOfferExpectedPrice");
      expect(foepResult).toHaveProperty("competingFeaturedOffer");
      expect(foepResult).toHaveProperty("currentFeaturedOffer");

      // Verify MoneyType shapes
      const foep = foepResult.featuredOfferExpectedPrice as { listingPrice: { currencyCode: string; amount: number } };
      expect(foep.listingPrice).toHaveProperty("currencyCode");
      expect(foep.listingPrice).toHaveProperty("amount");
      expect(typeof foep.listingPrice.amount).toBe("number");

      const competing = foepResult.competingFeaturedOffer as {
        offerIdentifier: Record<string, unknown>;
        condition: string;
        price: { listingPrice: { currencyCode: string; amount: number }; shippingPrice: { currencyCode: string; amount: number } };
      };
      expect(competing.offerIdentifier).toHaveProperty("marketplaceId");
      expect(competing.offerIdentifier).toHaveProperty("sellerId");
      expect(competing.offerIdentifier).toHaveProperty("asin");
      expect(competing.offerIdentifier).toHaveProperty("fulfillmentType");
      expect(competing.condition).toBe("New");
      expect(competing.price.listingPrice).toHaveProperty("currencyCode");
      expect(competing.price.listingPrice).toHaveProperty("amount");
      expect(competing.price.shippingPrice).toHaveProperty("currencyCode");
      expect(competing.price.shippingPrice).toHaveProperty("amount");

      const current = foepResult.currentFeaturedOffer as {
        offerIdentifier: Record<string, unknown>;
        condition: string;
        price: { listingPrice: { currencyCode: string; amount: number } };
      };
      expect(current.offerIdentifier).toHaveProperty("marketplaceId");
      expect(current.offerIdentifier).toHaveProperty("sellerId");
      expect(current.offerIdentifier).toHaveProperty("asin");
      expect(current.offerIdentifier).toHaveProperty("fulfillmentType");
      expect(current.condition).toBe("New");
      expect(current.price.listingPrice).toHaveProperty("currencyCode");
      expect(current.price.listingPrice).toHaveProperty("amount");
    });

    it("batch size validation rejects oversized batch before handler executes", async () => {
      const oversizedRequests = Array.from({ length: 41 }, (_, i) => ({
        marketplaceId: "ATVPDKIKX0DER",
        sku: `SKU-${i}`,
      }));

      const validationContext: RequestContext = {
        apiName: "Product Pricing",
        apiVersion: "2022-05-01",
        operationId: "getFeaturedOfferExpectedPriceBatch",
        method: "POST",
        pathParams: {},
        queryParams: {},
        body: { requests: oversizedRequests },
      };

      const result = await executeValidation(validationContext);
      expect(result.pass).toBe(false);
      if (!result.pass) {
        expect(result.statusCode).toBe(400);
        const body = result.body as { errors: Array<{ code: string; message: string }> };
        expect(body.errors[0].code).toBe("InvalidInput");
      }
    });
  });
});
