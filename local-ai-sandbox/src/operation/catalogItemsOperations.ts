import type { OperationHandler } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";
import { Paginator } from "../service/Paginator.js";

const catalogPaginator = new Paginator({ defaultPageSize: 10, maxPageSize: 20 });

/**
 * Paginates an array of items based on pageSize and an optional pageToken.
 *
 * - Default pageSize: 10
 * - Max pageSize: 20 (caps if exceeds)
 * - Invalid or out-of-range pageToken results in empty page with correct numberOfResults
 * - Generates nextToken if more items exist after current page
 * - Generates previousToken if offset > 0
 */
export function paginate<T>(
  items: T[],
  pageSize: number,
  pageToken?: string,
): { page: T[]; numberOfResults: number; nextToken?: string; previousToken?: string } {
  return catalogPaginator.paginate(items, { pageSize, pageToken });
}

// --- includedData filtering logic for Catalog Items ---

/**
 * Valid includedData categories for Catalog Items API responses.
 */
export const INCLUDED_DATA_CATEGORIES = [
  "summaries",
  "attributes",
  "classifications",
  "dimensions",
  "identifiers",
  "images",
  "productTypes",
  "relationships",
  "salesRanks",
  "vendorDetails",
] as const;

/**
 * Filters a stored catalog item to include only the `asin` field
 * and the data categories specified in `includedData`.
 *
 * - Always includes the `asin` field.
 * - For each value in `includedData`, includes the corresponding top-level key if it exists on the item.
 * - Omits keys not in `includedData` (except `asin`).
 * - Silently skips categories not present on the item (no error thrown).
 */
export function filterCatalogItem(item: Record<string, unknown>, includedData: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Always include asin
  if ("asin" in item) {
    result.asin = item.asin;
  }

  // Include each requested data category if it exists on the item
  for (const category of includedData) {
    if (category in item) {
      result[category] = item[category];
    }
  }

  return result;
}

// --- Utility helpers ---

/**
 * Escapes special regex characters in a string so it can be used safely in a RegExp.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parses a query parameter that may be a single string (possibly comma-separated)
 * or an array of strings into a flat string array. Returns undefined if absent.
 */
function parseArrayParam(param: string | string[] | undefined): string[] | undefined {
  if (param === undefined || param === "") {
    return undefined;
  }
  if (Array.isArray(param)) {
    const result = param.flatMap((v) => v.split(",")).filter((v) => v !== "");
    return result.length > 0 ? result : undefined;
  }
  const result = param.split(",").filter((v) => v !== "");
  return result.length > 0 ? result : undefined;
}

// --- Handlers ---

/**
 * Parses the includedData query parameter, handling both comma-separated strings
 * and arrays (depending on how Express parses repeated query params).
 * Defaults to ["summaries"] if absent.
 */
function parseIncludedData(includedDataParam: string | string[] | undefined): string[] {
  if (!includedDataParam) {
    return ["summaries"];
  }
  if (Array.isArray(includedDataParam)) {
    // Express may split repeated params into an array; also handle comma-separated within each element
    return includedDataParam.flatMap((v) => v.split(","));
  }
  // Single string, possibly comma-separated
  return includedDataParam.split(",");
}

/**
 * Handler for getCatalogItem (Catalog Items API v2022-04-01).
 *
 * Reads a catalog item from the local database and filters it
 * to include only the requested includedData categories.
 */
export const getCatalogItemHandler: OperationHandler = async (validationResult) => {
  const asin = validationResult.pathParams.asin;
  const item = Context.instance.engine.get(Api.CATALOG, asin);

  const includedData = parseIncludedData(validationResult.queryParams.includedData);
  const filteredItem = filterCatalogItem(item as Record<string, unknown>, includedData);

  return {
    statusCode: 200,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: filteredItem },
  };
};

/**
 * Matches a document against the keywords search mode.
 * Case-insensitive substring match on summaries[].itemName or summaries[].brand.
 */
function matchesKeywords(doc: Record<string, unknown>, keywordRegexes: RegExp[]): boolean {
  const summaries = doc.summaries as { itemName?: string; brand?: string }[] | undefined;
  if (!summaries) return false;
  return keywordRegexes.some((re) => summaries.some((s) => (s.itemName && re.test(s.itemName)) || (s.brand && re.test(s.brand))));
}

/**
 * Matches a document against the identifiers search mode.
 *
 * When identifiersType is "ASIN", matches against the document's `asin` field directly
 * since ASINs are stored as the document key rather than in the identifiers array.
 *
 * For all other identifier types, performs an exact match on
 * identifiers[].identifiers[].identifier for the given identifiersType.
 */
