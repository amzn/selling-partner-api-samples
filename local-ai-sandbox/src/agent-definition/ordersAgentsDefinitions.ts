import { AgentDefinition } from "./agentsDefinitionsRegistry.js";
import { Request } from "express";
import { databaseLookupTool } from "../tool/databaseLookupTool.js";
import { databaseInsertionTool } from "../tool/databaseInsertionTool.js";
import { safeStringify } from "../util.js";

export class ConfirmShipment implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
         You are responsible for generating a valid response for the confirmShipment operation.
            
            EXECUTION STEPS:
            
            1. DATABASE LOOKUP
               Query database for order id: ${result.path.orderId}
            
            2. RESPONSE HANDLING
            
               SCENARIO A: Order Found and order not fulfilled by Amazon
               - Merge data from request body into existing order
               - Write updated order to database
               - Return HTTP 200 as JSON per API specification
               
               SCENARIO B: Order Found and order fulfilled by Amazon
               - Return HTTP 400 as JSON per API specification (confirm shipment not allowed for FBA)
            
               SCENARIO C: Order Not Found
               - Return HTTP 404 as JSON per API specification
            
            CONTEXT:
            - Patch Operations: ${JSON.stringify(request.body)}
            - API Spec: ${safeStringify(result.operation)}
            
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }

  tools = [databaseLookupTool, databaseInsertionTool];
}

export class SearchOrders implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the searchOrders operation.
            
            EXECUTION STEPS
            
            1. REQUEST VALIDATION:
               Query parameters: ${JSON.stringify(result.query)}
                Verify the following mutually exclusive date filter rules:
                - Exactly one of createdAfter OR lastUpdatedAfter must be provided
                - If createdAfter is provided:
                    lastUpdatedAfter and lastUpdatedBefore must NOT be provided
                    createdBefore is optional; if provided, must be ≥ createdAfter and at least 2 minutes before request time
                - If lastUpdatedAfter is provided:
                    createdAfter and createdBefore must NOT be provided
                    lastUpdatedBefore is optional; if provided, must be ≥ lastUpdatedAfter and at least 2 minutes before request time
            
            2. DATABASE QUERY
            DONT use optional id tool parameter

            3. ORDER FILTERING
            Apply filter parameters on result: ${JSON.stringify(result.query)}
            Only return included data objects when available in the database
            
            3. RESPONSE GENERATION
            Return HTTP 200 with matching entries formatted as JSON per API specification: ${safeStringify(result.operation)}
            
            Validate and handle errors at each step. Ensure all responses conform to the API specification.
          `;
  }

  tools = [databaseLookupTool];
}

export class GetOrder implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `            
            You are responsible for generating a valid response for the getOrder operation.
            
            EXECUTION STEPS:
            
            1. DATABASE QUERY
               Query database for order id: ${result.path.orderId}
            
            2. RESPONSE GENERATION
               - Found: Return HTTP 200 with order data as JSON per API specification
               - Not Found: Return HTTP 404 as JSON per API specification
            
            CONTEXT:
            - API Spec: ${safeStringify(result.operation)}
            - Included data: ${JSON.stringify(result.query)} - Don't show corresponding object if no data available
            
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }

  tools = [databaseLookupTool];
}
