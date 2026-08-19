import {
  Category,
  Operation,
  Model,
  ServiceError,
  RateLimit,
} from "../models/index.js";
import { FileSystemUtils } from "../../../utils/file-system.js";
import {
  ErrorHandlingUtils,
  ErrorCode,
} from "../../../utils/error-handling.js";
import { parse as yamlParse } from "yaml";

/**
 * Basic usage information structure for SDK setup and authentication
 */
export interface BasicUsage {
  [key: string]: string; // Flexible structure for language-specific usage info
}

/**
 * Abstract interface for all language parsers
 * Defines common parsing method signatures and error handling contracts
 */
export interface LanguageParser {
  /**
   * Parse SDK categories from the repository
   * @returns Promise resolving to array of Category objects
   * @throws ServiceError when parsing fails
   */
  parseCategories(): Promise<Category[]>;

  /**
   * Parse operations from a specific file path
   * @param filePath - Path to the operations file to parse
   * @returns Promise resolving to array of Operation objects
   * @throws ServiceError when parsing fails or file not found
   */
  parseOperations(filePath: string): Promise<Operation[]>;

  /**
   * Parse models from a directory path
   * @param directoryPath - Path to the models directory to parse
   * @returns Promise resolving to array of Model objects
   * @throws ServiceError when parsing fails or directory not found
   */
  parseModels(directoryPath: string): Promise<Model[]>;

  /**
   * Parse basic usage information for the language
   * @returns Promise resolving to BasicUsage object with setup instructions
   * @throws ServiceError when parsing fails or usage files not found
   */
  parseBasicUsage(): Promise<BasicUsage>;

  /**
   * Get the language identifier for this parser
   * @returns String identifier for the language (e.g., 'python', 'java')
   */
  getLanguage(): string;

  /**
   * Validate that the parser can handle the given repository structure
   * @param repositoryPath - Path to the cloned repository
   * @returns Promise resolving to true if valid, false otherwise
   * @throws ServiceError for validation errors
   */
  validateRepository(repositoryPath: string): Promise<boolean>;
}

/**
 * Internal type for parsed YAML rate limit entries
 */
export interface RateLimitEntry {
  rate: number;
  burst: number;
  intervalInSeconds: number;
}

/**
 * Abstract base class for language parsers
 * Provides shared parsing utilities and error handling
 */
export abstract class BaseParser implements LanguageParser {
  protected readonly repositoryPath: string;
  protected readonly language: string;
  private rateLimitMap: Map<string, RateLimitEntry> | null = null;

  constructor(repositoryPath: string, language: string) {
    this.repositoryPath = repositoryPath;
    this.language = language;
  }

  // Abstract methods that must be implemented by concrete parsers
  abstract parseCategories(): Promise<Category[]>;
  abstract parseOperations(filePath: string): Promise<Operation[]>;
  abstract parseModels(directoryPath: string): Promise<Model[]>;
  abstract parseBasicUsage(): Promise<BasicUsage>;

  /**
   * Get the language identifier for this parser
   */
  getLanguage(): string {
    return this.language;
  }

  /**
   * Validate that the parser can handle the given repository structure
   */
  async validateRepository(repositoryPath: string): Promise<boolean> {
    try {
      // Check if repository directory exists
      if (!(await FileSystemUtils.directoryExists(repositoryPath))) {
        return false;
      }

      // Check for language-specific directory structure
      const languageDir = FileSystemUtils.joinPath(
        repositoryPath,
        this.language,
      );
      return await FileSystemUtils.directoryExists(languageDir);
    } catch (error) {
      this.logError("Repository validation failed", error);
      return false;
    }
  }

