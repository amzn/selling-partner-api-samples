import { simpleGit, SimpleGit, GitError } from "simple-git";
import { promises as fs } from "fs";
import * as path from "path";
import {
  ErrorHandlingUtils,
  ErrorCode,
} from "../../../utils/error-handling.js";
import { MCP_CACHE_DIR } from "../../../utils/paths.js";

/**
 * Repository service for Git operations
 * Handles cloning, validation, and management of Git repositories
 */
export class RepositoryService {
  private git: SimpleGit;
  private readonly defaultRepoUrl =
    "https://github.com/amzn/selling-partner-api-sdk.git";
  private readonly defaultTargetPath = path.join(
    MCP_CACHE_DIR,
    "selling-partner-api-sdk",
  );

  constructor() {
    this.git = simpleGit();
  }

  /**
   * Clones the Amazon Selling Partner API repository
   * @param repositoryUrl - Optional custom repository URL
   * @param targetPath - Optional custom target path
   * @returns Promise that resolves when cloning is complete
   * @throws ServiceError if cloning fails
   */
  async cloneRepository(
    repositoryUrl: string = this.defaultRepoUrl,
    targetPath: string = this.defaultTargetPath,
  ): Promise<void> {
    try {
      // Validate inputs
      if (
        !repositoryUrl ||
        typeof repositoryUrl !== "string" ||
        repositoryUrl.trim() === ""
      ) {
        throw ErrorHandlingUtils.createInvalidParameterError(
          "repositoryUrl",
          "non-empty string",
          repositoryUrl,
        );
      }

      if (
        !targetPath ||
        typeof targetPath !== "string" ||
        targetPath.trim() === ""
      ) {
        throw ErrorHandlingUtils.createInvalidParameterError(
          "targetPath",
          "non-empty string",
          targetPath,
        );
      }

      // Check if repository already exists
      const exists = await this.isRepositoryCloned(targetPath);
      if (exists) {
        return;
      }

      // Ensure parent directory exists
      const parentDir = path.dirname(targetPath);
      await fs.mkdir(parentDir, { recursive: true });

      // Clone the repository
      await this.git.clone(repositoryUrl, targetPath, ["--depth", "1"]);
    } catch (error) {
      // Handle different types of errors
      if (ErrorHandlingUtils.isServiceError(error)) {
        throw error;
      }

      if (error instanceof GitError || (error as any)?.git) {
        throw ErrorHandlingUtils.createRepositoryCloneError(
          repositoryUrl,
          error as Error,
        );
      }

      if (
        (error as any)?.code === "ENOTFOUND" ||
        (error as any)?.code === "ECONNREFUSED"
      ) {
        throw ErrorHandlingUtils.createNetworkError(
          "repository cloning",
          error as Error,
        );
      }

      if (
        (error as any)?.code === "EACCES" ||
        (error as any)?.code === "EPERM"
      ) {
        throw ErrorHandlingUtils.createFileSystemError(
          "create directory",
          targetPath,
          error as Error,
        );
      }

      // Fallback for unexpected errors
      throw ErrorHandlingUtils.createInternalError(
        "repository cloning",
        error as Error,
      );
    }
  }

  /**
   * Checks if a repository is already cloned at the specified path
   * @param repositoryPath - Path to check for repository
   * @returns Promise that resolves to true if repository exists and is valid
   */
  async isRepositoryCloned(repositoryPath: string): Promise<boolean> {
    try {
      if (!repositoryPath || typeof repositoryPath !== "string") {
        return false;
      }

      // Check if directory exists
      const stats = await fs.stat(repositoryPath);
      if (!stats.isDirectory()) {
        return false;
      }

      // Check if it's a git repository
      const gitDir = path.join(repositoryPath, ".git");
      const gitStats = await fs.stat(gitDir);
      return gitStats.isDirectory();
    } catch (error) {
      // If any error occurs (file not found, permission denied, etc.),
      // assume repository is not cloned
      return false;
    }
  }

  /**
   * Validates that a repository exists and is accessible
   * @param repositoryPath - Path to validate
   * @returns Promise that resolves if repository is valid
   * @throws ServiceError if repository is not valid or accessible
   */
  async validateRepository(repositoryPath: string): Promise<void> {
    try {
      if (
        !repositoryPath ||
        typeof repositoryPath !== "string" ||
        repositoryPath.trim() === ""
      ) {
        throw ErrorHandlingUtils.createInvalidParameterError(
          "repositoryPath",
          "non-empty string",
          repositoryPath,
        );
      }

      const isCloned = await this.isRepositoryCloned(repositoryPath);
      if (!isCloned) {
        throw ErrorHandlingUtils.createError(
          ErrorCode.REPOSITORY_NOT_FOUND,
          `Repository not found at path: ${repositoryPath}. Please clone the repository first.`,
          { repositoryPath },
        );
      }

      // Additional validation - check if we can read the directory
      await fs.access(repositoryPath, fs.constants.R_OK);
    } catch (error) {
      if (ErrorHandlingUtils.isServiceError(error)) {
        throw error;
      }

      throw ErrorHandlingUtils.createFileSystemError(
        "validate repository",
        repositoryPath,
        error as Error,
      );
    }
  }

  /**
   * Gets the default repository URL
   * @returns The default Amazon SP API repository URL
   */
  getDefaultRepositoryUrl(): string {
    return this.defaultRepoUrl;
  }

  /**
   * Gets the default target path for cloning
   * @returns The default target path
   */
  getDefaultTargetPath(): string {
    return this.defaultTargetPath;
  }

  /**
   * Updates an existing repository by pulling latest changes
   * @param repositoryPath - Path to the repository to update
   * @returns Promise that resolves when update is complete
   * @throws ServiceError if update fails
   */
  async updateRepository(
    repositoryPath: string = this.defaultTargetPath,
  ): Promise<void> {
    try {
      // Validate repository exists first
      await this.validateRepository(repositoryPath);

      // Create git instance for the specific repository
      const repoGit = simpleGit(repositoryPath);

      // Pull latest changes
      await repoGit.pull();
    } catch (error) {
      if (ErrorHandlingUtils.isServiceError(error)) {
        throw error;
      }

      if (error instanceof GitError || (error as any)?.git) {
        throw ErrorHandlingUtils.createError(
          ErrorCode.OPERATION_FAILED,
          `Failed to update repository at ${repositoryPath}`,
          { repositoryPath, originalError: (error as Error).message },
        );
      }

      throw ErrorHandlingUtils.createInternalError(
        "repository update",
        error as Error,
      );
    }
  }
}
