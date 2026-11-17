/**
 * Pagination metadata interface
 */
export interface PaginationMetadata {
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items across all pages */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Paginated result interface
 */
export interface PaginatedResult<T> {
  /** Array of items for the current page */
  items: T[];
  /** Pagination metadata */
  pagination: PaginationMetadata;
}

/**
 * Pagination parameters interface
 */
export interface PaginationParams {
  /** Page number (1-based, defaults to 1) */
  page?: number | undefined;
  /** Page size (defaults to 10) */
  pageSize?: number | undefined;
}

/**
 * Utility class for pagination operations
 */
export class PaginationUtils {
  /**
   * Default page size when not specified
   */
  static readonly DEFAULT_PAGE_SIZE = 50;

  /**
   * Maximum allowed page size to prevent performance issues
   */
  static readonly MAX_PAGE_SIZE = 100;

  /**
   * Validates pagination parameters and returns normalized values
   */
  static validateAndNormalizePaginationParams(params: PaginationParams): {
    page: number;
    pageSize: number;
  } {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(
      Math.max(1, params.pageSize || this.DEFAULT_PAGE_SIZE),
      this.MAX_PAGE_SIZE,
    );

    return { page, pageSize };
  }

  /**
   * Calculates pagination metadata
   */
  static calculatePaginationMetadata(
    totalItems: number,
    page: number,
    pageSize: number,
  ): PaginationMetadata {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return {
      page: Math.min(page, totalPages), // Ensure page doesn't exceed total pages
      pageSize,
      totalItems,
      totalPages,
    };
  }

  /**
   * Calculates the start and end indices for slicing an array
   */
  static calculateSliceIndices(
    page: number,
    pageSize: number,
  ): {
    startIndex: number;
    endIndex: number;
  } {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return { startIndex, endIndex };
  }

  /**
   * Paginates an array of items
   */
  static paginateArray<T>(
    items: T[],
    params: PaginationParams,
  ): PaginatedResult<T> {
    const { page, pageSize } =
      this.validateAndNormalizePaginationParams(params);
    const { startIndex, endIndex } = this.calculateSliceIndices(page, pageSize);

    const paginatedItems = items.slice(startIndex, endIndex);
    const pagination = this.calculatePaginationMetadata(
      items.length,
      page,
      pageSize,
    );

    return {
      items: paginatedItems,
      pagination,
    };
  }

  /**
   * Creates an empty paginated result
   */
  static createEmptyResult<T>(params: PaginationParams): PaginatedResult<T> {
    const { pageSize } = this.validateAndNormalizePaginationParams(params);

    return {
      items: [],
      pagination: {
        page: 1,
        pageSize,
        totalItems: 0,
        totalPages: 1,
      },
    };
  }
}

/**
 * Type guard to check if an object is valid pagination metadata
 */
export function isPaginationMetadata(obj: any): obj is PaginationMetadata {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.page === "number" &&
    typeof obj.pageSize === "number" &&
    typeof obj.totalItems === "number" &&
    typeof obj.totalPages === "number" &&
    obj.page >= 1 &&
    obj.pageSize >= 1 &&
    obj.totalItems >= 0 &&
    obj.totalPages >= 1
  );
}

/**
 * Type guard to check if an object is a valid paginated result
 */
export function isPaginatedResult<T>(
  obj: any,
  itemValidator?: (item: any) => item is T,
): obj is PaginatedResult<T> {
  if (
    typeof obj !== "object" ||
    obj === null ||
    !Array.isArray(obj.items) ||
    !isPaginationMetadata(obj.pagination)
  ) {
    return false;
  }

  // If item validator is provided, validate all items
  if (itemValidator) {
    return obj.items.every(itemValidator);
  }

  return true;
}

/**
 * Validates pagination parameters
 */
export function validatePaginationParams(params: any): string[] {
  const errors: string[] = [];

  if (typeof params !== "object" || params === null) {
    errors.push("Pagination parameters must be an object");
    return errors;
  }

  if (params.page !== undefined) {
    if (
      typeof params.page !== "number" ||
      params.page < 1 ||
      !Number.isInteger(params.page)
    ) {
      errors.push("Page must be a positive integer");
    }
  }

  if (params.pageSize !== undefined) {
    if (
      typeof params.pageSize !== "number" ||
      params.pageSize < 1 ||
      !Number.isInteger(params.pageSize)
    ) {
      errors.push("Page size must be a positive integer");
    }

    if (params.pageSize > PaginationUtils.MAX_PAGE_SIZE) {
      errors.push(`Page size cannot exceed ${PaginationUtils.MAX_PAGE_SIZE}`);
    }
  }

  return errors;
}
