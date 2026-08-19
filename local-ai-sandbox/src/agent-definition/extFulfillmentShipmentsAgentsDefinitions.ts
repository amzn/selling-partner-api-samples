import { AgentDefinition } from "./agentsDefinitionsRegistry.js";
import { Request } from "express";
import { databaseLookupTool } from "../tool/databaseLookupTool.js";
import { databaseInsertionTool } from "../tool/databaseInsertionTool.js";
import { safeStringify } from "../util.js";

export class GetShipments implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the getShipments operation.
            EXECUTION STEPS:
            1. DATABASE QUERY - Retrieve all shipments. DONT use optional id tool parameter.
            2. FILTERING - Apply query parameter filters: ${JSON.stringify(result.query)}
            3. RESPONSE GENERATION - Return HTTP 200 with matching shipments as JSON per API specification: ${safeStringify(result.operation)}
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }
  tools = [databaseLookupTool];
}

export class GetShipment implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the getShipment operation.
            EXECUTION STEPS:
            1. DATABASE QUERY - Query database for shipment id: ${result.path.shipmentId}
            2. RESPONSE GENERATION - Found: Return HTTP 200 with shipment data. Not Found: Return HTTP 404.
            CONTEXT: API Spec: ${safeStringify(result.operation)}
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }
  tools = [databaseLookupTool];
}

export class ProcessShipment implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the processShipment operation.
            EXECUTION STEPS:
            1. DATABASE LOOKUP - Query database for shipment id: ${result.path.shipmentId}
            2. RESPONSE HANDLING
               - Found: Process the shipment action from request body, update shipment status in database, return HTTP 200
               - Not Found: Return HTTP 404
            CONTEXT: Request Body: ${JSON.stringify(request.body)}, API Spec: ${safeStringify(result.operation)}
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }
  tools = [databaseLookupTool, databaseInsertionTool];
}

export class CreatePackages implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the createPackages operation.
            EXECUTION STEPS:
            1. DATABASE LOOKUP - Query database for shipment id: ${result.path.shipmentId}
            2. RESPONSE HANDLING
               - Found: Create packages from request body, add to shipment's packages array, write updated shipment to database, return HTTP 200
               - Not Found: Return HTTP 404
            CONTEXT: Request Body: ${JSON.stringify(request.body)}, API Spec: ${safeStringify(result.operation)}
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }
  tools = [databaseLookupTool, databaseInsertionTool];
}

export class UpdatePackage implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the updatePackage operation.
            EXECUTION STEPS:
            1. DATABASE LOOKUP - Query database for shipment id: ${result.path.shipmentId}
            2. Find package with id: ${result.path.packageId} within the shipment
            3. RESPONSE HANDLING
               - Found: Replace package data with request body, write updated shipment to database, return HTTP 200
               - Not Found: Return HTTP 404
            CONTEXT: Request Body: ${JSON.stringify(request.body)}, API Spec: ${safeStringify(result.operation)}
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }
  tools = [databaseLookupTool, databaseInsertionTool];
}

export class UpdatePackageStatus implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the updatePackageStatus operation.
            EXECUTION STEPS:
            1. DATABASE LOOKUP - Query database for shipment id: ${result.path.shipmentId}
            2. Find package with id: ${result.path.packageId} within the shipment
            3. RESPONSE HANDLING
               - Found: Apply status patch from request body, write updated shipment to database, return HTTP 200
               - Not Found: Return HTTP 404
            CONTEXT: Request Body: ${JSON.stringify(request.body)}, API Spec: ${safeStringify(result.operation)}
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }
  tools = [databaseLookupTool, databaseInsertionTool];
}

export class RetrieveShippingOptions implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the retrieveShippingOptions operation.
            EXECUTION STEPS:
            1. DATABASE LOOKUP - Query database for shipment id: ${result.path.shipmentId}
            2. RESPONSE GENERATION
               - Found: Return HTTP 200 with shipping options for the shipment as JSON per API specification
               - Not Found: Return HTTP 404
            CONTEXT: API Spec: ${safeStringify(result.operation)}
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }
  tools = [databaseLookupTool];
}

export class RetrieveInvoice implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the retrieveInvoice operation.
            EXECUTION STEPS:
            1. DATABASE LOOKUP - Query database for shipment id: ${result.path.shipmentId}
            2. RESPONSE GENERATION
               - Found: Return HTTP 200 with invoice data as JSON per API specification
               - Not Found: Return HTTP 404
            CONTEXT: API Spec: ${safeStringify(result.operation)}
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }
  tools = [databaseLookupTool];
}

export class GenerateInvoice implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the generateInvoice operation.
            EXECUTION STEPS:
            1. DATABASE LOOKUP - Query database for shipment id: ${result.path.shipmentId}
            2. RESPONSE HANDLING
               - Found: Generate invoice data from request body, store in shipment record, write to database, return HTTP 200
               - Not Found: Return HTTP 404
            CONTEXT: Request Body: ${JSON.stringify(request.body)}, API Spec: ${safeStringify(result.operation)}
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }
  tools = [databaseLookupTool, databaseInsertionTool];
}

export class GenerateShipLabels implements AgentDefinition {
  instructions(request: Request, result: any): string {
    return `
            You are responsible for generating a valid response for the generateShipLabels operation.
            EXECUTION STEPS:
            1. DATABASE LOOKUP - Query database for shipment id: ${result.path.shipmentId}
            2. RESPONSE HANDLING
               - Found: Generate shipping labels from request body, store in shipment record, write to database, return HTTP 200
               - Not Found: Return HTTP 404
            CONTEXT: Request Body: ${JSON.stringify(request.body)}, API Spec: ${safeStringify(result.operation)}
            Handle errors at each step. Ensure responses validate against the API specification.
        `;
  }
  tools = [databaseLookupTool, databaseInsertionTool];
}
