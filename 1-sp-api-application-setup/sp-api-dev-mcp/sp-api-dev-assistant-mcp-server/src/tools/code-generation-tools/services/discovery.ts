import {
  Category,
  Operation,
  Model,
  PaginatedResult,
  PaginationParams,
} from "../models/index.js";
import {
  OperationsFilterParams,
  ModelsFilterParams,
  VALID_OPERATION_FIELDS,
  VALID_MODEL_FIELDS,
} from "../models/filters.js";
import { BasicUsage, LanguageParser } from "../parsers/base-parser.js";
import { PythonParser } from "../parsers/python-parser.js";
import { JavaParser } from "../parsers/java-parser.js";
import { JavaScriptParser } from "../parsers/javascript-parser.js";
import { PHPParser } from "../parsers/php-parser.js";
import { CSharpParser } from "../parsers/csharp-parser.js";
import { PaginationUtils } from "../../../utils/pagination.js";
import {
  ErrorHandlingUtils,
  ErrorCode,
} from "../../../utils/error-handling.js";
import { RepositoryService } from "./repository.js";
import {
  parseFilterString,
  filterByNames,
  projectFields,
  validateFields,
} from "../../../utils/filtering.js";
import * as path from "path";
import { MCP_CACHE_DIR } from "../../../utils/paths.js";

/**
 * Supported programming languages for SDK parsing
 */
export type SupportedLanguage =
  | "python"
  | "java"
  | "javascript"
  | "php"
  | "csharp";

/**
 * Discovery service for orchestrating SDK parsing across multiple languages
 * Coordinates parser selection, execution, and error handling
 */
export class DiscoveryService {
  private readonly repositoryService: RepositoryService;
  private readonly repositoryPath: string;
  private readonly supportedLanguages: Set<SupportedLanguage>;

  constructor(
    repositoryPath: string = path.join(
      MCP_CACHE_DIR,
      "selling-partner-api-sdk",
    ),
  ) {
    this.repositoryService = new RepositoryService();
    this.repositoryPath = repositoryPath;
    this.supportedLanguages = new Set([
      "python",
      "java",
      "javascript",
      "php",
      "csharp",
    ]);
  }

  /**
   * Get all supported programming languages
   * @returns Array of supported language identifiers
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return Array.from(this.supportedLanguages);
  }

  /**
   * Validate that a language is supported
   * @param language - Language to validate
   * @throws ServiceError if language is not supported
   */
  private validateLanguage(
    language: string,
  ): asserts language is SupportedLanguage {
    if (!language || typeof language !== "string") {
      throw ErrorHandlingUtils.createInvalidParameterError(
        "language",
        "non-empty string",
        language,
      );
    }

    const normalizedLanguage = language.toLowerCase().trim();
    if (!this.supportedLanguages.has(normalizedLanguage as SupportedLanguage)) {
      throw ErrorHandlingUtils.createError(
        ErrorCode.INVALID_PARAMETER,
        `Unsupported language: ${language}. Supported languages: ${Array.from(this.supportedLanguages).join(", ")}`,
        {
          language,
          supportedLanguages: Array.from(this.supportedLanguages),
        },
      );
    }
  }

  /**
   * Create a parser instance for the specified language
   * @param language - Programming language identifier
   * @returns Language parser instance
   * @throws ServiceError if language is not supported or parser creation fails
   */
  private createParser(language: SupportedLanguage): LanguageParser {
    try {
      switch (language) {
        case "python":
          return new PythonParser(this.repositoryPath);
        case "java":
          return new JavaParser(this.repositoryPath);
        case "javascript":
          return new JavaScriptParser(this.repositoryPath);
        case "php":
          return new PHPParser(this.repositoryPath);
        case "csharp":
          return new CSharpParser(this.repositoryPath);
        default:
          // This should never happen due to validation, but TypeScript requires it
          throw ErrorHandlingUtils.createError(
            ErrorCode.INVALID_PARAMETER,
            `Unsupported language: ${language}`,
            {
              language,
            },
          );
      }
    } catch (error) {
      if (ErrorHandlingUtils.isServiceError(error)) {
        throw error;
      }

      throw ErrorHandlingUtils.createError(
        ErrorCode.OPERATION_FAILED,
        `Failed to create parser for language: ${language}`,
        { language, originalError: (error as Error).message },
      );
    }
  }

  /**
   * Validate that the repository is available and accessible
   * @throws ServiceError if repository is not available
   */
  private async validateRepository(): Promise<void> {
    try {
      await this.repositoryService.validateRepository(this.repositoryPath);
    } catch (error) {
      if (ErrorHandlingUtils.isServiceError(error)) {
        throw error;
      }

      throw ErrorHandlingUtils.createError(
        ErrorCode.REPOSITORY_NOT_FOUND,
        "Repository validation failed. Please ensure the Amazon SP API repository is cloned.",
        {
          repositoryPath: this.repositoryPath,
          originalError: (error as Error).message,
        },
      );
    }
  }

