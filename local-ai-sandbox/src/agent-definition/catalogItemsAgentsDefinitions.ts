import { AgentDefinition } from "./agentsDefinitionsRegistry.js";
import { Request } from "express";
import { databaseLookupTool } from "../tool/databaseLookupTool.js";
import { safeStringify } from "../util.js";

export class GetCatalogItem implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the getCatalogItem operation.
            
            EXECUTION STEPS:
            
            1. DATABASE LOOKUP
               Query database for ASIN: ${result.path.asin}
            
            2. RESPONSE HANDLING
            
               SCENARIO A: Item Found in DB
               - Return HTTP 200 with catalog item data filtered by includedData param
               - Only include data categories requested in includedData: ${JSON.stringify(result.query.includedData)}
            
               SCENARIO B: Item Not Found in DB
               - Retrieve the catalog model specification
               - Generate a realistic catalog item for ASIN ${result.path.asin} with rich product data
               - Include only the data categories requested in includedData: ${JSON.stringify(result.query.includedData)}
               - Generate realistic: summaries (title, brand, manufacturer), attributes, dimensions, identifiers (UPC/EAN/GTIN), images with URLs, salesRanks, relationships, classifications
               - Store generated item in database for future lookups
               - Return HTTP 200 with the generated item
            
            CONTEXT:
            - API Spec: ${safeStringify(result.operation)}
            - ASIN: ${result.path.asin}
            - Marketplace IDs: ${JSON.stringify(result.query.marketplaceIds)}
            - Included Data: ${JSON.stringify(result.query.includedData)}
            
            Response must have top-level "asin" field plus arrays for each includedData category.
            Handle errors at each step.
        `;
  }

  tools = [databaseLookupTool];
}

export class SearchCatalogItems implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the searchCatalogItems operation.
            
            EXECUTION STEPS:
            
            1. REQUEST VALIDATION
               Verify search criteria: at least one of keywords, identifiers, or identifiersType must be provided.
               Keywords: ${JSON.stringify(result.query.keywords)}
               Identifiers: ${JSON.stringify(result.query.identifiers)}
               IdentifiersType: ${JSON.stringify(result.query.identifiersType)}
            
            2. DATABASE QUERY
               DONT use optional id tool parameter. Retrieve all catalog items.
            
            3. SEARCH & FILTER
               - If keywords provided: filter items whose title/brand/attributes match the keywords
               - If identifiers provided: filter items matching the given identifiers (ASIN, UPC, EAN, etc.)
               - Apply includedData filter: ${JSON.stringify(result.query.includedData)}
            
            4. RESPONSE GENERATION
               - If matching items found in DB: return them
               - If no items found but valid search: generate 3-5 realistic catalog items matching the search criteria with rich product data, store them in database, return them
               - Return HTTP 200 with items array, numberOfResults, and pagination per API spec
            
            CONTEXT:
            - API Spec: ${safeStringify(result.operation)}
            - Query Parameters: ${JSON.stringify(result.query)}
            
            Response must have "numberOfResults", "items" array, and "pagination" object.
            Handle errors at each step.
        `;
  }

  tools = [databaseLookupTool];
}
