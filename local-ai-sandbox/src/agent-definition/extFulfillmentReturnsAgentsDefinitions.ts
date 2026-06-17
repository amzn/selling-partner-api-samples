import { AgentDefinition } from "./agentsDefinitionsRegistry.js";
import { Request } from "express";
import { databaseLookupTool } from "../tool/databaseLookupTool.js";
import { safeStringify } from "../util.js";

export class ListReturns implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the listReturns operation.
            
            EXECUTION STEPS:
            1. DATABASE QUERY - Retrieve all returns. DONT use optional id tool parameter.
            2. FILTERING - Apply query parameter filters on results: ${JSON.stringify(result.query)}
            3. RESPONSE GENERATION - Return HTTP 200 with matching returns formatted as JSON per API specification: ${safeStringify(result.operation)}
            
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }
  tools = [databaseLookupTool];
}

export class GetReturn implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the getReturn operation.
            
            EXECUTION STEPS:
            1. DATABASE QUERY - Query database for return id: ${result.path.returnId}
            2. RESPONSE GENERATION
               - Found: Return HTTP 200 with return data as JSON per API specification
               - Not Found: Return HTTP 404 as JSON per API specification
            
            CONTEXT:
            - API Spec: ${safeStringify(result.operation)}
            
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }
  tools = [databaseLookupTool];
}
