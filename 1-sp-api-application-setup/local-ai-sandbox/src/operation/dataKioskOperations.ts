import { randomUUID } from "node:crypto";
import { OperationHandler, OperationContext } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";
import { Paginator } from "../service/Paginator.js";
import type { Mode } from "../registry/operationRegistry.js";
import { parseGraphQLQuery, type ParsedQuery } from "./dataKioskQueryParser.js";
import { DATASETS, classifyOutcome, type Outcome } from "./dataKioskDatasets.js";

/**
 * Data Kiosk API (v2023-11-15) — local deterministic handlers.
 *
 * Mirrors the Reports API submit/poll/download pattern. All state lives in the
 * DATA_KIOSK namespace, which holds two document kinds distinguished by an
 * explicit `recordType` discriminator:
 *   - Query_Record:    recordType "query",    keyed by queryId
 *   - Document_Record: recordType "document", keyed by documentId, carries `content`
 *
 * Level B lifecycle: createQuery parses + validates the query, classifies its
 * outcome (DATA | NO_DATA | FATAL), and stores it as IN_QUEUE with pollCount 0.
 * Each getQuery poll advances IN_QUEUE -> IN_PROGRESS -> terminal; the terminal
 * transition materializes the document(s). getQueries never advances the state.
 */

/** Discriminator values for the two document kinds sharing the DATA_KIOSK namespace. */
const RECORD_TYPE_QUERY = "query";
const RECORD_TYPE_DOCUMENT = "document";

/** Data Kiosk getQueries pagination: default page size 10, max 100 (per the model's pageSize bounds). */
const queriesPaginator = new Paginator({ defaultPageSize: 10, maxPageSize: 100 });

/**
 * Poll count at which a query reaches a terminal state.
 * poll 0 -> IN_QUEUE, poll 1 -> IN_PROGRESS, poll >= 2 -> terminal (DONE/FATAL).
 */
const LIFECYCLE_THRESHOLD = 2;

/**
 * Generates a short, prefixed id. Uses the first 8 hex chars of a UUID (32 bits
 * of entropy) for readability. Collision probability is negligible at sandbox
 * scale (birthday bound ~77k ids); ids are unique only in combination with a
 * selling-partner account, matching the real Data Kiosk contract.
 */
function shortId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

/** Internal bookkeeping fields never returned to the client. */
function stripInternal(doc: Record<string, unknown>): Record<string, unknown> {
  const { $loki, meta, _key, recordType, content, contentType, pollCount, parsed, outcome, ...rest } = doc;
  return rest;
}

/** Computes the processingStatus for a given pollCount + outcome. */
function statusForPoll(pollCount: number, outcome: Outcome): "IN_QUEUE" | "IN_PROGRESS" | "DONE" | "FATAL" {
  if (pollCount < 1) return "IN_QUEUE";
  if (pollCount < LIFECYCLE_THRESHOLD) return "IN_PROGRESS";
  return outcome === "FATAL" ? "FATAL" : "DONE";
}

/**
 * Builds an OperationContext from the validation result, filling the repetitive
 * metadata fields so each handler only supplies what differs (status + data).
 */
function buildContext(
  validationResult: Parameters<OperationHandler>[0],
  overrides: { statusCode: number; data: Record<string, unknown>; body?: Record<string, unknown> },
): OperationContext {
  return {
    statusCode: overrides.statusCode,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: overrides.body,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: overrides.data,
  };
}

/**
 * The current operating mode, read at call time so runtime changes to
 * `process.env.MODE` are observed (used in tests).
 *
 * This must NOT import the `MODES`/`readModeFromEnv` VALUES from operationRegistry:
 * operationRegistry imports this handler module, so a value import would form a
 * runtime cycle and leave the registry's handler map undefined at construction.
 * The valid-mode set is therefore inlined here (kept in sync with the registry's
 * `Mode` type, imported type-only above). MODE is validated at boot by the
 * registry; here we fall back to the "Seller" default for an unset/invalid value.
 */
const VALID_MODES: readonly Mode[] = ["Seller", "Vendor"];
function currentMode(): Mode {
  const raw = process.env.MODE;
  return raw && VALID_MODES.includes(raw as Mode) ? (raw as Mode) : "Seller";
}

// --- createQuery ---

