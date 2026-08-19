/**
 * Core data models and interfaces for the MCP TypeScript server
 */

export type { Category } from "./category.js";
export { isCategory, validateCategory } from "./category.js";
export type { Operation, RateLimit } from "./operation.js";
export {
  isOperation,
  validateOperation,
  isRateLimit,
  validateRateLimit,
} from "./operation.js";
export type { Model } from "./model.js";
export { isModel, validateModel } from "./model.js";
export type { Parameter } from "./parameter.js";
export { isParameter, validateParameter } from "./parameter.js";
export type {
  OperationsFilterParams,
  ModelsFilterParams,
  OperationFieldName,
  ModelFieldName,
} from "./filters.js";
export { VALID_OPERATION_FIELDS, VALID_MODEL_FIELDS } from "./filters.js";

// Re-export pagination utilities for convenience
export type {
  PaginationMetadata,
  PaginatedResult,
  PaginationParams,
} from "../../../utils/pagination.js";
export {
  PaginationUtils,
  isPaginationMetadata,
  isPaginatedResult,
  validatePaginationParams,
} from "../../../utils/pagination.js";

// Re-export error handling utilities for convenience
export type {
  ServiceError,
  ErrorResponse,
  ErrorCode,
} from "../../../utils/error-handling.js";
export {
  ErrorHandlingUtils,
  isServiceError,
  isErrorResponse,
  validateServiceError,
} from "../../../utils/error-handling.js";
