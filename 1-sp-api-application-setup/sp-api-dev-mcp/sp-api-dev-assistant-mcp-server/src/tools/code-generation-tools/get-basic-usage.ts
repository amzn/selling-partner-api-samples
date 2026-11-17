import { DiscoveryService } from "./services/discovery.js";
import {
  ErrorHandlingUtils,
  isServiceError,
} from "../../utils/error-handling.js";

/**
 * Retrieves basic usage information for a programming language SDK
 * Implements requirements 5.1, 5.2, 5.3, 5.4
 */
export class GetBasicUsage {
  private readonly discoveryService: DiscoveryService;

  constructor() {
    this.discoveryService = new DiscoveryService();
  }

  /**
   * Execute the get basic usage operation
   * @param args - Arguments containing language parameter
   * @returns Execution result with basic usage information
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

      // Validate parameter type
      if (typeof language !== "string" || language.trim() === "") {
        throw ErrorHandlingUtils.createInvalidParameterError(
          "language",
          "non-empty string",
          language,
        );
      }

      // Get basic usage information for the specified language per requirement 5.1
      const basicUsage = await this.discoveryService.getBasicUsage(language);

      // Return setup instructions and example code per requirement 5.1
      // Include authentication details and code snippets specific to the language per requirement 5.2
      // Handle multiple usage files aggregated into comprehensive guide per requirement 5.3
      // Handle missing or corrupted usage files gracefully per requirement 5.4
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(basicUsage, null, 2),
          },
        ],
      };
    } catch (error) {
      // Handle missing or corrupted usage files gracefully per requirement 5.4
      if (isServiceError(error)) {
        // Check if this is a parsing error that should return available information
        if (error.code === "PARSE_ERROR" || error.code === "FILE_NOT_FOUND") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: error.message,
                    availableInformation:
                      "Basic usage information is not available or corrupted for this language",
                    suggestion:
                      "Please check the repository structure or try a different language",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

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
        "get basic usage execution",
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
