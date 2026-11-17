import { DiscoveryService } from "./services/discovery.js";
import { PaginationParams } from "../../utils/pagination.js";
import {
  ErrorHandlingUtils,
  isServiceError,
} from "../../utils/error-handling.js";
import { ModelsFilterParams } from "./models/filters.js";

/**
 * Retrieves data models and schemas for a specific API category with pagination and filtering support
 *
 * This allows you to:
 * - Retrieve all data models for a specific API category
 * - Filter models by name (case-insensitive)
 * - Control which fields are included in responses
 * - Access model structure including attributes, types, and enum values
 * - Paginate through large result sets
 *
 * Implements requirements 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 7.2, 7.4, 8.2
 *
 * @example Basic usage - Get all models
 * ```
 * {
 *   "language": "python",
 *   "directoryPath": "selling_partner_api_models/orders_v0/models"
 * }
 * ```
 *
 * @example Filter by model names
 * ```
 * {
 *   "language": "python",
 *   "directoryPath": "selling_partner_api_models/orders_v0/models",
 *   "models": "Order, OrderItem"
 * }
 * ```
 *
 * @example Control included fields
 * ```
 * {
 *   "language": "python",
 *   "directoryPath": "selling_partner_api_models/orders_v0/models",
 *   "included_data": "name, swaggerType, isEnum"
 * }
 * ```
 *
 * @example Combined filtering and pagination
 * ```
 * {
 *   "language": "python",
 *   "directoryPath": "selling_partner_api_models/orders_v0/models",
 *   "models": "Order, Address",
 *   "included_data": "name, attributeMap",
 *   "page": 1,
 *   "pageSize": 10
 * }
 * ```
 */
export class GetModels {
  private readonly discoveryService: DiscoveryService;

  constructor() {
    this.discoveryService = new DiscoveryService();
  }

  /**
   * Execute the get models operation
   *
   * Retrieves data models for a specific API category with optional filtering and pagination.
   * Filtering is applied before pagination to ensure accurate counts.
   *
   * Response Structure:
   * - items: Array of model objects
   * - pagination: Metadata including page, pageSize, totalItems, totalPages, hasNextPage, hasPreviousPage
   *
   * Model Object Fields:
   * - name: Model name (e.g., "Order", "OrderItem")
   * - swaggerType: The Swagger/OpenAPI type of the model (e.g., "object", "string")
   * - attributeMap: Object mapping attribute names to their types and descriptions
   * - isEnum: Boolean indicating if this model is an enumeration
   * - enumValues: Array of possible enum values (only present when isEnum is true)
   *
   * @param args - Arguments containing language, directoryPath, and optional pagination and filtering parameters
   * @returns Execution result with paginated models
   */
  async execute(args: Record<string, any>): Promise<any> {
    try {
      // Validate required parameters
      if (!args.language) {
        throw ErrorHandlingUtils.createInvalidParameterError(
          "language",
          "required string parameter",
          args.language,
        );
      }

      if (!args.directoryPath) {
        throw ErrorHandlingUtils.createInvalidParameterError(
          "directoryPath",
          "required string parameter",
          args.directoryPath,
        );
      }

      const language = args.language;
      const directoryPath = args.directoryPath;

      // Validate parameter types
      if (typeof language !== "string" || language.trim() === "") {
        throw ErrorHandlingUtils.createInvalidParameterError(
          "language",
          "non-empty string",
          language,
        );
      }

      if (typeof directoryPath !== "string" || directoryPath.trim() === "") {
        throw ErrorHandlingUtils.createInvalidParameterError(
          "directoryPath",
          "non-empty string",
          directoryPath,
        );
      }

      // Extract and validate pagination parameters per requirement 4.3
      const paginationParams: PaginationParams = {};

      if (args.page !== undefined) {
        if (
          typeof args.page !== "number" ||
          args.page < 1 ||
          !Number.isInteger(args.page)
        ) {
          throw ErrorHandlingUtils.createInvalidParameterError(
            "page",
            "positive integer",
            args.page,
          );
        }
        paginationParams.page = args.page;
      }

      if (args.pageSize !== undefined) {
        if (
          typeof args.pageSize !== "number" ||
          args.pageSize < 1 ||
          args.pageSize > 100 ||
          !Number.isInteger(args.pageSize)
        ) {
          throw ErrorHandlingUtils.createInvalidParameterError(
            "pageSize",
            "integer between 1 and 100",
            args.pageSize,
          );
        }
        paginationParams.pageSize = args.pageSize;
      }

      // Extract and validate filtering parameters per requirements 4.1, 4.2, 5.1, 5.2
      const filterParams: ModelsFilterParams = {};

      if (args.models !== undefined) {
        if (typeof args.models !== "string") {
          throw ErrorHandlingUtils.createInvalidParameterError(
            "models",
            "string",
            args.models,
          );
        }
        filterParams.models = args.models;
      }

      if (args.included_data !== undefined) {
        if (typeof args.included_data !== "string") {
          throw ErrorHandlingUtils.createInvalidParameterError(
            "included_data",
            "string",
            args.included_data,
          );
        }
        filterParams.included_data = args.included_data;
      }

      // Get models for the specified directory path and language with filtering per requirements 4.1, 5.1
      const result = await this.discoveryService.getModels(
        language,
        directoryPath,
        paginationParams,
        Object.keys(filterParams).length > 0 ? filterParams : undefined,
      );

      // Return paginated results with complete pagination metadata per requirement 4.3
      // Each model includes name, swagger_type, attribute_map, is_enum, and enum_values per requirement 4.2
      // Enum models are correctly identified and populated per requirement 4.4
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      // Handle comprehensive error handling for parsing failures per requirement 4.5
      // Handle field validation errors per requirement 8.2
      if (isServiceError(error)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }

      // Handle unexpected errors
      const unexpectedError = ErrorHandlingUtils.createInternalError(
        "get models execution",
        error as Error,
      );

      return {
        content: [
          {
            type: "text",
            text: `Error: ${unexpectedError.message}`,
          },
        ],
        isError: true,
      };
    }
  }
}
