import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { getFeaturedOfferExpectedPriceBatchHandler } from "../../src/operation/pricingOperations.js";
import { Context, Api } from "../../src/database/Context.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

describe("getFeaturedOfferExpectedPriceBatch Property-Based Tests", () => {
  beforeEach(() => {
    Context.reset();
    process.env.REGION = "NA";
  });

  afterEach(() => {
    Context.instance.engine.getCollection(Api.LISTINGS)?.clear();
  });

  // Feature: product-pricing-api, Property 1: Batch response cardinality
  it("Property 1: Batch response cardinality", async () => {
    /**
     * Validates: Requirements 3.1
     *
     * For any valid batch request containing N items (1 <= N <= 40), the handler
     * SHALL return a `responses` array with exactly N entries.
     */
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 40 }), async (batchSize) => {
        // Build a requests array of the generated batch size
        // Each item uses a valid NA marketplace ID and a unique SKU
        const requests = Array.from({ length: batchSize }, (_, i) => ({
          marketplaceId: "ATVPDKIKX0DER",
          sku: `BATCH-SKU-${i}`,
        }));

        const validationResult: UnifiedValidationPass = {
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

        // SKUs don't exist in DB — handler still produces one sub-response per item
        const context = await getFeaturedOfferExpectedPriceBatchHandler(validationResult, {} as never);
        const body = context.data.body as { responses: unknown[] };
        expect(body.responses).toHaveLength(batchSize);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: product-pricing-api, Property 3: FOEP price bound relative to competing offer
  it("Property 3: FOEP price bound relative to competing offer", async () => {
    /**
     * Validates: Requirements 3.4
     *
     * For any listing that exists in the database with a resolvable price, the
     * featuredOfferExpectedPrice.listingPrice.amount SHALL be between 2% and 8%
     * below the competingFeaturedOffer.price.listingPrice.amount.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(0.01), max: Math.fround(9999.99), noNaN: true }),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        async (listingPrice, skuBase) => {
          const sku = `FOEP-${skuBase}`;

          // Insert a listing into the DB with the generated price
          Context.instance.engine.put(Api.LISTINGS, sku, {
            _key: sku,
            sku,
            purchasable_offer: [
              {
                our_price: [
                  {
                    schedule: [{ value_with_tax: listingPrice }],
                  },
                ],
              },
            ],
          });

          const validationResult: UnifiedValidationPass = {
            pass: true,
            operationId: "getFeaturedOfferExpectedPriceBatch",
            apiName: "Product Pricing",
            apiVersion: "2022-05-01",
            pathParams: {},
            queryParams: {},
            body: {
              requests: [{ marketplaceId: "ATVPDKIKX0DER", sku, uri: "/products/pricing/v0/items", method: "GET" }],
            },
            resolvedEntities: {},
            operation: {},
          };

          const context = await getFeaturedOfferExpectedPriceBatchHandler(validationResult, {} as never);

          const responses = (context.data.body as { responses: Record<string, unknown>[] }).responses;
          const subResponse = responses[0] as {
            body: {
              featuredOfferExpectedPriceResults: Array<{
                featuredOfferExpectedPrice: { listingPrice: { amount: number } };
                competingFeaturedOffer: { price: { listingPrice: { amount: number } } };
              }>;
            };
          };

          const foepPrice = subResponse.body.featuredOfferExpectedPriceResults[0].featuredOfferExpectedPrice.listingPrice.amount;
          const competingPrice = subResponse.body.featuredOfferExpectedPriceResults[0].competingFeaturedOffer.price.listingPrice.amount;

          // FOEP should be at most 8% below competing offer (i.e., >= 92% of competing)
          // Account for cent-rounding: tolerance of 0.01 (one cent) for rounding effects on small prices
          expect(foepPrice).toBeGreaterThanOrEqual(competingPrice * 0.92 - 0.01);
          // FOEP should be at least 2% below competing offer (i.e., <= 98% of competing)
          expect(foepPrice).toBeLessThanOrEqual(competingPrice * 0.98 + 0.01);

          // Clean up after each iteration
          Context.instance.engine.getCollection(Api.LISTINGS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: product-pricing-api, Property 2: Not-found SKU error response
  it("Property 2: Not-found SKU error response", async () => {
    /**
     * Validates: Requirements 3.3
     *
     * For any SKU string that does not exist as a `_key` in the `listings` namespace,
     * the corresponding sub-response SHALL have `status.statusCode` 400 and a `body.errors`
     * array containing an object with `code` equal to `"INVALID_SKU"`.
     */
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (sku) => {
        // DB listings are cleared in afterEach — no SKUs exist at the start of each test
        const validationResult: UnifiedValidationPass = {
          pass: true,
          operationId: "getFeaturedOfferExpectedPriceBatch",
          apiName: "Product Pricing",
          apiVersion: "2022-05-01",
          pathParams: {},
          queryParams: {},
          body: {
            requests: [{ marketplaceId: "ATVPDKIKX0DER", sku }],
          },
          resolvedEntities: {},
          operation: {},
        };

        const result = await getFeaturedOfferExpectedPriceBatchHandler(validationResult, {} as never);

        const responses = (result.data.body as { responses: Record<string, unknown>[] }).responses;
        expect(responses).toHaveLength(1);

        const subResponse = responses[0] as { status: { statusCode: number }; body: { errors: { code: string }[] } };
        expect(subResponse.status.statusCode).toBe(400);
        expect(subResponse.body.errors).toBeInstanceOf(Array);
        expect(subResponse.body.errors.length).toBeGreaterThanOrEqual(1);
        expect(subResponse.body.errors[0].code).toBe("INVALID_SKU");
      }),
      { numRuns: 100 },
    );
  });

  // Feature: product-pricing-api, Property 4: Competing offer structural invariant
  it("Property 4: Competing offer structural invariant", async () => {
    /**
     * Validates: Requirements 3.5
     *
     * For any found listing, the competingFeaturedOffer SHALL have a sellerId distinct
     * from any seller ID derivable from the listing, condition equal to "New", and a
     * price object containing both listingPrice and shippingPrice with valid MoneyType values.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        async (sku) => {
          // Insert a minimal listing into the DB
          Context.instance.engine.put(Api.LISTINGS, sku, { _key: sku, sku });

          // Build a valid request
          const validationResult: UnifiedValidationPass = {
            pass: true,
            operationId: "getFeaturedOfferExpectedPriceBatch",
            apiName: "Product Pricing",
            apiVersion: "2022-05-01",
            pathParams: {},
            queryParams: {},
            body: {
              requests: [{ marketplaceId: "ATVPDKIKX0DER", sku, uri: "/products/pricing/v0/items", method: "GET" }],
            },
            resolvedEntities: {},
            operation: {},
          };

          // Call the handler
          const context = await getFeaturedOfferExpectedPriceBatchHandler(validationResult, {} as never);

          const responses = (context.data.body as { responses: Record<string, unknown>[] }).responses;
          expect(responses).toHaveLength(1);

          const subResponse = responses[0] as { status: { statusCode: number }; body: Record<string, unknown> };
          expect(subResponse.status.statusCode).toBe(200);

          const body = subResponse.body as {
            featuredOfferExpectedPriceResults: Array<{
              competingFeaturedOffer: {
                offerIdentifier: { sellerId: string };
                condition: string;
                price: {
                  listingPrice: { currencyCode: string; amount: number };
                  shippingPrice: { currencyCode: string; amount: number };
                };
              };
            }>;
          };

          const competingOffer = body.featuredOfferExpectedPriceResults[0].competingFeaturedOffer;

          // sellerId is a non-empty string
          expect(competingOffer.offerIdentifier.sellerId).toBeTruthy();
          expect(typeof competingOffer.offerIdentifier.sellerId).toBe("string");
          expect(competingOffer.offerIdentifier.sellerId.length).toBeGreaterThan(0);

          // sellerId is distinct from the current seller
          expect(competingOffer.offerIdentifier.sellerId).not.toBe("CURRENT_SELLER");

          // condition is "New"
          expect(competingOffer.condition).toBe("New");

          // listingPrice has valid MoneyType
          expect(typeof competingOffer.price.listingPrice.currencyCode).toBe("string");
          expect(competingOffer.price.listingPrice.currencyCode.length).toBeGreaterThan(0);
          expect(typeof competingOffer.price.listingPrice.amount).toBe("number");
          expect(competingOffer.price.listingPrice.amount).toBeGreaterThan(0);

          // shippingPrice has valid MoneyType
          expect(typeof competingOffer.price.shippingPrice.currencyCode).toBe("string");
          expect(competingOffer.price.shippingPrice.currencyCode.length).toBeGreaterThan(0);
          expect(typeof competingOffer.price.shippingPrice.amount).toBe("number");
          expect(competingOffer.price.shippingPrice.amount).toBeGreaterThanOrEqual(0);

          // Clean up after each iteration
          Context.instance.engine.getCollection(Api.LISTINGS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: product-pricing-api, Property 5: Offer identifier data preservation
  it("Property 5: Offer identifier data preservation", async () => {
    /**
     * Validates: Requirements 3.6
     *
     * For any found listing with known asin, sku, marketplaceId, and fulfillmentType,
     * the offerIdentifier in the sub-response body SHALL contain values matching the
     * listing's stored data for each of these fields.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        fc.stringMatching(/^[A-Z0-9]{8}$/).map((s) => "B0" + s),
        fc.constantFrom("DEFAULT", "AMAZON_NA"),
        async (sku, asin, channelCode) => {
          // Insert a listing with the generated data
          Context.instance.engine.put(Api.LISTINGS, sku, {
            _key: sku,
            sku,
            externally_assigned_product_identifier: [{ value: asin, type: "asin" }],
            fulfillment_availability: [{ fulfillment_channel_code: channelCode }],
          });

          const validationResult: UnifiedValidationPass = {
            pass: true,
            operationId: "getFeaturedOfferExpectedPriceBatch",
            apiName: "Product Pricing",
            apiVersion: "2022-05-01",
            pathParams: {},
            queryParams: {},
            body: {
              requests: [{ marketplaceId: "ATVPDKIKX0DER", sku, uri: "/products/pricing/v0/items", method: "GET" }],
            },
            resolvedEntities: {},
            operation: {},
          };

          const context = await getFeaturedOfferExpectedPriceBatchHandler(validationResult, {} as never);

          const responses = (context.data.body as { responses: Record<string, unknown>[] }).responses;
          const body = responses[0].body as Record<string, unknown>;
          const offerIdentifier = body.offerIdentifier as {
            sku: string;
            asin: string;
            marketplaceId: string;
            fulfillmentType: string;
          };

          expect(offerIdentifier.sku).toBe(sku);
          expect(offerIdentifier.asin).toBe(asin);
          expect(offerIdentifier.marketplaceId).toBe("ATVPDKIKX0DER");

          const expectedFulfillmentType = channelCode === "AMAZON_NA" ? "AFN" : "MFN";
          expect(offerIdentifier.fulfillmentType).toBe(expectedFulfillmentType);

          // Clean up after each iteration
          Context.instance.engine.getCollection(Api.LISTINGS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: product-pricing-api, Property 6: Marketplace-correct currency codes
  it("Property 6: Marketplace-correct currency codes", async () => {
    /**
     * Validates: Requirements 3.7
     *
     * For any sub-response with status.statusCode 200, all MoneyType objects
     * (in featuredOfferExpectedPrice, competingFeaturedOffer.price, and
     * currentFeaturedOffer.price) SHALL use the currencyCode appropriate to the
     * marketplaceId of that request item.
     */
    const expectedCurrencies: Record<string, string> = {
      ATVPDKIKX0DER: "USD",
      A2EUQ1WTGCTBG2: "CAD",
      A1AM78C64UM0Y8: "MXN",
      A2Q3Y263D00KWC: "BRL",
    };

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("ATVPDKIKX0DER", "A2EUQ1WTGCTBG2", "A1AM78C64UM0Y8", "A2Q3Y263D00KWC"),
        async (marketplaceId) => {
          const sku = `CURRENCY-TEST-${marketplaceId}`;

          // Insert a listing into the DB with a known SKU
          Context.instance.engine.put(Api.LISTINGS, sku, {
            _key: sku,
            sku,
            purchasable_offer: [
              {
                our_price: [
                  {
                    schedule: [{ value_with_tax: 49.99 }],
                  },
                ],
              },
            ],
          });

          const validationResult: UnifiedValidationPass = {
            pass: true,
            operationId: "getFeaturedOfferExpectedPriceBatch",
            apiName: "Product Pricing",
            apiVersion: "2022-05-01",
            pathParams: {},
            queryParams: {},
            body: {
              requests: [{ marketplaceId, sku, uri: "/products/pricing/v0/items", method: "GET" }],
            },
            resolvedEntities: {},
            operation: {},
          };

          const context = await getFeaturedOfferExpectedPriceBatchHandler(validationResult, {} as never);

          const responses = (context.data.body as { responses: Record<string, unknown>[] }).responses;
          const subResponse = responses[0] as {
            status: { statusCode: number };
            body: {
              featuredOfferExpectedPriceResults: Array<{
                featuredOfferExpectedPrice: { listingPrice: { currencyCode: string; amount: number } };
                competingFeaturedOffer: {
                  price: {
                    listingPrice: { currencyCode: string; amount: number };
                    shippingPrice: { currencyCode: string; amount: number };
                  };
                };
                currentFeaturedOffer: {
                  price: {
                    listingPrice: { currencyCode: string; amount: number };
                  };
                };
              }>;
            };
          };

          expect(subResponse.status.statusCode).toBe(200);

          const expectedCurrency = expectedCurrencies[marketplaceId];
          const result = subResponse.body.featuredOfferExpectedPriceResults[0];

          // FOEP listingPrice currency
          expect(result.featuredOfferExpectedPrice.listingPrice.currencyCode).toBe(expectedCurrency);

          // Competing offer listingPrice currency
          expect(result.competingFeaturedOffer.price.listingPrice.currencyCode).toBe(expectedCurrency);

          // Competing offer shippingPrice currency
          expect(result.competingFeaturedOffer.price.shippingPrice.currencyCode).toBe(expectedCurrency);

          // Current offer listingPrice currency
          expect(result.currentFeaturedOffer.price.listingPrice.currencyCode).toBe(expectedCurrency);

          // Clean up after each iteration
          Context.instance.engine.getCollection(Api.LISTINGS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: product-pricing-api, Property 7: Handler determinism (idempotence)
  it("Property 7: Handler determinism (idempotence)", async () => {
    /**
     * Validates: Requirements 4.1, 4.2, 4.3
     *
     * For any valid request and any database state, calling the handler twice with the
     * same inputs SHALL produce deeply equal responses.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        fc.float({ min: Math.fround(0.01), max: Math.fround(9999.99), noNaN: true }),
        fc.constantFrom("DEFAULT", "AMAZON_NA", "AMAZON_EU", "AMAZON_FE"),
        async (skuBase, listingPrice, channelCode) => {
          const sku = `DET-${skuBase}`;

          // Insert a listing into the DB with the generated data
          Context.instance.engine.put(Api.LISTINGS, sku, {
            _key: sku,
            sku,
            purchasable_offer: [
              {
                our_price: [
                  {
                    schedule: [{ value_with_tax: listingPrice }],
                  },
                ],
              },
            ],
            fulfillment_availability: [{ fulfillment_channel_code: channelCode }],
          });

          const validationResult: UnifiedValidationPass = {
            pass: true,
            operationId: "getFeaturedOfferExpectedPriceBatch",
            apiName: "Product Pricing",
            apiVersion: "2022-05-01",
            pathParams: {},
            queryParams: {},
            body: {
              requests: [{ marketplaceId: "ATVPDKIKX0DER", sku, uri: "/products/pricing/v0/items", method: "GET" }],
            },
            resolvedEntities: {},
            operation: {},
          };

          // Call the handler twice with the same inputs
          const result1 = await getFeaturedOfferExpectedPriceBatchHandler(validationResult, {} as never);
          const result2 = await getFeaturedOfferExpectedPriceBatchHandler(validationResult, {} as never);

          // Verify deep equality of response bodies
          expect(result1.data.body).toEqual(result2.data.body);

          // Clean up after each iteration
          Context.instance.engine.getCollection(Api.LISTINGS)?.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: product-pricing-api, Property 8: Invalid marketplace ID rejection
  it("Property 8: Invalid marketplace ID rejection", async () => {
    /**
     * Validates: Requirements 5.1
     *
     * For any marketplace ID string that is not in the set of valid IDs for the
     * configured REGION, the corresponding sub-response SHALL have status.statusCode 400
     * and a body.errors array containing an object with code equal to "InvalidMarketplaceId".
     */
    const validNaMarketplaceIds = ["ATVPDKIKX0DER", "A2EUQ1WTGCTBG2", "A1AM78C64UM0Y8", "A2Q3Y263D00KWC"];

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => !validNaMarketplaceIds.includes(s)),
        async (invalidMarketplaceId) => {
          const validationResult: UnifiedValidationPass = {
            pass: true,
            operationId: "getFeaturedOfferExpectedPriceBatch",
            apiName: "Product Pricing",
            apiVersion: "2022-05-01",
            pathParams: {},
            queryParams: {},
            body: {
              requests: [{ marketplaceId: invalidMarketplaceId, sku: "ANY-SKU-123" }],
            },
            resolvedEntities: {},
            operation: {},
          };

          const result = await getFeaturedOfferExpectedPriceBatchHandler(validationResult, {} as never);

          const responses = (result.data.body as { responses: Record<string, unknown>[] }).responses;
          expect(responses).toHaveLength(1);

          const subResponse = responses[0] as { status: { statusCode: number }; body: { errors: { code: string }[] } };
          expect(subResponse.status.statusCode).toBe(400);
          expect(subResponse.body.errors).toBeInstanceOf(Array);
          expect(subResponse.body.errors.length).toBeGreaterThanOrEqual(1);
          expect(subResponse.body.errors[0].code).toBe("InvalidMarketplaceId");
        },
      ),
      { numRuns: 100 },
    );
  });
});
