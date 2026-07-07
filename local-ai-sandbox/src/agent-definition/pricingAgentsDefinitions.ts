import { AgentDefinition } from "./agentsDefinitionsRegistry.js";
import { Request } from "express";
import { databaseLookupTool } from "../tool/databaseLookupTool.js";
import { safeStringify } from "../util.js";

export class GetFeaturedOfferExpectedPriceBatch implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the getFeaturedOfferExpectedPriceBatch operation.
            
            EXECUTION STEPS:
            
            1. PROCESS BATCH REQUESTS
               The request body contains a batch of up to 40 FOEP requests.
               Each request has: marketplaceId, sku, and optionally a segment with sampleLocation.
               Request body: ${JSON.stringify(request.body)}
            
            2. FOR EACH REQUEST IN THE BATCH:
               a. Look up the SKU in the listings database to find the seller's offer (price, ASIN, fulfillment type, condition)
               b. If SKU not found: return a response with resultStatus "OFFER_NOT_FOUND" and an error in the body
               c. If SKU found: generate a realistic FOEP response based on the listing data
            
            3. FOEP RESPONSE GENERATION (for found SKUs):
               Use the listing's current price as context to generate realistic pricing data:
               
               - offerIdentifier: include asin, sku, marketplaceId, fulfillmentType, and a sellerId (generate a realistic one like "A" followed by alphanumeric chars)
               
               - featuredOfferExpectedPriceResults: array with one result containing:
                 - resultStatus: Use one of these based on realistic scenarios:
                   * "VALID_FOEP" (most common) - generate a featuredOfferExpectedPrice with listingPrice slightly below the current competing offer
                   * "NO_COMPETING_OFFER" - when the seller is the only offer
                   * "OFFER_NOT_ELIGIBLE" - occasionally, for variety
                 
                 - featuredOfferExpectedPrice (only when VALID_FOEP):
                   * listingPrice: a price at or slightly below the competing offer price (typically 2-8% lower than the competing offer)
                   * points: optional, include only for JP marketplace
                 
                 - competingFeaturedOffer: generate a realistic competing seller's offer with:
                   * offerIdentifier with a different sellerId than the requesting seller
                   * condition: "New"
                   * price with listingPrice (slightly above the FOEP) and shippingPrice
                 
                 - currentFeaturedOffer: 
                   * If the seller's price is competitive (at or below FOEP): use the seller's own offer as currentFeaturedOffer
                   * If the seller's price is above FOEP: set equal to competingFeaturedOffer
            
            4. RESPONSE FORMAT
               Return HTTP 200 with a GetFeaturedOfferExpectedPriceBatchResponse.
               The outer HTTP status is ALWAYS 200. Each item in the responses array has its own status.
               
               For a FOUND SKU:
               {
                 "request": { marketplaceId, sku, segment (if provided) },
                 "status": { "statusCode": 200, "reasonPhrase": "Success" },
                 "headers": {},
                 "body": { offerIdentifier, featuredOfferExpectedPriceResults }
               }
               
               For a NOT FOUND or INVALID SKU:
               {
                 "request": { marketplaceId, sku, segment (if provided) },
                 "status": { "statusCode": 400, "reasonPhrase": "Client Error" },
                 "headers": {},
                 "body": { "errors": [{ "code": "INVALID_SKU", "message": "The requested SKU does not exist for the seller in the requested marketplace." }] }
               }
            
            CONTEXT:
            - API Spec: ${safeStringify(result.operation)}
            - Use "listings" as the api parameter for database lookups to find SKU data
            - Use the "ids" parameter with an array of all requested SKUs to batch lookup in a single call
            - Use the "fields" parameter to request only: ["purchasable_offer", "externally_assigned_product_identifier", "fulfillment_availability"]
            
            IMPORTANT:
            - Prices must use currencyCode "USD" for US marketplace (ATVPDKIKX0DER)
            - All monetary amounts must be numbers, not strings
            - Generate varied but realistic competing seller IDs and prices
            - Ensure the FOEP listingPrice is always less than or equal to the competing offer's listingPrice
            
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }

  tools = [databaseLookupTool];
}
