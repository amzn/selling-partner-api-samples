import type { Request } from "express";
import type { UnifiedValidationPass } from "../validation/validationTypes.js";

/**
 * The output of an Operation_Handler. Contains all data the agent needs
 * to generate a response, including operation metadata and any entities
 * read from or written to the database.
 */
export interface OperationContext {
  /** HTTP status code for the operation result (100-599) */
  statusCode: number;

  /** Operation metadata from validation */
  operationId: string;
  apiName: string;
  apiVersion: string;

  /** Request parameters */
  pathParams: Record<string, string>;
  queryParams: Record<string, string | string[] | undefined>;
  body: Record<string, unknown> | undefined;

  /** OpenAPI operation spec */
  operation: any;

  /** Entities resolved during validation */
  resolvedEntities: Record<string, Record<string, unknown>>;

  /** Data retrieved by the Operation_Handler */
  data: Record<string, unknown>;
}

// --- Handler Type ---

/**
 * An Operation_Handler is an async function that executes deterministic
 * business logic for a specific SP-API operation.
 *
 * Input: The validated request context and the original Express Request.
 * Output: An OperationContext with all data needed for response generation.
 */
export type OperationHandler = (validationResult: UnifiedValidationPass, request: Request) => Promise<OperationContext>;