  /**
   * Execute a parser operation with error isolation and fallback mechanisms
   * @param language - Programming language
   * @param operation - Operation name for error reporting
   * @param parserOperation - Parser operation to execute
   * @returns Result of the parser operation
   * @throws ServiceError if operation fails
   */
  private async executeParserOperation<T>(
    language: SupportedLanguage,
    operation: string,
    parserOperation: (parser: LanguageParser) => Promise<T>,
  ): Promise<T> {
    try {
      const parser = this.createParser(language);

      // Validate that the parser can handle the repository structure
      const isValid = await parser.validateRepository(this.repositoryPath);
      if (!isValid) {
        throw ErrorHandlingUtils.createError(
          ErrorCode.PARSE_ERROR,
          `Repository structure is not valid for ${language} parsing`,
          { language, repositoryPath: this.repositoryPath },
        );
      }

      return await parserOperation(parser);
    } catch (error) {
      if (ErrorHandlingUtils.isServiceError(error)) {
        throw error;
      }

      throw ErrorHandlingUtils.createError(
        ErrorCode.PARSE_ERROR,
        `Failed to ${operation} for language ${language}`,
        {
          language,
          operation,
          repositoryPath: this.repositoryPath,
          originalError: (error as Error).message,
        },
      );
    }
  }

  /**
   * Get SDK categories for a specific programming language
   * @param language - Programming language identifier
   * @returns Promise resolving to array of Category objects
   * @throws ServiceError for validation or parsing errors
   */
  async getCategories(language: string): Promise<Category[]> {
    this.validateLanguage(language);
    await this.validateRepository();

    const normalizedLanguage = language
      .toLowerCase()
      .trim() as SupportedLanguage;

    return this.executeParserOperation(
      normalizedLanguage,
      "parse categories",
      (parser) => parser.parseCategories(),
    );
  }

  /**
   * Get operations for a specific file path and language
   * @param language - Programming language identifier
   * @param filePath - Path to the operations file
   * @param paginationParams - Optional pagination parameters
   * @param filterParams - Optional filtering parameters
   * @returns Promise resolving to paginated Operation objects (may be partial if field projection is used)
   * @throws ServiceError for validation or parsing errors
   */
  async getOperations(
    language: string,
    filePath: string,
    paginationParams?: PaginationParams,
    filterParams?: OperationsFilterParams,
  ): Promise<PaginatedResult<Operation> | PaginatedResult<Partial<Operation>>> {
    this.validateLanguage(language);
    await this.validateRepository();

    if (!filePath || typeof filePath !== "string" || filePath.trim() === "") {
      throw ErrorHandlingUtils.createInvalidParameterError(
        "filePath",
        "non-empty string",
        filePath,
      );
    }

    const normalizedLanguage = language
      .toLowerCase()
      .trim() as SupportedLanguage;

    const operations = await this.executeParserOperation(
      normalizedLanguage,
      "parse operations",
      (parser) => parser.parseOperations(filePath.trim()),
    );

    // Apply filtering before pagination
    const filtered = this.filterOperations(operations, filterParams);

    // Apply pagination if parameters are provided
    if (paginationParams) {
      return PaginationUtils.paginateArray(filtered, paginationParams);
    }

    // Return all operations with default pagination metadata
    return PaginationUtils.paginateArray(filtered, {});
  }

  /**
   * Get models for a specific directory path and language
   * @param language - Programming language identifier
   * @param directoryPath - Path to the models directory
   * @param paginationParams - Optional pagination parameters
   * @param filterParams - Optional filtering parameters
   * @returns Promise resolving to paginated Model objects (may be partial if field projection is used)
   * @throws ServiceError for validation or parsing errors
   */
  async getModels(
    language: string,
    directoryPath: string,
    paginationParams?: PaginationParams,
    filterParams?: ModelsFilterParams,
  ): Promise<PaginatedResult<Model> | PaginatedResult<Partial<Model>>> {
    this.validateLanguage(language);
    await this.validateRepository();

    if (
      !directoryPath ||
      typeof directoryPath !== "string" ||
      directoryPath.trim() === ""
    ) {
      throw ErrorHandlingUtils.createInvalidParameterError(
        "directoryPath",
        "non-empty string",
        directoryPath,
      );
    }

    const normalizedLanguage = language
      .toLowerCase()
      .trim() as SupportedLanguage;

    const models = await this.executeParserOperation(
      normalizedLanguage,
      "parse models",
      (parser) => parser.parseModels(directoryPath.trim()),
    );

    // Apply filtering before pagination
    const filtered = this.filterModels(models, filterParams);

    // Apply pagination if parameters are provided
    if (paginationParams) {
      return PaginationUtils.paginateArray(filtered, paginationParams);
    }

    // Return all models with default pagination metadata
    return PaginationUtils.paginateArray(filtered, {});
  }

  /**
   * Get basic usage information for a specific programming language
   * @param language - Programming language identifier
   * @returns Promise resolving to BasicUsage object
   * @throws ServiceError for validation or parsing errors
   */
  async getBasicUsage(language: string): Promise<BasicUsage> {
    this.validateLanguage(language);
    await this.validateRepository();

    const normalizedLanguage = language
      .toLowerCase()
      .trim() as SupportedLanguage;

    return this.executeParserOperation(
      normalizedLanguage,
      "parse basic usage",
      (parser) => parser.parseBasicUsage(),
    );
  }