/** Builds a 400 InvalidInput OperationContext for a rejected createQuery. */
function createQueryError(validationResult: Parameters<OperationHandler>[0], body: Record<string, unknown>, message: string): OperationContext {
  return buildContext(validationResult, {
    statusCode: 400,
    body,
    data: { body: { errors: [{ code: "InvalidInput", message }] } },
  });
}

export const createQueryHandler: OperationHandler = async (validationResult, request) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const query = body.query as string;
  const paginationToken = body.paginationToken;

  // Parse the GraphQL query (the 8000-char cap is enforced by the pipeline).
  const parsed = parseGraphQLQuery(query);
  if (!parsed) {
    return createQueryError(validationResult, body, "The provided query could not be parsed. It must select a top-level dataset.");
  }

  const dataset = DATASETS[parsed.dataset];
  if (!dataset) {
    return createQueryError(validationResult, body, `The dataset '${parsed.dataset}' is not supported.`);
  }
  if (!dataset.supportedModes.includes(currentMode())) {
    return createQueryError(validationResult, body, `The dataset '${parsed.dataset}' is not available in the current mode '${currentMode()}'.`);
  }

  // Decide the eventual outcome now, so the DONE/FATAL transition is timing-independent.
  const outcome: Outcome = classifyOutcome(parsed);

  const queryId = shortId("DK");
  const now = new Date().toISOString();

  Context.instance.engine.put(Api.DATA_KIOSK, queryId, {
    recordType: RECORD_TYPE_QUERY,
    queryId,
    query,
    ...(typeof paginationToken === "string" && paginationToken.length > 0 ? { paginationToken } : {}),
    processingStatus: "IN_QUEUE",
    createdTime: now,
    pollCount: 0,
    parsed,
    outcome,
  });

  return buildContext(validationResult, { statusCode: 202, body, data: { body: { queryId } } });
};

// --- getQuery ---

/** True when a query is in a terminal state and should not advance further. */
function isTerminal(status: unknown): boolean {
  return status === "DONE" || status === "FATAL" || status === "CANCELLED";
}

/**
 * Materializes the terminal outcome on the record: generates the data or error
 * document, links its id, and sets the terminal processingStatus + timestamps.
 * Mutates `record` in place.
 */
function materializeOutcome(record: Record<string, unknown>, now: string): void {
  const outcome = record.outcome as Outcome;
  const parsed = record.parsed as ParsedQuery;
  record.processingStartTime = record.processingStartTime ?? now;
  record.processingEndTime = now;

  if (outcome === "DATA") {
    const dataDocumentId = shortId("DKDOC");
    Context.instance.engine.put(Api.DATA_KIOSK, dataDocumentId, {
      recordType: RECORD_TYPE_DOCUMENT,
      documentId: dataDocumentId,
      content: DATASETS[parsed.dataset].generate(parsed),
      contentType: "application/jsonl",
    });
    record.dataDocumentId = dataDocumentId;
    record.processingStatus = "DONE";
  } else if (outcome === "FATAL") {
    const errorDocumentId = shortId("DKDOC");
    Context.instance.engine.put(Api.DATA_KIOSK, errorDocumentId, {
      recordType: RECORD_TYPE_DOCUMENT,
      documentId: errorDocumentId,
      content: JSON.stringify({
        errors: [{ code: "InternalFailure", message: `Query processing failed for dataset '${parsed.dataset}'.` }],
      }),
      contentType: "application/json",
    });
    record.errorDocumentId = errorDocumentId;
    record.processingStatus = "FATAL";
  } else {
    // NO_DATA: DONE with neither document.
    record.processingStatus = "DONE";
  }
}

export const getQueryHandler: OperationHandler = async (validationResult) => {
  const queryId = validationResult.pathParams.queryId;

  // Re-read the record from the database rather than mutating the resolved-entity
  // copy in place: this keeps correctness independent of how the validation layer
  // resolves entities (live reference vs. clone). The pipeline has already
  // guaranteed the record exists; fall back to the resolved entity defensively.
  const query = Context.instance.engine.get(Api.DATA_KIOSK, queryId) ?? validationResult.resolvedEntities.query;

  // Advance the lifecycle for non-terminal records; terminal records are returned unchanged.
  if (!isTerminal(query.processingStatus)) {
    const nextPollCount = ((query.pollCount as number | undefined) ?? 0) + 1;
    query.pollCount = nextPollCount;
    const outcome = (query.outcome as Outcome | undefined) ?? "DATA";
    const nextStatus = statusForPoll(nextPollCount, outcome);
    const now = new Date().toISOString();

    if (nextStatus === "IN_PROGRESS") {
      query.processingStatus = "IN_PROGRESS";
      query.processingStartTime = query.processingStartTime ?? now;
    } else if (nextStatus === "DONE" || nextStatus === "FATAL") {
      materializeOutcome(query, now);
    } else {
      query.processingStatus = "IN_QUEUE";
    }

    Context.instance.engine.put(Api.DATA_KIOSK, queryId, query);
  }

  return buildContext(validationResult, { statusCode: 200, data: { body: stripInternal(query) } });
};

