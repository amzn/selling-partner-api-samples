import { DiscoveryService } from "./services/discovery.js";
import {
  ErrorHandlingUtils,
  isServiceError,
} from "../../utils/error-handling.js";

/**
 * Retrieves SDK categories for a specific programming language
 * Implements requirements 2.1, 2.2, 2.3, 2.4
 */
export class GetCategories {
  private readonly discoveryService: DiscoveryService;

  constructor() {
    this.discoveryService = new DiscoveryService();
  }

  /**
   * Execute the get categories operation
   * @param args - Arguments containing language parameter
   * @returns Execution result with categories array
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

      const language = args.language;

      // Validate language parameter type
      if (typeof language !== "string" || language.trim() === "") {
        throw ErrorHandlingUtils.createInvalidParameterError(
          "language",
          "non-empty string",
          language,
        );
      }

      // Check if repository is available first per requirement 2.4
      const isRepoAvailable =
        await this.discoveryService.isRepositoryAvailable();
      if (!isRepoAvailable) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Repository not found. Please clone the Amazon Selling Partner API repository first using the clone-repo tool.",
            },
          ],
          isError: true,
        };
      }

      // Get categories for the specified language per requirement 2.1
      const categories = await this.discoveryService.getCategories(language);

      // Return JSON array of category objects per requirement 2.1
      // Each category includes name, description, operations_path, models_path, and import_path per requirement 2.2
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(categories, null, 2),
          },
        ],
      };
    } catch (error) {
      // Handle invalid or unsupported language per requirement 2.3
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
        "get categories execution",
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
