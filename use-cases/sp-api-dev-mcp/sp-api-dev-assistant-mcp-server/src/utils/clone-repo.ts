import { SdkInitializer } from "./sdk-initializer.js";
import { RepositoryService } from "../tools/code-generation-tools/services/repository.js";
import { ErrorHandlingUtils, isServiceError } from "./error-handling.js";

/**
 * MCP tool for ensuring the Amazon Selling Partner API SDK repository is available.
 * Delegates to the shared SdkInitializer so the background clone is reused.
 */
export class CloneRepo {
  private readonly sdkInitializer: SdkInitializer;
  private readonly repositoryService: RepositoryService;

  constructor(sdkInitializer?: SdkInitializer) {
    this.repositoryService = new RepositoryService();
    this.sdkInitializer =
      sdkInitializer ?? new SdkInitializer(this.repositoryService);
  }

  async execute(args: Record<string, any>): Promise<any> {
    try {
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

      // If custom URL/path is provided, fall back to direct clone
      const hasCustomUrl =
        args.repositoryUrl &&
        args.repositoryUrl !== this.repositoryService.getDefaultRepositoryUrl();
      const hasCustomPath =
        args.targetPath &&
        args.targetPath !== this.repositoryService.getDefaultTargetPath();

      if (hasCustomUrl || hasCustomPath) {
        const repositoryUrl =
          args.repositoryUrl ||
          this.repositoryService.getDefaultRepositoryUrl();
        const targetPath =
          args.targetPath || this.repositoryService.getDefaultTargetPath();

        const isAlreadyCloned =
          await this.repositoryService.isRepositoryCloned(targetPath);
        if (isAlreadyCloned) {
          return {
            content: [
              {
                type: "text",
                text: `Repository already exists at ${targetPath}. No action needed.`,
              },
            ],
          };
        }

        await this.repositoryService.cloneRepository(repositoryUrl, targetPath);
        return {
          content: [
            {
              type: "text",
              text: `Successfully cloned Amazon Selling Partner API SDK repository from ${repositoryUrl} to ${targetPath}`,
            },
          ],
        };
      }

      // Default path — use the shared initializer (awaits background clone or retries)
      await this.sdkInitializer.ensureReady();

      const targetPath = this.repositoryService.getDefaultTargetPath();
      return {
        content: [
          {
            type: "text",
            text: `Successfully cloned Amazon Selling Partner API SDK repository to ${targetPath}`,
          },
        ],
      };
    } catch (error) {
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
