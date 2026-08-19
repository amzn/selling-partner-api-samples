/**
 * Filter parameter interfaces and constants for code generation tools
 */

/**
 * Filter parameters for operations queries
 */
export interface OperationsFilterParams {
  /** Comma-separated list of operation names to filter by */
  operations?: string;
  /** Comma-separated list of fields to include in the response */
  included_data?: string;
}

/**
 * Filter parameters for models queries
 */
export interface ModelsFilterParams {
  /** Comma-separated list of model names to filter by */
  models?: string;
  /** Comma-separated list of fields to include in the response */
  included_data?: string;
}

/**
 * Valid field names for operation responses
 */
export const VALID_OPERATION_FIELDS = [
  "name",
  "description",
  "callMethod",
  "inputParameters",
  "returnedModel",
  "rateLimit",
] as const;

/**
 * Valid field names for model responses
 */
export const VALID_MODEL_FIELDS = [
  "name",
  "swaggerType",
  "attributeMap",
  "isEnum",
  "enumValues",
] as const;

/**
 * Type for valid operation field names
 */
export type OperationFieldName = (typeof VALID_OPERATION_FIELDS)[number];

/**
 * Type for valid model field names
 */
export type ModelFieldName = (typeof VALID_MODEL_FIELDS)[number];