// --- getQueries ---

export const getQueriesHandler: OperationHandler = async (validationResult) => {
  const collection = Context.instance.engine.getCollection(Api.DATA_KIOSK);
  const allDocs = collection ? collection.find().map((d) => d as Record<string, unknown>) : [];

  // Keep only Query_Records via the explicit discriminator (with a legacy fallback
  // for records written before recordType existed: has queryId, no content).
  let queries = allDocs.filter((d) =>
    d.recordType !== undefined ? d.recordType === RECORD_TYPE_QUERY : typeof d.queryId === "string" && d.content === undefined,
  );

  // Filter: processingStatuses (array param or comma-separated string).
  const rawStatuses = validationResult.queryParams.processingStatuses;
  if (rawStatuses !== undefined) {
    const statuses = Array.isArray(rawStatuses) ? rawStatuses : rawStatuses.split(",");
    const statusSet = new Set(statuses.map((s) => s.trim()).filter(Boolean));
    if (statusSet.size > 0) {
      queries = queries.filter((q) => statusSet.has(q.processingStatus as string));
    }
  }

  // Filter: createdSince / createdUntil (inclusive) on createdTime. The schema
  // declares these as date-time (openapi-enforcer rejects malformed values
  // upstream); guard against NaN here so a bad value can never silently filter
  // out every record.
  const createdSince = validationResult.queryParams.createdSince as string | undefined;
  const createdUntil = validationResult.queryParams.createdUntil as string | undefined;
  if (createdSince) {
    const since = Date.parse(createdSince);
    if (!Number.isNaN(since)) {
      queries = queries.filter((q) => Date.parse(q.createdTime as string) >= since);
    }
  }
  if (createdUntil) {
    const until = Date.parse(createdUntil);
    if (!Number.isNaN(until)) {
      queries = queries.filter((q) => Date.parse(q.createdTime as string) <= until);
    }
  }

  // Stable ordering (newest first) for deterministic pagination.
  queries.sort((a, b) => Date.parse(b.createdTime as string) - Date.parse(a.createdTime as string));

  // Paginate via the shared Paginator (default 10, max 100; graceful empty page on bad token).
  const { page, nextToken } = queriesPaginator.paginate(queries, {
    pageSize: validationResult.queryParams.pageSize as string | undefined,
    pageToken: validationResult.queryParams.paginationToken as string | undefined,
  });

  const responseBody: Record<string, unknown> = { queries: page.map(stripInternal) };
  if (nextToken !== undefined) {
    responseBody.pagination = { nextToken };
  }

  return buildContext(validationResult, { statusCode: 200, data: { body: responseBody } });
};

// --- cancelQuery ---

export const cancelQueryHandler: OperationHandler = async (validationResult) => {
  const queryId = validationResult.pathParams.queryId;

  // Re-read from the database (see getQueryHandler) rather than mutating the
  // resolved-entity copy. The pipeline guarantees the query exists and is not
  // DONE/FATAL. Already-CANCELLED is a no-op.
  const query = Context.instance.engine.get(Api.DATA_KIOSK, queryId) ?? validationResult.resolvedEntities.query;

  if (query.processingStatus !== "CANCELLED") {
    query.processingStatus = "CANCELLED";
    Context.instance.engine.put(Api.DATA_KIOSK, queryId, query);
  }

  return buildContext(validationResult, { statusCode: 204, data: {} });
};

// --- getDocument ---

export const getDocumentHandler: OperationHandler = async (validationResult, request) => {
  const documentId = validationResult.pathParams.documentId;
  const host = request.get("host") ?? "localhost:9001";

  return buildContext(validationResult, {
    statusCode: 200,
    data: {
      body: {
        documentId,
        documentUrl: `http://${host}/dataKiosk/download/${documentId}`,
      },
    },
  });
};
