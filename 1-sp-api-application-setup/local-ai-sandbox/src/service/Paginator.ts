/**
 * Reusable offset-based pagination utility.
 *
 * Encodes/decodes opaque page tokens (base64-wrapped JSON) and slices result
 * sets into pages with optional nextToken / previousToken generation.
 */

// --- Token encoding / decoding ---

/**
 * Encodes an offset into an opaque base64 page token.
 */
export function encodePageToken(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString("base64");
}

/**
 * Decodes a base64 page token into an offset number.
 * Returns null if the token is invalid or cannot be parsed.
 */
export function decodePageToken(token: string): number | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    if (typeof parsed === "object" && parsed !== null && "offset" in parsed) {
      const offset = (parsed as Record<string, unknown>).offset;
      if (typeof offset === "number" && Number.isFinite(offset) && offset >= 0) {
        return offset;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// --- Paginator class ---

export interface PaginationResult<T> {
  /** Items on the current page. */
  page: T[];
  /** Total number of items before pagination. */
  numberOfResults: number;
  /** Token pointing to the next page (undefined when on the last page). */
  nextToken?: string;
  /** Token pointing to the previous page (undefined when on the first page). */
  previousToken?: string;
}

export interface PaginatorOptions {
  /** Default page size when none is specified by the caller. */
  defaultPageSize: number;
  /** Maximum allowed page size (values above this are capped). */
  maxPageSize: number;
}

/**
 * A configurable paginator that slices arrays into pages using opaque tokens.
 *
 * Usage:
 * ```ts
 * const paginator = new Paginator({ defaultPageSize: 10, maxPageSize: 100 });
 * const result = paginator.paginate(items, { pageSize: 25, pageToken: token });
 * ```
 */
export class Paginator {
  private readonly defaultPageSize: number;
  private readonly maxPageSize: number;

  constructor(options: PaginatorOptions) {
    this.defaultPageSize = options.defaultPageSize;
    this.maxPageSize = options.maxPageSize;
  }

  /**
   * Normalizes a raw page-size value (string or number) into a valid integer
   * bounded by defaultPageSize and maxPageSize.
   */
  normalizePageSize(raw: string | number | undefined | null): number {
    if (raw === undefined || raw === null) return this.defaultPageSize;
    const parsed = typeof raw === "string" ? parseInt(raw, 10) : raw;
    if (!Number.isFinite(parsed) || parsed < 1) return this.defaultPageSize;
    return Math.min(parsed, this.maxPageSize);
  }

  /**
   * Paginates an array of items.
   *
   * - If the token is invalid or points beyond the array, returns an empty page
   *   with the correct numberOfResults (graceful degradation).
   * - Generates nextToken / previousToken when applicable.
   */
  paginate<T>(items: T[], options?: { pageSize?: string | number | null; pageToken?: string }): PaginationResult<T> {
    const effectivePageSize = this.normalizePageSize(options?.pageSize);
    const numberOfResults = items.length;

    let offset = 0;
    if (options?.pageToken !== undefined && options.pageToken !== null) {
      const decoded = decodePageToken(options.pageToken);
      if (decoded === null || decoded >= items.length) {
        return { page: [], numberOfResults };
      }
      offset = decoded;
    }

    const page = items.slice(offset, offset + effectivePageSize);

    const result: PaginationResult<T> = { page, numberOfResults };

    if (offset + effectivePageSize < items.length) {
      result.nextToken = encodePageToken(offset + effectivePageSize);
    }

    if (offset > 0) {
      result.previousToken = encodePageToken(Math.max(0, offset - effectivePageSize));
    }

    return result;
  }
}
