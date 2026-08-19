/**
 * Service error interface for structured error handling
 */
export interface ServiceError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, any> | undefined;
}

/**
 * Error response format for MCP tool responses
 */
export interface ErrorResponse {
  error: ServiceError;
}

/**
 * Standard error codes used throughout the application
 */
export enum ErrorCode {
  // Validation errors
  INVALID_PARAMETER = "INVALID_PARAMETER",
  MISSING_PARAMETER = "MISSING_PARAMETER",
  INVALID_LANGUAGE = "INVALID_LANGUAGE",
  INVALID_PAGINATION = "INVALID_PAGINATION",

  // File system errors
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  DIRECTORY_NOT_FOUND = "DIRECTORY_NOT_FOUND",
  FILE_READ_ERROR = "FILE_READ_ERROR",
  PERMISSION_DENIED = "PERMISSION_DENIED",

  // Network errors
  NETWORK_ERROR = "NETWORK_ERROR",
  REPOSITORY_CLONE_FAILED = "REPOSITORY_CLONE_FAILED",
  REPOSITORY_NOT_FOUND = "REPOSITORY_NOT_FOUND",

  // Parsing errors
  PARSE_ERROR = "PARSE_ERROR",
  MALFORMED_FILE = "MALFORMED_FILE",
  UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",

  // System errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  OPERATION_FAILED = "OPERATION_FAILED",
  TIMEOUT = "TIMEOUT",
}

/**
 * Utility class for error handling operations
 */
export class ErrorHandlingUtils {
  /**
   * Creates a ServiceError with the specified parameters
   */
  static createError(
    code: ErrorCode | string,
    message: string,
    details?: Record<string, any>,
  ): ServiceError {
    return {
      code,
      message,
      details,
    };
  }

  /**
   * Creates an ErrorResponse for MCP tool responses
   */
  static createErrorResponse(
    code: ErrorCode | string,
    message: string,
    details?: Record<string, any>,
  ): ErrorResponse {
    return {
      error: this.createError(code, message, details),
    };
  }

  /**
   * Creates a validation error for missing parameters
   */
  static createMissingParameterError(parameterName: string): ServiceError {
    return this.createError(
      ErrorCode.MISSING_PARAMETER,
      `Missing required parameter: ${parameterName}`,
      {
        parameter: parameterName,
      },
    );
  }

  /**
   * Creates a validation error for invalid parameters
   */
  static createInvalidParameterError(
    parameterName: string,
    expectedType: string,
    actualValue?: any,
  ): ServiceError {
    return this.createError(
      ErrorCode.INVALID_PARAMETER,
      `Invalid parameter '${parameterName}': expected ${expectedType}`,
      {
        parameter: parameterName,
        expectedType,
        actualValue:
          actualValue !== undefined ? String(actualValue) : undefined,
      },
    );
  }

  /**
   * Creates an error for unsupported languages
   */
  static createUnsupportedLanguageError(language: string): ServiceError {
    return this.createError(
      ErrorCode.INVALID_LANGUAGE,
      `Unsupported language: ${language}`,
      {
        language,
        supportedLanguages: ["python", "java", "javascript", "php", "csharp"],
      },
    );
  }

  /**
   * Creates a file system error
   */
  static createFileSystemError(
    operation: string,
    path: string,
    originalError?: Error,
  ): ServiceError {
    let code: ErrorCode;
    let message: string;

    if (originalError?.message.includes("ENOENT")) {
      code = ErrorCode.FILE_NOT_FOUND;
      message = `File or directory not found: ${path}`;
    } else if (originalError?.message.includes("EACCES")) {
      code = ErrorCode.PERMISSION_DENIED;
      message = `Permission denied accessing: ${path}`;
    } else {
      code = ErrorCode.FILE_READ_ERROR;
      message = `Failed to ${operation} file: ${path}`;
    }

    return this.createError(code, message, {
      operation,
      path,
      originalError: originalError?.message,
    });
  }

  /**
   * Creates a network error
   */
  static createNetworkError(
    operation: string,
    originalError?: Error,
  ): ServiceError {
    return this.createError(
      ErrorCode.NETWORK_ERROR,
      `Network error during ${operation}`,
      {
        operation,
        originalError: originalError?.message,
      },
    );
  }

