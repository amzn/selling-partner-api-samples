import { AgentDefinition } from "./agentsDefinitionsRegistry.js";
import { Request } from "express";
import { databaseLookupTool } from "../tool/databaseLookupTool.js";
import { databaseInsertionTool } from "../tool/databaseInsertionTool.js";
import { databaseRemovalTool } from "../tool/databaseRemovalTool.js";
import { safeStringify } from "../util.js";

export class GetInventorySummaries implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the getInventorySummaries operation.
            
            EXECUTION STEPS:
            
            1. DATABASE QUERY
               Query database for inventory data.
               If sellerSkus or sellerSku query params are provided, filter by those SKUs.
               If startDateTime is provided, filter items with lastUpdatedTime after that date.
               DONT use optional id tool parameter when retrieving all inventory.
            
            2. RESPONSE GENERATION
               Return HTTP 200 with inventory summaries formatted as JSON per API specification.
               Include granularity object with granularityType and granularityId from query params.
               Wrap results in payload.inventorySummaries array.
            
            CONTEXT:
            - Query Parameters: ${JSON.stringify(result.query)}
            - API Spec: ${safeStringify(result.operation)}
            
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }

  tools = [databaseLookupTool];
}

export class AddInventory implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the addInventory operation.
            
            EXECUTION STEPS:
            
            1. PROCESS INVENTORY ITEMS
               For each item in the request body inventoryItems array:
               - Look up existing inventory by sellerSku
               - If found: add the requested quantity to existing totalQuantity and fulfillableQuantity
               - If not found: create new inventory entry with the requested quantity
               - Write updated/new inventory to database using sellerSku as id
            
            2. RESPONSE GENERATION
               Return HTTP 200 with empty response body (no errors) per API specification.
            
            CONTEXT:
            - Request Body: ${JSON.stringify(request.body)}
            - API Spec: ${safeStringify(result.operation)}
            
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }

  tools = [databaseLookupTool, databaseInsertionTool];
}

export class CreateInventoryItem implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the createInventoryItem operation.
            
            EXECUTION STEPS:
            
            1. DATABASE LOOKUP
               Check if inventory item with sellerSku already exists.
            
            2. RESPONSE HANDLING
            
               SCENARIO A: Item does NOT exist
               - Create new inventory entry with sellerSku, marketplaceId, productName from request body
               - Set initial quantities to 0
               - Write to database using sellerSku as id
               - Return HTTP 200 with empty response body (no errors)
            
               SCENARIO B: Item already exists
               - Return HTTP 400 with error indicating item already exists
            
            CONTEXT:
            - Request Body: ${JSON.stringify(request.body)}
            - API Spec: ${safeStringify(result.operation)}
            
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }

  tools = [databaseLookupTool, databaseInsertionTool];
}

export class DeleteInventoryItem implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the deleteInventoryItem operation.
            
            EXECUTION STEPS:
            
            1. DATABASE LOOKUP
               Query database for inventory item with sellerSku: ${result.path.sellerSku}
            
            2. RESPONSE HANDLING
            
               SCENARIO A: Item Found
               - Remove item from database
               - Return HTTP 200 with empty response body (no errors)
            
               SCENARIO B: Item Not Found
               - Return HTTP 404 with error per API specification
            
            CONTEXT:
            - sellerSku: ${result.path.sellerSku}
            - Query Parameters: ${JSON.stringify(result.query)}
            - API Spec: ${safeStringify(result.operation)}
            
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }

  tools = [databaseLookupTool, databaseRemovalTool];
}
