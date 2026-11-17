/**
 * Dependency-free extractor for Data Kiosk GraphQL queries.
 *
 * Data Kiosk queries look like:
 *   {analytics_salesAndTraffic_2024_04_24{salesAndTrafficByDate(startDate:"2023-01-01"
 *     endDate:"2023-01-03" aggregateBy:DAY marketplaceIds:["ATVPDKIKX0DER"]){...}}}
 *
 * We do NOT run a real GraphQL engine — Level B only needs the top-level dataset,
 * the inner query field, and a handful of scalar/list arguments to drive
 * deterministic data generation. Extraction is done with targeted regexes.
 *
 * SCOPE / GUARANTEE: extraction is correct for the sandbox's supported shape — a
 * single top-level dataset selection wrapping a single query field with FLAT
 * arguments (`startDate`, `endDate`, `aggregateBy`, `marketplaceIds`). The
 * argument extractors scan the whole query for the FIRST occurrence of each
 * argument name; they are not selection-scoped, so a query with nested
 * selections that repeat these argument names (e.g. a `startDate` inside a
 * filter object) could mis-extract. That shape is not produced by the supported
 * datasets. If richer datasets are added, replace these regexes with a
 * selection-scoped extractor.
 */

export interface ParsedQuery {
  /** The top-level dataset selection, e.g. "analytics_salesAndTraffic_2024_04_24". */
  dataset: string;
  /** The inner query field, e.g. "salesAndTrafficByDate" | "salesAndTrafficByAsin". */
  queryField?: string;
  /** "YYYY-MM-DD" start date argument, when present. */
  startDate?: string;
  /** "YYYY-MM-DD" end date argument, when present. */
  endDate?: string;
  /** aggregateBy enum argument (unquoted), e.g. "DAY". */
  aggregateBy?: string;
  /** marketplaceIds list argument; empty when absent. */
  marketplaceIds: string[];
  /** The original query string (used for marker-based outcome classification). */
  raw: string;
}

/**
 * Length of the query after collapsing insignificant whitespace, per the
 * model's "at most 8000 characters after unnecessary whitespace is removed" rule.
 * Runs of whitespace collapse to a single space and leading/trailing space is trimmed.
 */
export function normalizedLength(query: string): number {
  return query.replace(/\s+/g, " ").trim().length;
}

/** Identifier characters allowed in a GraphQL field/dataset name. */
const IDENT = "[A-Za-z_][A-Za-z0-9_]*";

/**
 * Parses a Data Kiosk GraphQL query into a ParsedQuery.
 * Returns null when no top-level dataset selection can be found.
 */
export function parseGraphQLQuery(query: string): ParsedQuery | null {
  if (typeof query !== "string") return null;

  // Strip an optional leading `query` keyword and operation name, then find the
  // first selection name inside the outermost braces: `{ <dataset> { ... } }`.
  const datasetMatch = new RegExp(`\\{\\s*(${IDENT})\\b`).exec(query);
  if (!datasetMatch) return null;
  const dataset = datasetMatch[1];

  // The inner query field is the next identifier that is immediately followed by
  // `(` (arguments) or `{` (sub-selection) after the dataset.
  const afterDataset = query.slice(datasetMatch.index + datasetMatch[0].length);
  const fieldMatch = new RegExp(`\\{\\s*(${IDENT})\\s*[({]`).exec(afterDataset);
  const queryField = fieldMatch ? fieldMatch[1] : undefined;

  const startDate = extractStringArg(query, "startDate");
  const endDate = extractStringArg(query, "endDate");
  const aggregateBy = extractEnumArg(query, "aggregateBy");
  const marketplaceIds = extractStringListArg(query, "marketplaceIds");

  return { dataset, queryField, startDate, endDate, aggregateBy, marketplaceIds, raw: query };
}

/** Extracts a quoted scalar argument, e.g. `startDate:"2023-01-01"`. */
function extractStringArg(query: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*:\\s*"([^"]*)"`).exec(query);
  return m ? m[1] : undefined;
}

/** Extracts an unquoted enum argument, e.g. `aggregateBy:DAY`. */
function extractEnumArg(query: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*:\\s*(${IDENT})`).exec(query);
  return m ? m[1] : undefined;
}

/** Extracts a list-of-strings argument, e.g. `marketplaceIds:["A","B"]`. */
function extractStringListArg(query: string, name: string): string[] {
  const listMatch = new RegExp(`\\b${name}\\s*:\\s*\\[([^\\]]*)\\]`).exec(query);
  if (!listMatch) return [];
  const inner = listMatch[1];
  const result: string[] = [];
  const itemRe = /"([^"]*)"/g;
  let item: RegExpExecArray | null;
  while ((item = itemRe.exec(inner)) !== null) {
    result.push(item[1]);
  }
  return result;
}