  /**
   * Check if the repository is available and cloned
   * @returns Promise resolving to true if repository is available
   */
  async isRepositoryAvailable(): Promise<boolean> {
    try {
      return await this.repositoryService.isRepositoryCloned(
        this.repositoryPath,
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Clone the Amazon SP API repository if not already available
   * @param repositoryUrl - Optional custom repository URL
   * @returns Promise that resolves when cloning is complete
   * @throws ServiceError if cloning fails
   */
  async ensureRepositoryAvailable(repositoryUrl?: string): Promise<void> {
    try {
      await this.repositoryService.cloneRepository(
        repositoryUrl,
        this.repositoryPath,
      );
    } catch (error) {
      if (ErrorHandlingUtils.isServiceError(error)) {
        throw error;
      }

      throw ErrorHandlingUtils.createError(
        ErrorCode.OPERATION_FAILED,
        "Failed to ensure repository availability",
        {
          repositoryPath: this.repositoryPath,
          originalError: (error as Error).message,
        },
      );
    }
  }

  /**
   * Get the repository path being used by this service
   * @returns Repository path
   */
  getRepositoryPath(): string {
    return this.repositoryPath;
  }

  /**
   * Apply filtering to operations
   * @param operations - Array of operations to filter
   * @param filterParams - Optional filtering parameters
   * @returns Filtered and projected operations
   * @throws ServiceError if field validation fails
   */
  private filterOperations(
    operations: Operation[],
    filterParams?: OperationsFilterParams,
  ): Operation[] | Partial<Operation>[] {
    if (!filterParams) {
      return operations;
    }

    let filtered = operations;

    // Apply name filtering if specified
    if (filterParams.operations) {
      const operationNames = parseFilterString(filterParams.operations);
      if (operationNames.length > 0) {
        filtered = filterByNames(filtered, operationNames);
      }
    }

    // Apply field projection if specified
    if (filterParams.included_data) {
      const includedFields = parseFilterString(filterParams.included_data);
      if (includedFields.length > 0) {
        return this.projectOperationFields(filtered, includedFields);
      }
    }

    return filtered;
  }

  /**
   * Apply filtering to models
   * @param models - Array of models to filter
   * @param filterParams - Optional filtering parameters
   * @returns Filtered and projected models
   * @throws ServiceError if field validation fails
   */
  private filterModels(
    models: Model[],
    filterParams?: ModelsFilterParams,
  ): Model[] | Partial<Model>[] {
    if (!filterParams) {
      return models;
    }

    let filtered = models;

    // Apply name filtering if specified
    if (filterParams.models) {
      const modelNames = parseFilterString(filterParams.models);
      if (modelNames.length > 0) {
        filtered = filterByNames(filtered, modelNames);
      }
    }

    // Apply field projection if specified
    if (filterParams.included_data) {
      const includedFields = parseFilterString(filterParams.included_data);
      if (includedFields.length > 0) {
        return this.projectModelFields(filtered, includedFields);
      }
    }

    return filtered;
  }

  /**
   * Apply field projection to operations
   * @param operations - Array of operations to project
   * @param includedFields - Array of field names to include
   * @returns Array of projected operations
   * @throws ServiceError if field validation fails
   */
  private projectOperationFields(
    operations: Operation[],
    includedFields: string[],
  ): Partial<Operation>[] {
    // Validate fields
    const validation = validateFields(
      includedFields,
      Array.from(VALID_OPERATION_FIELDS),
    );
    if (!validation.valid) {
      throw ErrorHandlingUtils.createError(
        ErrorCode.INVALID_PARAMETER,
        `Invalid fields: ${validation.invalidFields.join(", ")}. Valid fields are: ${VALID_OPERATION_FIELDS.join(", ")}`,
        {
          invalidFields: validation.invalidFields,
          validFields: VALID_OPERATION_FIELDS,
        },
      );
    }

    return operations.map((operation) =>
      projectFields(
        operation,
        includedFields,
        Array.from(VALID_OPERATION_FIELDS),
      ),
    );
  }

  /**
   * Apply field projection to models
   * @param models - Array of models to project
   * @param includedFields - Array of field names to include
   * @returns Array of projected models
   * @throws ServiceError if field validation fails
   */
  private projectModelFields(
    models: Model[],
    includedFields: string[],
  ): Partial<Model>[] {
    // Validate fields
    const validation = validateFields(
      includedFields,
      Array.from(VALID_MODEL_FIELDS),
    );
    if (!validation.valid) {
      throw ErrorHandlingUtils.createError(
        ErrorCode.INVALID_PARAMETER,
        `Invalid fields: ${validation.invalidFields.join(", ")}. Valid fields are: ${VALID_MODEL_FIELDS.join(", ")}`,
        {
          invalidFields: validation.invalidFields,
          validFields: VALID_MODEL_FIELDS,
        },
      );
    }

    return models.map((model) =>
      projectFields(model, includedFields, Array.from(VALID_MODEL_FIELDS)),
    );
  }
}