  /**
   * Safely read and parse a JSON file
   * @param filePath - Path to the JSON file
   * @returns Parsed JSON object
   * @throws ServiceError for parsing errors
   */
  protected async readJsonFile(filePath: string): Promise<any> {
    try {
      const content = await FileSystemUtils.readFile(filePath);
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw ErrorHandlingUtils.createError(
          ErrorCode.MALFORMED_FILE,
          `Invalid JSON in file: ${filePath}`,
          {
            filePath,
            parseError: error.message,
          },
        );
      }
      throw ErrorHandlingUtils.createParseError(
        filePath,
        this.language,
        error as Error,
      );
    }
  }

  /**
   * Safely read a text file with error recovery
   * @param filePath - Path to the text file
   * @returns File contents as string
   * @throws ServiceError for file system errors
   */
  protected async readTextFile(filePath: string): Promise<string> {
    try {
      return await FileSystemUtils.readFile(filePath);
    } catch (error) {
      throw ErrorHandlingUtils.createParseError(
        filePath,
        this.language,
        error as Error,
      );
    }
  }

  /**
   * Find files matching a pattern in a directory
   * @param dirPath - Directory to search
   * @param pattern - RegExp pattern to match
   * @returns Array of matching file paths
   */
  protected async findFiles(
    dirPath: string,
    pattern: RegExp,
  ): Promise<string[]> {
    try {
      return await FileSystemUtils.findFiles(dirPath, pattern);
    } catch (error) {
      this.logError(`Failed to find files in ${dirPath}`, error);
      return []; // Return empty array for graceful degradation
    }
  }

  /**
   * Check if a file exists
   * @param filePath - Path to check
   * @returns True if file exists, false otherwise
   */
  protected async fileExists(filePath: string): Promise<boolean> {
    return await FileSystemUtils.fileExists(filePath);
  }

  /**
   * Check if a directory exists
   * @param dirPath - Path to check
   * @returns True if directory exists, false otherwise
   */
  protected async directoryExists(dirPath: string): Promise<boolean> {
    return await FileSystemUtils.directoryExists(dirPath);
  }

  /**
   * Get the full path for a language-specific file
   * @param relativePath - Relative path within the language directory
   * @returns Full path to the file
   */
  protected getLanguagePath(relativePath: string): string {
    return FileSystemUtils.joinPath(
      this.repositoryPath,
      this.language,
      relativePath,
    );
  }

  /**
   * Extract text content between delimiters
   * @param content - Source text content
   * @param startDelimiter - Starting delimiter
   * @param endDelimiter - Ending delimiter
   * @returns Extracted content or empty string if not found
   */
  protected extractBetweenDelimiters(
    content: string,
    startDelimiter: string,
    endDelimiter: string,
  ): string {
    const startIndex = content.indexOf(startDelimiter);
    if (startIndex === -1) return "";

    const contentStart = startIndex + startDelimiter.length;
    const endIndex = content.indexOf(endDelimiter, contentStart);
    if (endIndex === -1) return "";

    return content.substring(contentStart, endIndex).trim();
  }

  /**
   * Parse a simple key-value configuration format
   * @param content - Configuration file content
   * @param separator - Key-value separator (default: '=')
   * @returns Object with parsed key-value pairs
   */
  protected parseKeyValueConfig(
    content: string,
    separator: string = "=",
  ): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (
        trimmedLine &&
        !trimmedLine.startsWith("#") &&
        !trimmedLine.startsWith("//")
      ) {
        const separatorIndex = trimmedLine.indexOf(separator);
        if (separatorIndex > 0) {
          const key = trimmedLine.substring(0, separatorIndex).trim();
          const value = trimmedLine.substring(separatorIndex + 1).trim();
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Sanitize a string for safe usage (remove special characters, etc.)
   * @param input - Input string to sanitize
   * @returns Sanitized string
   */
  protected sanitizeString(input: string): string {
    return input
      .replace(/[^\w\s-_.]/g, "") // Remove special characters except word chars, spaces, hyphens, underscores, dots
      .trim();
  }

  /**
   * Extract rate limit information from documentation or comments
   * Searches for common rate limit patterns in various formats
   * @param content - Source content (docstring, comment, etc.)
   * @param methodName - Optional method name for context
   * @returns RateLimit object or null if not found
   */
  protected extractRateLimit(
    content: string,
    methodName?: string,
  ): { requestsPerSecond?: number; requestsPerMinute?: number } | null {
    try {
      // Common patterns for rate limit documentation
      const patterns = [
        // Python style: "Rate limit: 0.5 requests per second"
        /rate\s*limit\s*:?\s*(\d+(?:\.\d+)?)\s*requests?\s*per\s*(second|minute)/i,
        // Java style: "@rateLimit 0.5 requests/second"
        /@rateLimit\s+(\d+(?:\.\d+)?)\s*requests?\s*\/\s*(second|minute)/i,
        // Alternative: "Rate: 0.5/second"
        /rate\s*:?\s*(\d+(?:\.\d+)?)\s*\/\s*(second|minute|sec|min)/i,
        // Alternative: "0.5 req/s" or "30 req/min"
        /(\d+(?:\.\d+)?)\s*req(?:uests?)?\s*\/\s*(s|sec|second|m|min|minute)/i,
        // Alternative: "Throttling: 0.5 per second"
        /throttl(?:e|ing)\s*:?\s*(\d+(?:\.\d+)?)\s*(?:requests?\s*)?per\s*(second|minute)/i,
      ];

      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          const value = parseFloat(match[1]);
          const unit = match[2].toLowerCase();

          // Validate the parsed value
          if (isNaN(value) || value <= 0) {
            continue;
          }

          // Normalize unit variations
          const normalizedUnit = unit.startsWith("s") ? "second" : "minute";

          const rateLimit: {
            requestsPerSecond?: number;
            requestsPerMinute?: number;
          } = {};

          if (normalizedUnit === "second") {
            rateLimit.requestsPerSecond = value;
          } else {
            rateLimit.requestsPerMinute = value;
          }

          return rateLimit;
        }
      }

      // No rate limit found
      return null;
    } catch (error) {
      this.logWarning(
        `Failed to extract rate limit${methodName ? ` for ${methodName}` : ""}`,
        { error },
      );
      return null;
    }
  }

  /**
   * Load and parse the rate-limits.yml file into a cached map.
   * Returns cached value on subsequent calls without re-reading.
   */
  protected async loadRateLimitMap(): Promise<Map<string, RateLimitEntry>> {
    if (this.rateLimitMap !== null) {
      return this.rateLimitMap;
    }

    const map = new Map<string, RateLimitEntry>();

    try {
      const yamlPath = FileSystemUtils.joinPath(
        this.repositoryPath,
        "resources",
        "rate-limits.yml",
      );

      if (!(await this.fileExists(yamlPath))) {
        this.logWarning("Rate limits YAML file not found", { path: yamlPath });
        this.rateLimitMap = map;
        return map;
      }

      const content = await this.readTextFile(yamlPath);
      const parsed = yamlParse(content);

      if (typeof parsed !== "object" || parsed === null) {
        this.logWarning("Rate limits YAML file has invalid structure");
        this.rateLimitMap = map;
        return map;
      }

      for (const [key, value] of Object.entries(parsed)) {
        if (
          Array.isArray(value) &&
          (value.length === 2 || value.length === 3) &&
          value.every((v) => typeof v === "number")
        ) {
          map.set(key, {
            rate: value[0],
            burst: value[1],
            intervalInSeconds: value.length === 3 ? value[2] : 1,
          });
        } else {
          this.logWarning(`Skipping malformed rate limit entry: ${key}`, {
            value,
          });
        }
      }
    } catch (error) {
      this.logWarning("Failed to parse rate limits YAML file", { error });
    }

    this.rateLimitMap = map;
    return map;
  }

  /**
   * Look up a rate limit by className and methodName.
   * Constructs the key as `${className}-${methodName}` and returns the corresponding RateLimit.
   */
  protected async lookupRateLimit(
    className: string,
    methodName: string,
  ): Promise<RateLimit | null> {
    const map = await this.loadRateLimitMap();
    // Normalize snake_case method names (e.g. Python) to camelCase for rate limit lookup
    const camelMethodName = methodName.replace(/_([a-z])/g, (_, c) =>
      c.toUpperCase(),
    );
    // Normalize PascalCase method names (e.g. C#) to camelCase for rate limit lookup
    const normalizedMethodName =
      camelMethodName.charAt(0).toLowerCase() + camelMethodName.slice(1);
    const key = `${className}-${normalizedMethodName}`;
    const entry = map.get(key);

    if (!entry) {
      return null;
    }

    if (entry.intervalInSeconds > 1) {
      return {
        requestsPerMinute: (entry.rate / entry.intervalInSeconds) * 60,
        burst: entry.burst,
        intervalInSeconds: entry.intervalInSeconds,
      };
    }

    return {
      requestsPerSecond: entry.rate,
      burst: entry.burst,
      intervalInSeconds: entry.intervalInSeconds,
    };
  }

  /**
   * Log an error with context information
   * @param message - Error message
   * @param error - Original error object
   */
  protected logError(message: string, error: unknown): void {
    const errorInfo = {
      language: this.language,
      repositoryPath: this.repositoryPath,
      message,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };

    // In a real implementation, this would use a proper logging framework
    // eslint-disable-next-line no-console
    console.error("Parser Error:", JSON.stringify(errorInfo, null, 2));
  }

  /**
   * Log a warning with context information
   * @param message - Warning message
   * @param details - Additional details
   */
  protected logWarning(message: string, details?: Record<string, any>): void {
    const warningInfo = {
      language: this.language,
      repositoryPath: this.repositoryPath,
      message,
      details,
      timestamp: new Date().toISOString(),
    };

    // In a real implementation, this would use a proper logging framework
    // eslint-disable-next-line no-console
    console.warn("Parser Warning:", JSON.stringify(warningInfo, null, 2));
  }

  /**
   * Create a parsing error with context
   * @param operation - Operation that failed
   * @param filePath - File being parsed
   * @param originalError - Original error
   * @returns ServiceError with context
   */
  protected createParsingError(
    operation: string,
    filePath: string,
    originalError?: Error,
  ): ServiceError {
    return ErrorHandlingUtils.createError(
      ErrorCode.PARSE_ERROR,
      `Failed to ${operation} in ${this.language} parser: ${filePath}`,
      {
        language: this.language,
        operation,
        filePath,
        originalError: originalError?.message,
      },
    );
  }

  /**
   * Handle parsing errors with graceful degradation
   * @param operation - Operation that failed
   * @param filePath - File being parsed
   * @param error - Original error
   * @param defaultValue - Default value to return on error
   * @returns Default value or re-throws if critical
   */
  protected handleParsingError<T>(
    operation: string,
    filePath: string,
    error: unknown,
    defaultValue: T,
  ): T {
    this.logError(`${operation} failed for ${filePath}`, error);

    // For now, return default value for graceful degradation
    // In production, you might want to be more selective about which errors to ignore
    return defaultValue;
  }
}