function matchesIdentifiers(doc: Record<string, unknown>, identifierValues: string[], identifiersType: string | undefined): boolean {
  if (identifiersType === "ASIN") {
    const asin = (doc.asin ?? doc._key) as string | undefined;
    return asin !== undefined && identifierValues.includes(asin);
  }

  const idGroups = doc.identifiers as { identifiers?: { identifierType: string; identifier: string }[] }[] | undefined;
  if (!idGroups) return false;
  return idGroups.some((group) => group.identifiers?.some((id) => id.identifierType === identifiersType && identifierValues.includes(id.identifier)));
}

/**
 * Matches a document against the brandNames search mode.
 * Case-insensitive exact match on summaries[].brand.
 */
function matchesBrandNames(doc: Record<string, unknown>, brandRegexes: RegExp[]): boolean {
  const summaries = doc.summaries as { brand?: string }[] | undefined;
  if (!summaries) return false;
  return brandRegexes.some((re) => summaries.some((s) => s.brand && re.test(s.brand)));
}

/**
 * Matches a document against a classificationIds filter.
 * Checks if any classification in the document matches the provided IDs.
 */
function matchesClassificationIds(doc: Record<string, unknown>, classificationIds: string[]): boolean {
  const classGroups = doc.classifications as { classifications?: { classificationId: string }[] }[] | undefined;
  if (!classGroups) return false;
  return classGroups.some((group) => group.classifications?.some((c) => classificationIds.includes(c.classificationId)));
}

/**
 * Handler for searchCatalogItems (Catalog Items API v2022-04-01).
 *
 * Searches catalog items in the local database using one of three search modes:
 * - Keywords: case-insensitive substring match on summaries[].itemName or summaries[].brand
 * - Identifiers: exact match on identifiers[].identifiers[] for the specified identifiersType
 * - BrandNames: case-insensitive exact match on summaries[].brand
 *
 * Optionally filters by classificationIds, applies pagination, and filters each
 * result item by includedData.
 */
export const searchCatalogItemsHandler: OperationHandler = async (validationResult) => {
  const qp = validationResult.queryParams;

  // Parse array query params
  const keywords = parseArrayParam(qp.keywords);
  const identifiers = parseArrayParam(qp.identifiers);
  const identifiersType = qp.identifiersType as string | undefined;
  const brandNames = parseArrayParam(qp.brandNames);
  const classificationIds = parseArrayParam(qp.classificationIds);
  const pageToken = qp.pageToken as string | undefined;
  const pageSize = qp.pageSize ? Number(qp.pageSize) : 10;

  const allItems = Context.instance.engine.find(Api.CATALOG, {});

  // Build a predicate based on the search mode
  let searchPredicate: (doc: Record<string, unknown>) => boolean;

  if (keywords && keywords.length > 0) {
    const keywordRegexes = keywords.map((kw: string) => new RegExp(escapeRegex(kw), "i"));
    if (brandNames && brandNames.length > 0) {
      // brandNames narrows keyword results by requiring an exact brand match
      const brandRegexes = brandNames.map((b: string) => new RegExp(`^${escapeRegex(b)}$`, "i"));
      searchPredicate = (doc) => matchesKeywords(doc, keywordRegexes) && matchesBrandNames(doc, brandRegexes);
    } else {
      searchPredicate = (doc) => matchesKeywords(doc, keywordRegexes);
    }
  } else if (identifiers && identifiers.length > 0) {
    searchPredicate = (doc) => matchesIdentifiers(doc, identifiers, identifiersType);
  } else {
    // No search criteria — return empty results
    searchPredicate = () => false;
  }

  // Apply search predicate and optional classificationIds filter
  const results = allItems.filter((doc) => {
    if (!searchPredicate(doc)) return false;
    if (classificationIds && classificationIds.length > 0) {
      return matchesClassificationIds(doc, classificationIds);
    }
    return true;
  });

  // Apply pagination
  const paginationResult = paginate(results, pageSize, pageToken);

  // Parse includedData
  const includedData = parseIncludedData(qp.includedData);

  // Filter each paginated item by includedData
  const filteredItems = paginationResult.page.map((item) => filterCatalogItem(item as Record<string, unknown>, includedData));

  // Build pagination response object — only include if there are tokens
  const pagination: Record<string, unknown> = {};
  if (paginationResult.nextToken) {
    pagination.nextToken = paginationResult.nextToken;
  }
  if (paginationResult.previousToken) {
    pagination.previousToken = paginationResult.previousToken;
  }

  const responseBody: Record<string, unknown> = {
    numberOfResults: paginationResult.numberOfResults,
    items: filteredItems,
  };

  if (Object.keys(pagination).length > 0) {
    responseBody.pagination = pagination;
  }

  return {
    statusCode: 200,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: {
      body: responseBody,
    },
  };
};
