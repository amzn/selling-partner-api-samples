import { databaseLookupTool } from "../tool/databaseLookupTool.js";
import { AgentDefinition } from "./agentsDefinitionsRegistry.js";
import { Request } from "express";
import { PROD_BACKEND } from "../index.js";
import { databaseInsertionTool } from "../tool/databaseInsertionTool.js";
import { databaseRemovalTool } from "../tool/databaseRemovalTool.js";
import { callSellingPartnerApiTool } from "../tool/callSellingPartnerApiTool.js";
import { safeStringify } from "../util.js";

export class GetListingsItem implements AgentDefinition {
  instructions = function (request: Request, result: any) {
    return `
            You are responsible for generating a valid response for the getListingsItem operation.
            
            EXECUTION STEPS:
            
            1. DATABASE LOOKUP
               Query database for SKU: ${result.path.sku}
            
            2. RESPONSE GENERATION
               - Found: Return HTTP 200 with listing data as JSON per API specification
               - Not Found: Return HTTP 404 as JSON per API specification
            
            CONTEXT:
            - API Spec: ${safeStringify(result.operation)}
            - Included data: ${JSON.stringify(result.query)}
            
            Handle errors at each step. Ensure responses validate against the API specification.
      `;
  };

  tools = [databaseLookupTool];
}

export class SearchListingsItems implements AgentDefinition {
  instructions = function (request: Request, result: any) {
    return `
            You are responsible for generating a valid response for the searchListingsItems operation.
            
            EXECUTION STEPS:
            
            1. DATABASE QUERY
               DONT use optional id tool parameter
               
            2. LISTINGS FILTERING
                Apply filter parameters on result: ${JSON.stringify(result.query)}
            
            3. RESPONSE GENERATION
               Return HTTP 200 with matching database entries as JSON per API specification
            
            CONTEXT:
            - API Spec: ${safeStringify(result.operation)}
            
            Handle errors at each step. Ensure responses validate against the API specification.
          `;
  };

  tools = [databaseLookupTool];
}

export class PutListingsItem implements AgentDefinition {
  instructions = function (request: Request, result: any) {
    return `
            You are responsible for generating a valid response for the putListingsItem operation.
            
            EXECUTION STEPS:
            
            1. VALIDATION REQUEST
               Send HTTP PUT to: ${PROD_BACKEND}${request.path}?${JSON.stringify(request.query)}&mode=VALIDATION_PREVIEW
               Headers:
               - Content-Type: application/json
               Body: ${JSON.stringify(request.body)}
            
               If LISTING_OFFER_ONLY, fetch catalog data in parallel:
               GET ${PROD_BACKEND}/catalog/2022-04-01/items
               Query params:
               - identifiers: merchant_suggested_asin OR externally_assigned_product_identifier
               - identifiersType: ASIN OR corresponding type
               - marketplaceIds: ${result.query.marketplaceIds[0]}
               - includedData: summaries,attributes,relationships,productTypes
            
            2. RESPONSE HANDLING
            
               SCENARIO A: Complete Listing (200 + VALID + NOT LISTING_OFFER_ONLY)
               - Write result to database
               - Return HTTP 200 as JSON per API specification
            
               SCENARIO B: Offer-Only Listing (200 + VALID + LISTING_OFFER_ONLY)
               - Merge catalog data (summaries, attributes, relationships, productTypes) into request body
               - Write merged output to database
               - Return HTTP 200 as JSON per API specification
            
               SCENARIO C: Invalid Listing (200 + NOT VALID)
               - Return HTTP 200 with validation response as JSON per API specification
            
            CONTEXT:
            - SKU: ${result.path.sku}
            - API Spec: ${safeStringify(result.operation)}
            
            Handle errors at each step. Ensure all responses validate against the API specification.
          `;
  };

  tools = [databaseInsertionTool, callSellingPartnerApiTool];
}

export class PatchListingsItem implements AgentDefinition {
  instructions = function (request: Request, result: any) {
    return `
            You are responsible for generating a valid response for the patchListingsItem operation.
            
            EXECUTION STEPS:
            
            1. DATABASE LOOKUP
               Query database for SKU: ${result.path.sku}
            
            2. RESPONSE HANDLING
            
               SCENARIO A: Listing Found
               - Apply patch operations (op, path, value) to listing item
               - Write updated listing to database
               - Return HTTP 200 as JSON per API specification
            
               SCENARIO B: Listing Not Found
               - Return HTTP 400 as JSON per API specification
            
            CONTEXT:
            - Patch Operations: ${JSON.stringify(request.body)}
            - API Spec: ${safeStringify(result.operation)}
            
            Handle errors at each step. Ensure responses validate against the API specification.
          `;
  };

  tools = [databaseLookupTool, databaseInsertionTool];
}

export class DeleteListingsItem implements AgentDefinition {
  instructions = function (request: Request, result: any) {
    return `
            You are responsible for generating a valid response for the deleteListingsItem operation.
            
            EXECUTION STEPS:
            
            1. DATABASE LOOKUP
               Query database for SKU: ${result.path.sku}
            
            2. RESPONSE HANDLING
            
               SCENARIO A: Listing Found
               - Remove listing from database
               - Return HTTP 200 as JSON per API specification
            
               SCENARIO B: Listing Not Found
               - Return HTTP 200 as JSON per API specification
            
            CONTEXT:
            - API Spec: ${safeStringify(result.operation)}
            
            Handle errors at each step. Ensure responses validate against the API specification.
      `;
  };

  tools = [databaseLookupTool, databaseRemovalTool];
}
