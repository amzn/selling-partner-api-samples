import { DiscoveryService } from "./services/discovery.js";
import { PaginationParams } from "../../utils/pagination.js";
import {
  ErrorHandlingUtils,
  isServiceError,
} from "../../utils/error-handling.js";
import { OperationsFilterParams } from "./models/filters.js";

/**
 * Retrieves operations within a specific API category with pagination and filtering support
 *
 * This allows you to:
 * - Retrieve all operations for a specific API category
 * - Filter operations by name (case-insensitive)
 * - Control which fields are included in responses
 * - Access rate limit information for each operation
 * - Paginate through large result sets
 *
 * Implements requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 7.1, 7.3, 8.1
 *
 * @example Basic usage - Get all operations
 * ```
 * {
 *   "language": "python",
 *   "filePath": "selling_partner_api_models/orders_v0/api/orders_api.py"
 * }
 * ```
 *
 * @example Filter by operation names
 * ```
 * {
 *   "language": "python",
 *   "filePath": "selling_partner_api_models/orders_v0/api/orders_api.py",
 *   "operations": "getOrder, getOrders"
 * }
 * ```
 *
 * @example Control included fields
 * ```
 * {
 *   "language": "python",
 *   "filePath": "selling_partner_api_models/orders_v0/api/orders_api.py",
 *   "included_data": "name, description, rateLimit"
 * }
 * ```
 *
 * @example Combined filtering and pagination
 * ```
 * {
 *   "language": "python",
 *   "filePath": "selling_partner_api_models/orders_v0/api/orders_api.py",
 *   "operations": "getOrder, updateOrder",
 *   "included_data": "name, callMethod, rateLimit",
 *   "page": 1,
 *   "pageSize": 10
 * }
 * ```
 */
export class GetOperations {
  private readonly discoveryService: DiscoveryService;

  constructor() {
    this.discoveryService = new DiscoveryService();
  }

  /**
   * Execute the get operations operation
   *
   * Retrieves operations for a specific API category with optional filtering and pagination.
   * Filtering is applied before pagination to ensure accurate counts.
   *
   * Response Structure:
   * - items: Array of operation objects
   * - pagination: Metadata including page, pageSize, totalItems, totalPages, hasNextPage, hasPreviousPage
   *
   * Operation Object Fields:
   * - name: Operation name (e.g., "getOrder")
   * - description: Human-readable description of what the operation does
   * - callMethod: HTTP method (GET, POST, PUT, DELETE, etc.)
   * - inputParameters: Array of parameter objects with name, type, required, and description
   * - returnedModel: Name of the model returned by this operation
   * - rateLimit: Rate limit information object with requestsPerSecond and/or requestsPerMinute, or null if unavailable
   *
   * @param args - Arguments containing language, filePath, optional pagination and filtering parameters
   * @returns Execution result with paginated operations
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

      if (!args.filePath) {
        throw ErrorHandlingUtils.createInvalidParameterError(
          "filePath",
          "required string parameter",
          args.filePath,
        );
      }

      const language = args.language;
      const filePath = args.filePath;

      // Validate parameter types
      if (typeof language !== "string" || language.trim() === "") {
        throw ErrorHandlingUtils.createInvalidParameterError(
          "language",
          "non-empty string",
          language,
        );
      }

      if (typeof filePath !== "string" || filePath.trim() === "") {
        throw ErrorHandlingUtils.createInvalidParameterError(
          "filePath",
          "non-empty string",
          filePath,
        );
      }

      // Extract and validate pagination parameters per requirement 3.3
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

      // Extract and validate filtering parameters per requirements 1.1, 1.2, 2.1, 2.2
      const filterParams: OperationsFilterParams = {};

      if (args.operations !== undefined) {
        if (typeof args.operations !== "string") {
          throw ErrorHandlingUtils.createInvalidParameterError(
            "operations",
            "string",
            args.operations,
          );
        }
        filterParams.operations = args.operations;
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

      // Get operations for the specified file path and language with filtering per requirements 1.1, 2.1
      const result = await this.discoveryService.getOperations(
        language,
        filePath,
        paginationParams,
        Object.keys(filterParams).length > 0 ? filterParams : undefined,
      );

      // Return paginated results with metadata per requirement 3.3
      // Each operation includes name, description, call_method, input_parameters, returned_model, and rate_limit per requirements 3.2, 3.1
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      // Handle invalid file paths per requirement 3.4
      // Handle parsing errors gracefully per requirement 3.5
      // Handle field validation errors per requirement 8.1
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
        "get operations execution",
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
