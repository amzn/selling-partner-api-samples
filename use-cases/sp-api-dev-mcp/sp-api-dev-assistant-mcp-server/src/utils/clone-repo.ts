import { RepositoryService } from "../tools/code-generation-tools/services/repository.js";
import { ErrorHandlingUtils, isServiceError } from "./error-handling.js";

/**
 * MCP tool for cloning the Amazon Selling Partner API repository
 * Implements requirements 1.1, 1.2, 1.3, 1.4
 */
export class CloneRepo {
  private readonly repositoryService: RepositoryService;

  constructor() {
    this.repositoryService = new RepositoryService();
  }

  /**
   * Execute the clone repository tool
   * @param args - Tool arguments containing optional repositoryUrl and targetPath
   * @returns Tool execution result
   */
  async execute(args: Record<string, any>): Promise<any> {
    try {
      // Validate parameters first before applying defaults
      if (
        args.repositoryUrl !== undefined &&
        (typeof args.repositoryUrl !== "string" ||
          args.repositoryUrl.trim() === "")
      ) {
        throw ErrorHandlingUtils.createInvalidParameterError(
          "repositoryUrl",
          "non-empty string",
          args.repositoryUrl,
        );
      }

      if (
        args.targetPath !== undefined &&
        (typeof args.targetPath !== "string" || args.targetPath.trim() === "")
      ) {
        throw ErrorHandlingUtils.createInvalidParameterError(
          "targetPath",
          "non-empty string",
          args.targetPath,
        );
      }

      // Apply defaults after validation
      const repositoryUrl =
        args.repositoryUrl || this.repositoryService.getDefaultRepositoryUrl();
      const targetPath =
        args.targetPath || this.repositoryService.getDefaultTargetPath();

      // Check if repository already exists
      const isAlreadyCloned =
        await this.repositoryService.isRepositoryCloned(targetPath);

      if (isAlreadyCloned) {
        // Repository already exists - handle gracefully per requirement 1.4
        return {
          content: [
            {
              type: "text",
              text: `Repository already exists at ${targetPath}. No action needed.`,
            },
          ],
        };
      }

      // Clone the repository
      await this.repositoryService.cloneRepository(repositoryUrl, targetPath);

      // Return success confirmation per requirement 1.2
      return {
        content: [
          {
            type: "text",
            text: `Successfully cloned Amazon Selling Partner API SDK repository from ${repositoryUrl} to ${targetPath}`,
          },
        ],
      };
    } catch (error) {
      // Handle errors and return descriptive error messages per requirement 1.3
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
        "clone repository tool execution",
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
