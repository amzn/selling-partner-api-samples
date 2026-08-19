import { AgentDefinition } from "./agentsDefinitionsRegistry.js";
import { Request } from "express";
import { databaseLookupTool } from "../tool/databaseLookupTool.js";
import { databaseInsertionTool } from "../tool/databaseInsertionTool.js";
import { safeStringify } from "../util.js";

export class BatchInventory implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the batchInventory operation.
            
            EXECUTION STEPS:
            
            1. PROCESS BATCH REQUESTS
               The request body contains a list of inventory requests. For each request:
               - Extract the inventoryRequestParams (sellerSku, locationId, quantity, marketplaceAttributes)
               - Use the sellerSku as the database key
               - Look up existing inventory, then upsert with the new quantity and location data
               - Write to database using sellerSku as id
            
            2. RESPONSE GENERATION
               Return HTTP 207 (Multi-Status) with a BatchInventoryResponse containing:
               - A response entry for each request in the batch
               - Each successful entry should have status 200 and include the inventory count
               - Each failed entry should have the appropriate error status and message
               Format as JSON per API specification.
            
            CONTEXT:
            - Request Body: ${JSON.stringify(request.body)}
            - API Spec: ${safeStringify(result.operation)}
            
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }

  tools = [databaseLookupTool, databaseInsertionTool];
}