  /**
   * Creates a repository cloning error
   */
  static createRepositoryCloneError(
    repositoryUrl: string,
    originalError?: Error,
  ): ServiceError {
    return this.createError(
      ErrorCode.REPOSITORY_CLONE_FAILED,
      `Failed to clone repository: ${repositoryUrl}`,
      {
        repositoryUrl,
        originalError: originalError?.message,
      },
    );
  }

  /**
   * Creates a parsing error
   */
  static createParseError(
    filePath: string,
    language: string,
    originalError?: Error,
  ): ServiceError {
    return this.createError(
      ErrorCode.PARSE_ERROR,
      `Failed to parse ${language} file: ${filePath}`,
      {
        filePath,
        language,
        originalError: originalError?.message,
      },
    );
  }

  /**
   * Creates a pagination error
   */
  static createPaginationError(errors: string[]): ServiceError {
    return this.createError(
      ErrorCode.INVALID_PAGINATION,
      `Invalid pagination parameters: ${errors.join(", ")}`,
      {
        validationErrors: errors,
      },
    );
  }

  /**
   * Creates an internal error (sanitized for security)
   */
  static createInternalError(
    operation: string,
    originalError?: Error,
  ): ServiceError {
    return this.createError(
      ErrorCode.INTERNAL_ERROR,
      `Internal error during ${operation}`,
      {
        operation,
        // Only include error message, not stack trace for security
        error: originalError?.message || "Unknown error",
      },
    );
  }

  /**
   * Sanitizes error details to prevent sensitive information exposure
   */
  static sanitizeErrorDetails(
    details: Record<string, any>,
  ): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(details)) {
      // Skip potentially sensitive fields
      if (
        key.toLowerCase().includes("password") ||
        key.toLowerCase().includes("token") ||
        key.toLowerCase().includes("secret") ||
        key.toLowerCase().includes("key")
      ) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "string" && value.length > 500) {
        // Truncate very long strings
        sanitized[key] = value.substring(0, 500) + "... [TRUNCATED]";
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Formats an error for logging purposes
   */
  static formatErrorForLogging(error: ServiceError): string {
    const sanitizedDetails = error.details
      ? this.sanitizeErrorDetails(error.details)
      : {};
    return JSON.stringify({
      code: error.code,
      message: error.message,
      details: sanitizedDetails,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Checks if an error is a ServiceError
   */
  static isServiceError(error: any): error is ServiceError {
    return (
      typeof error === "object" &&
      error !== null &&
      typeof error.code === "string" &&
      typeof error.message === "string" &&
      (error.details === undefined || typeof error.details === "object")
    );
  }

  /**
   * Converts any error to a ServiceError
   */
  static toServiceError(
    error: unknown,
    operation: string = "unknown",
  ): ServiceError {
    if (this.isServiceError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return this.createInternalError(operation, error);
    }

    return this.createError(
      ErrorCode.INTERNAL_ERROR,
      `Unexpected error during ${operation}: ${String(error)}`,
      {
        operation,
        originalError: String(error),
      },
    );
  }
}

/**
 * Type guard to check if an object is a valid ServiceError
 */
export function isServiceError(obj: any): obj is ServiceError {
  return ErrorHandlingUtils.isServiceError(obj);
}

/**
 * Type guard to check if an object is a valid ErrorResponse
 */
export function isErrorResponse(obj: any): obj is ErrorResponse {
  return typeof obj === "object" && obj !== null && isServiceError(obj.error);
}

/**
 * Validates a ServiceError object and returns validation errors if any
 */
export function validateServiceError(obj: any): string[] {
  const errors: string[] = [];

  if (typeof obj !== "object" || obj === null) {
    errors.push("ServiceError must be an object");
    return errors;
  }

  if (typeof obj.code !== "string" || obj.code.trim() === "") {
    errors.push("ServiceError code must be a non-empty string");
  }

  if (typeof obj.message !== "string") {
    errors.push("ServiceError message must be a string");
  }

  if (
    obj.details !== undefined &&
    (typeof obj.details !== "object" || obj.details === null)
  ) {
    errors.push("ServiceError details must be an object if provided");
  }

  return errors;
}
