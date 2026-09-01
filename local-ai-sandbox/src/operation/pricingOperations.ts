/**
 * Deterministic pricing utilities and handler for the Product Pricing API
 * getFeaturedOfferExpectedPriceBatch operation (v2022-05-01).
 */

import type { OperationContext, OperationHandler } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";
import { getAllowedMarketplaceIds, MARKETPLACE_CURRENCY_MAP } from "../marketplaceIds.js";

// --- Deterministic Price Utilities ---

/**
 * Generates a stable integer hash from a string seed.
 * Uses a simple but deterministic hash algorithm (djb2 variant).
 */
export function deterministicHash(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Computes the competing offer price deterministically.
 * The competing price is 5-20% above the listing price, determined by the SKU hash.
 */
export function computeCompetingOfferPrice(listingPrice: number, sku: string): number {
  const hash = deterministicHash(sku);
  const markup = 1.05 + (hash % 15) / 100;
  return Math.round(listingPrice * markup * 100) / 100;
}

/**
 * Computes the FOEP (Featured Offer Expected Price) deterministically.
 * The FOEP is 2-8% below the competing offer price, determined by the SKU hash.
 */
export function computeFoepPrice(competingPrice: number, sku: string): number {
  const hash = deterministicHash(sku);
  const discountBasis = 2 + (hash % 7);
  return Math.round(competingPrice * (1 - discountBasis / 100) * 100) / 100;
}

/**
 * Generates a deterministic seller ID from an ASIN.
 * Produces a string that resembles an Amazon seller ID format.
 */
export function generateCompetingSellerId(asin: string): string {
  const hash = deterministicHash(asin);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let sellerId = "A";
  let h = hash;
  for (let i = 0; i < 13; i++) {
    sellerId += chars[h % chars.length];
    h = Math.abs((h * 31 + i) ^ (h >>> 3));
  }
  return sellerId;
}

/**
 * Returns the ISO 4217 currency code for a given marketplace ID.
 * Falls back to "USD" if the marketplace is not in the known mapping.
 */
export function getCurrencyForMarketplace(marketplaceId: string): string {
  return MARKETPLACE_CURRENCY_MAP[marketplaceId] ?? "USD";
}

// --- Listing Data Extraction Helpers ---

/**
 * Extracts the listing price from the listing document.
 * Path: purchasable_offer[0].our_price[0].schedule[0].value_with_tax
 * Falls back to 29.99 if the path is not resolvable.
 */
function extractListingPrice(listing: Record<string, unknown>): number {
  try {
    const purchasableOffer = listing.purchasable_offer as Record<string, unknown>[] | undefined;
    if (!purchasableOffer?.[0]) return 29.99;
    const ourPrice = purchasableOffer[0].our_price as Record<string, unknown>[] | undefined;
    if (!ourPrice?.[0]) return 29.99;
    const schedule = ourPrice[0].schedule as Record<string, unknown>[] | undefined;
    if (!schedule?.[0]) return 29.99;
    const value = schedule[0].value_with_tax;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    return 29.99;
  } catch {
    return 29.99;
  }
}

/**
 * Extracts the ASIN from the listing document.
 * Searches externally_assigned_product_identifier for an entry with type === "asin".
 * Falls back to a deterministic ASIN generated from the SKU.
 */
function extractAsin(listing: Record<string, unknown>, sku: string): string {
  try {
    const identifiers = listing.externally_assigned_product_identifier as { value: string; type: string }[] | undefined;
    if (identifiers) {
      const asinEntry = identifiers.find((entry) => entry.type === "asin");
      if (asinEntry?.value) return asinEntry.value;
    }
  } catch {
    // Fall through to deterministic generation
  }
  // Deterministic fallback: generate ASIN from SKU
  const hash = deterministicHash(sku);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let asin = "B0";
  let h = hash;
  for (let i = 0; i < 8; i++) {
    asin += chars[h % chars.length];
    h = Math.abs((h * 31 + i) ^ (h >>> 3));
  }
  return asin;
}

/**
 * Extracts the fulfillment type from the listing document.
 * Maps "AMAZON_NA" / "AMAZON_EU" / "AMAZON_FE" to "AFN", everything else to "MFN".
 * Defaults to "MFN" if the path is not resolvable.
 */
function extractFulfillmentType(listing: Record<string, unknown>): "AFN" | "MFN" {
  try {
    const fulfillmentAvailability = listing.fulfillment_availability as { fulfillment_channel_code: string }[] | undefined;
    if (!fulfillmentAvailability?.[0]) return "MFN";
    const channelCode = fulfillmentAvailability[0].fulfillment_channel_code;
    if (channelCode === "AMAZON_NA" || channelCode === "AMAZON_EU" || channelCode === "AMAZON_FE") {
      return "AFN";
    }
    return "MFN";
  } catch {
    return "MFN";
  }
}

// --- Handler ---

/**
 * Handler for getFeaturedOfferExpectedPriceBatch (Product Pricing API v2022-05-01).
 *
 * Iterates over the batch `requests` array, validates marketplace IDs against
 * the configured region, looks up SKUs in the listings database, and computes
 * deterministic FOEP pricing for each found listing.
 *
 * Always returns outer HTTP 200; per-item errors are expressed as sub-responses.
 */
export const getFeaturedOfferExpectedPriceBatchHandler: OperationHandler = (
  validationResult,
): Promise<OperationContext> => {
  const body = validationResult.body;
  const requests = ((body?.requests ?? []) as Record<string, unknown>[]);
  const allowedMarketplaceIds = getAllowedMarketplaceIds();

  const responses: Record<string, unknown>[] = [];

  for (const requestItem of requests) {
    const marketplaceId = requestItem.marketplaceId as string;
    const sku = requestItem.sku as string;

    // Step 1: Validate marketplace ID against configured region
    if (!allowedMarketplaceIds.includes(marketplaceId)) {
      responses.push({
        request: { marketplaceId, sku },
        status: { statusCode: 400, reasonPhrase: "Bad Request" },
        headers: { "Content-Type": "application/json" },
        body: {
          errors: [
            {
              code: "InvalidMarketplaceId",
              message: "The marketplace ID is not valid for the configured region",
            },
          ],
        },
      });
      continue;
    }

    // Step 2: Look up SKU in listings database
    const listing = Context.instance.engine.get(Api.LISTINGS, sku);

    if (!listing) {
      responses.push({
        request: { marketplaceId, sku },
        status: { statusCode: 400, reasonPhrase: "Bad Request" },
        headers: { "Content-Type": "application/json" },
        body: {
          errors: [
            {
              code: "INVALID_SKU",
              message: "The requested SKU does not exist for the seller in the requested marketplace.",
            },
          ],
        },
      });
      continue;
    }

    // Step 3: Extract listing data
    const listingPrice = extractListingPrice(listing);
    const asin = extractAsin(listing, sku);
    const fulfillmentType = extractFulfillmentType(listing);
    const currencyCode = getCurrencyForMarketplace(marketplaceId);

    // Step 4: Compute deterministic pricing
    const competingPrice = computeCompetingOfferPrice(listingPrice, sku);
    const foepPrice = computeFoepPrice(competingPrice, sku);
    const competingSellerId = generateCompetingSellerId(asin);

    // Step 5: Build success sub-response
    responses.push({
      request: { marketplaceId, sku },
      status: { statusCode: 200, reasonPhrase: "Success" },
      headers: { "Content-Type": "application/json" },
      body: {
        offerIdentifier: {
          marketplaceId,
          sku,
          asin,
          fulfillmentType,
        },
        featuredOfferExpectedPriceResults: [
          {
            resultStatus: "VALID_FOEP",
            featuredOfferExpectedPrice: {
              listingPrice: { currencyCode, amount: foepPrice },
            },
            competingFeaturedOffer: {
              offerIdentifier: {
                marketplaceId,
                sellerId: competingSellerId,
                asin,
                fulfillmentType,
              },
              condition: "New",
              price: {
                listingPrice: { currencyCode, amount: competingPrice },
                shippingPrice: { currencyCode, amount: 0 },
              },
            },
            currentFeaturedOffer: {
              offerIdentifier: {
                marketplaceId,
                sellerId: "CURRENT_SELLER",
                asin,
                fulfillmentType,
              },
              condition: "New",
              price: {
                listingPrice: { currencyCode, amount: listingPrice },
              },
            },
          },
        ],
      },
    });
  }

  return Promise.resolve({
    statusCode: 200,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: validationResult.body,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: {
      body: {
        responses,
      },
    },
  });
};
