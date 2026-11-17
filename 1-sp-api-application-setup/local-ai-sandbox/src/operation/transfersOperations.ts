/**
 * Transfers API v2024-06-01 — data model and shared helpers for the four
 * local, deterministic operation handlers (`initiatePayout`, `listPayouts`,
 * `getPaymentMethods`, `listExpectedPayouts`), mirroring the single-file-per-domain
 * convention used by `financesOperations.ts` and `fbaInventoryOperations.ts`.
 *
 * The TRANSFERS namespace stores three distinct record shapes under one
 * partition — Payout_Record, Expected_Payout_Record, Payment_Method_Record — each
 * distinguished by the `_type` discriminator, since all three are logically
 * "transfer-related records" that are seeded and queried together but have no
 * natural foreign-key relationship to each other. Each handler only ever queries
 * for its own `_type`, so cross-type leakage cannot occur regardless of what else
 * is seeded into the namespace.
 */

import { randomUUID } from "node:crypto";

import type { OperationContext, OperationHandler } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";
import { Paginator } from "../service/Paginator.js";
import { stripInternalRecordFields } from "../util.js";

// --- Types ---

/** Discriminator shared by every document in the TRANSFERS namespace. */
export type TransfersRecordType = "PAYOUT" | "EXPECTED_PAYOUT" | "PAYMENT_METHOD";

export interface PartnerMetadata {
  partnerId?: string;
  accountType?: string;
  marketplaceId?: string;
}

export interface Money {
  currencyCode?: string;
  currencyAmount?: number;
}

export interface Period {
  startDate?: string; // ISO 8601 date-time
  endDate?: string; // ISO 8601 date-time
}

export interface RelatedIdentifier {
  relatedIdentifierName: string;
  relatedIdentifierValue: string;
}

export interface StatusHistoryEntry {
  status: string;
  lastUpdatedDate: string; // ISO 8601 date-time
}

/** Document shape for a Payout_Record. Keyed by `id`. */
export interface PayoutRecord {
  _key: string; // id
  _type: "PAYOUT";
  id: string;
  partnerMetadata?: PartnerMetadata;
  currentStatus?: string;
  statusHistory?: StatusHistoryEntry[];
  type?: string;
  amount?: Money;
  accountTail?: string;
  paymentMethod?: string;
  creationDate: string; // ISO 8601 date-time, set by initiatePayout
  paymentRail?: string;
  traceId?: string;
  period?: Period;
  relatedIdentifiers?: RelatedIdentifier[];
}

/** Document shape for an Expected_Payout_Record. Keyed by a synthetic identifier. */
export interface ExpectedPayoutRecord {
  _key: string;
  _type: "EXPECTED_PAYOUT";
  partnerMetadata?: PartnerMetadata;
  amount?: Money;
  status?: string;
  scheduledDate?: string; // ISO 8601 date-time
  accountTail?: string;
  paymentMethod?: string;
  period?: Period;
}

/** Document shape for a Payment_Method_Record. Keyed by `paymentMethodId`. */
export interface PaymentMethodRecord {
  _key: string; // paymentMethodId
  _type: "PAYMENT_METHOD";
  paymentMethodId: string;
  accountHolderName?: string;
  paymentMethodType: "BANK_ACCOUNT" | "CARD" | "SELLER_WALLET";
  tail?: string;
  assignmentType?: string;
  marketplaceId?: string; // used to filter by the request's marketplaceId
  // Present only when paymentMethodType === "CARD" (Requirement 5.5):
  countryCode?: string;
  expiryDate?: string;
}

// --- Data-generation guidance ---

/**
 * Data-generation guidance for the Transfers domain, consumed by the data
 * generator's `guidance_retrieval` tool (see src/tool/domainGuidance.ts).
 *
 * As with Finances, the OpenAPI model describes the API *response* shape, not
 * the stored document shape. All three Transfers record kinds share one
 * partition and are told apart by a `_type` discriminator the handlers query on
 * (`find(Api.TRANSFERS, { _type: "PAYOUT" })`) that appears nowhere in
 * transfers_2024-06-01.json. Without this guidance the generator produces
 * response-shaped objects the handlers can never read back.
 */
export const TRANSFERS_GENERATION_GUIDANCE = `
        - Transfers: the 'transfers' partition stores three record kinds in one
          namespace, told apart by a required '_type' discriminator the readers
          filter on: '_type' is "PAYOUT", "EXPECTED_PAYOUT", or "PAYMENT_METHOD".
          An entity without the matching '_type' is invisible to every Transfers
          handler.
        - Transfers payouts ('_type': "PAYOUT"): key the entity by its 'id'.
          listPayouts only ever reads records that already exist, so to seed a
          listable payout directly you must supply the fields initiatePayout would
          normally stamp. Shape:
          { _type: "PAYOUT", id, creationDate (ISO 8601 date-time, required —
            listPayouts orders and filters on it),
            currentStatus (must equal the most recent statusHistory entry's status),
            statusHistory: [{ status, lastUpdatedDate (ISO 8601 date-time) }],
            type, amount: { currencyCode, currencyAmount }, accountTail,
            paymentMethod, paymentRail, traceId,
            period: { startDate, endDate },
            relatedIdentifiers: [{ relatedIdentifierName, relatedIdentifierValue }],
            partnerMetadata: { partnerId, accountType, marketplaceId } }.
          listPayouts filters on partnerMetadata.marketplaceId,
          partnerMetadata.accountType, id (as payoutId) and the creationDate range —
          populate partnerMetadata for the marketplace/account filters to work.
        - Transfers expected payouts ('_type': "EXPECTED_PAYOUT"): key the entity by
          a synthetic id. Shape:
          { _type: "EXPECTED_PAYOUT", amount: { currencyCode, currencyAmount },
            status, scheduledDate (ISO 8601 date-time; listExpectedPayouts orders on
            it, and records without it sort last), accountTail, paymentMethod,
            period: { startDate, endDate },
            partnerMetadata: { partnerId, accountType, marketplaceId } }.
          listExpectedPayouts filters on partnerMetadata.marketplaceId and
          partnerMetadata.accountType.
        - Transfers payment methods ('_type': "PAYMENT_METHOD"): key the entity by its
          'paymentMethodId'. Shape:
          { _type: "PAYMENT_METHOD", paymentMethodId, accountHolderName,
            paymentMethodType ("BANK_ACCOUNT" | "CARD" | "SELLER_WALLET"), tail,
            assignmentType, marketplaceId }. getPaymentMethods requires a
            'marketplaceId' and matches the top-level 'marketplaceId' field exactly
            (NOT partnerMetadata), so set it on every payment-method record. Only when
            paymentMethodType is "CARD", also include 'countryCode' and 'expiryDate';
            they are returned for cards only.
        - Transfers: use plain currency objects { currencyCode, currencyAmount }
          (e.g. { currencyCode: "USD", currencyAmount: 19.99 }). Dates are ISO 8601
          date-time strings.`;

// --- Shared helpers ---

/**
 * Composes a list of predicates into a single AND-composed predicate: the
 * returned function is true for an item only when every supplied predicate is
 * true for it. Used by the list handlers to apply their filter parameters in
 * AND composition.
 */
export function matchesAll<T>(predicates: ((item: T) => boolean)[]): (item: T) => boolean {
  return (item) => predicates.every((p) => p(item));
}

/**
 * Builds the shared 400 InvalidInput OperationContext shape used by handler-level
 * validation checks in this file — identical to what the validation pipeline would
 * produce, so callers can't tell which layer rejected the request. Mirrors the
 * `invalidInput` helper in `financesOperations.ts`.
 */
function invalidInput(validationResult: Parameters<OperationHandler>[0], message: string): OperationContext {
  return {
    statusCode: 400,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: { errors: [{ code: "InvalidInput", message }] } },
  };
}

// --- initiatePayout ---

/**
 * Handler for Transfers v2024-06-01 initiatePayout.
 *
 * Extracts `marketplaceId` and `accountType` from the request body and, after a
 * handler-level required-field re-check (the schema stage already enforces
 * required-ness, but the 24-hour duplicate check below must not run against
 * partial input), enforces the one-payout-per-marketplace-and-account-type-per-24h
 * rule against existing PAYOUT-typed records. On success it writes a new
 * Payout_Record (keyed by a freshly generated `id`) to the TRANSFERS namespace and
 * returns the generated `id` as `payoutReferenceId`.
 *
 * The fixed-EU-allowlist marketplace check lives in the validation pipeline
 * (`fixedMarketplaceAllowlist` rule), so by the time this handler runs the
 * `marketplaceId` — when present — is already known valid.
 */
export const initiatePayoutHandler: OperationHandler = async (validationResult, request) => {
  const body = (request.body ?? {}) as Record<string, unknown>;

  // 1. Extract required body fields.
  const marketplaceId = body.marketplaceId as string | undefined;
  const accountType = body.accountType as string | undefined;

  // 2. Reject with 400/InvalidInput if either required field is missing, leaving
  //    the TRANSFERS namespace unchanged.
  if (marketplaceId === undefined || accountType === undefined) {
    return invalidInput(validationResult, "Both 'marketplaceId' and 'accountType' are required");
  }

  // 3. Enforce the 24-hour one-payout-per-marketplace-and-account-type rule against
  //    existing PAYOUT-typed records. A match within the window returns 429 and
  //    leaves the namespace unchanged.
  const now = new Date();
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const existingPayouts = Context.instance.engine.find(Api.TRANSFERS, { _type: "PAYOUT" }) as unknown as PayoutRecord[];
  const recentDuplicate = existingPayouts.find(
    (p) =>
      p.partnerMetadata?.marketplaceId === marketplaceId &&
      p.partnerMetadata?.accountType === accountType &&
      new Date(p.creationDate) >= windowStart,
  );
  if (recentDuplicate) {
    return {
      statusCode: 429,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body: undefined,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: {
        body: {
          errors: [
            {
              code: "QuotaExceeded",
              message: "Only one on-demand payout is permitted per marketplace and account type per 24-hour period",
            },
          ],
        },
      },
    };
  }

  // 4. Create a new Payout_Record keyed by a freshly generated unique id.
  //    The initial status is "STARTED" — the first member of the schema's
  //    PayoutStatusName enum — and statusHistory is seeded with a matching
  //    entry so currentStatus corresponds to the most recent history entry,
  //    as the Payout schema requires. (The schema marks both currentStatus
  //    and statusHistory required.)
  const id = randomUUID();
  const nowIso = now.toISOString();
  const record: PayoutRecord = {
    _key: id,
    _type: "PAYOUT",
    id,
    creationDate: nowIso,
    currentStatus: "STARTED",
    statusHistory: [{ status: "STARTED", lastUpdatedDate: nowIso }],
    partnerMetadata: {
      marketplaceId,
      accountType,
    },
  };

  // 5. Write the record to the TRANSFERS namespace.
  Context.instance.engine.put(Api.TRANSFERS, id, record as unknown as Record<string, unknown>);

  // 6. Return 200 with the generated id as payoutReferenceId.
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
    data: { body: { payoutReferenceId: id } },
  };
};

// --- listPayouts ---

const payoutsPaginator = new Paginator({ defaultPageSize: 10, maxPageSize: 100 });

/**
 * Handler for Transfers v2024-06-01 listPayouts.
 *
 * Queries the TRANSFERS namespace for Payout_Record documents
 * (_type === "PAYOUT"), applies AND-composed, case-sensitive exact-match and
 * date-range filters, orders by `creationDate` descending (ties broken by `id`
 * ascending lexicographic), and paginates the result.
 *
 * Response envelope is `{ payouts, nextToken? }` at HTTP 200. A malformed,
 * expired, or filter-mismatched `nextToken` yields `payouts: []` with no
 * `nextToken` (the Paginator's existing graceful-degradation behavior).
 */
export const listPayoutsHandler: OperationHandler = async (validationResult) => {
  const qp = validationResult.queryParams;

  // 1. Extract query params. marketplaceIds may arrive as a string or string[]
  //    (comma-separated or repeated); the rest are scalar strings.
  const marketplaceIds = qp.marketplaceIds;
  const accountType = qp.accountType as string | undefined;
  const payoutId = qp.payoutId as string | undefined;
  const createdAfter = qp.createdAfter as string | undefined;
  const createdBefore = qp.createdBefore as string | undefined;
  const nextToken = qp.nextToken as string | undefined;

  // 2. Validate createdAfter/createdBefore parse as valid date-times.
  let createdAfterTime: number | undefined;
  if (createdAfter !== undefined) {
    createdAfterTime = new Date(createdAfter).getTime();
    if (!Number.isFinite(createdAfterTime)) {
      return invalidInput(validationResult, "Parameter 'createdAfter' must be a valid date-time");
    }
  }

  let createdBeforeTime: number | undefined;
  if (createdBefore !== undefined) {
    createdBeforeTime = new Date(createdBefore).getTime();
    if (!Number.isFinite(createdBeforeTime)) {
      return invalidInput(validationResult, "Parameter 'createdBefore' must be a valid date-time");
    }
  }

  // 3. Validate createdAfter is not chronologically after createdBefore.
  if (createdAfterTime !== undefined && createdBeforeTime !== undefined && createdAfterTime > createdBeforeTime) {
    return invalidInput(validationResult, "Parameter 'createdAfter' must be before or equal to 'createdBefore'");
  }

  // 5. Query the TRANSFERS namespace for Payout_Record documents only.
  const allPayouts = Context.instance.engine.find(Api.TRANSFERS, { _type: "PAYOUT" }) as unknown as PayoutRecord[];

  // 6. Build AND-composed filter predicates for every filter actually supplied.
  const predicates: ((item: PayoutRecord) => boolean)[] = [];

  if (marketplaceIds) {
    // marketplaceIds may be an array or a comma-separated string.
    const marketplaceIdList = Array.isArray(marketplaceIds) ? marketplaceIds : marketplaceIds.split(",").filter((id) => id !== "");
    predicates.push((item) => {
      const marketplaceId = item.partnerMetadata?.marketplaceId;
      return marketplaceId !== undefined && marketplaceIdList.includes(marketplaceId);
    });
  }

  if (accountType) {
    predicates.push((item) => item.partnerMetadata?.accountType === accountType);
  }

  if (payoutId) {
    predicates.push((item) => item.id === payoutId);
  }

  if (createdAfterTime !== undefined) {
    predicates.push((item) => new Date(item.creationDate).getTime() >= createdAfterTime);
  }

  if (createdBeforeTime !== undefined) {
    predicates.push((item) => new Date(item.creationDate).getTime() < createdBeforeTime);
  }

  const filtered = allPayouts.filter(matchesAll(predicates));

  // 7. Order by creationDate descending; break ties by id ascending lexicographic.
  filtered.sort((a, b) => {
    const diff = new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime();
    if (diff !== 0) return diff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // 8. Paginate (default page size 10, max 100).
  const paginationResult = payoutsPaginator.paginate(filtered, { pageToken: nextToken });

  const responseBody: Record<string, unknown> = { payouts: stripInternalRecordFields(paginationResult.page) };
  if (paginationResult.nextToken) {
    responseBody.nextToken = paginationResult.nextToken;
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
    data: { body: responseBody },
  };
};

// --- getPaymentMethods ---

/** The three payment-method types the Transfers API recognizes (Requirement 5.4). */
const PAYMENT_METHOD_TYPES = ["BANK_ACCOUNT", "CARD", "SELLER_WALLET"] as const;

/**
 * Handler for Transfers v2024-06-01 getPaymentMethods.
 *
 * Queries the TRANSFERS namespace for Payment_Method_Record documents
 * (_type === "PAYMENT_METHOD"), applies AND-composed, case-sensitive exact-match
 * filters on `marketplaceId` (required) and `paymentMethodTypes` (optional), and
 * returns the matching records in a `paymentMethods` array at HTTP 200. There is
 * no pagination (Requirement 5.1/5.6).
 *
 * `marketplaceId` is required: its absence yields 400/InvalidInput. The optional
 * `paymentMethodTypes` is a comma-separated list whose every value must be one of
 * BANK_ACCOUNT/CARD/SELLER_WALLET — this enum check is performed inline here
 * rather than via a pipeline rule type (there is only one call site), and an
 * out-of-enum value yields 400/InvalidInput.
 *
 * Each response entry omits the internal `_key`, `_type`, and `marketplaceId`
 * fields, and includes `countryCode`/`expiryDate` if and only if its
 * `paymentMethodType` is "CARD" (Requirement 5.5).
 */
export const getPaymentMethodsHandler: OperationHandler = async (validationResult) => {
  const qp = validationResult.queryParams;

  // 1. Extract query params. marketplaceId is a scalar string; paymentMethodTypes
  //    may arrive as a string (comma-separated or single) or a string[] (repeated).
  const marketplaceId = qp.marketplaceId as string | undefined;
  const paymentMethodTypesRaw = qp.paymentMethodTypes;

  // 2. Reject with 400/InvalidInput if the required marketplaceId is missing.
  if (marketplaceId === undefined) {
    return invalidInput(validationResult, "Query parameter 'marketplaceId' is required");
  }

  // 3. Normalize paymentMethodTypes to a flat list of values (if provided) and
  //    validate every value against the fixed enum, rejecting otherwise.
  let requestedTypes: string[] | undefined;
  if (paymentMethodTypesRaw !== undefined) {
    const parts = (Array.isArray(paymentMethodTypesRaw) ? paymentMethodTypesRaw : [paymentMethodTypesRaw]).flatMap((value) =>
      value.split(",").filter((v) => v !== ""),
    );
    const invalid = parts.find((value) => !(PAYMENT_METHOD_TYPES as readonly string[]).includes(value));
    if (invalid !== undefined) {
      return invalidInput(
        validationResult,
        `Parameter 'paymentMethodTypes' must contain only ${PAYMENT_METHOD_TYPES.join(", ")}`,
      );
    }
    // An empty or blank paymentMethodTypes (e.g. `?paymentMethodTypes=`) parses to
    // zero values; treat that as "filter not provided" and leave requestedTypes
    // undefined, rather than installing a predicate that matches nothing and
    // silently suppresses every result.
    if (parts.length > 0) {
      requestedTypes = parts;
    }
  }

  // 4. Query the TRANSFERS namespace for Payment_Method_Record documents only.
  const allPaymentMethods = Context.instance.engine.find(Api.TRANSFERS, { _type: "PAYMENT_METHOD" }) as unknown as PaymentMethodRecord[];

  // 5. Build AND-composed filter predicates: marketplaceId (exact) always, and
  //    paymentMethodType membership when paymentMethodTypes was supplied.
  const predicates: ((item: PaymentMethodRecord) => boolean)[] = [(item) => item.marketplaceId === marketplaceId];

  if (requestedTypes !== undefined) {
    const typeSet = requestedTypes;
    predicates.push((item) => typeSet.includes(item.paymentMethodType));
  }

  const matched = allPaymentMethods.filter(matchesAll(predicates));

  // 6. Shape each entry: drop the internal _key/_type fields (via the shared
  //    sanitizer) plus marketplaceId — a real record field that is not part of
  //    the PaymentMethodDetails response schema — and include
  //    countryCode/expiryDate only for CARD payment methods.
  const paymentMethods = matched.map((record) => {
    const { marketplaceId: _marketplaceId, countryCode, expiryDate, ...rest } = stripInternalRecordFields(record);
    void _marketplaceId;
    if (record.paymentMethodType === "CARD") {
      return { ...rest, countryCode, expiryDate };
    }
    return rest;
  });

  // 7. Return 200 with { paymentMethods } (no pagination).
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
    data: { body: { paymentMethods } },
  };
};

// --- listExpectedPayouts ---

const expectedPayoutsPaginator = new Paginator({ defaultPageSize: 10, maxPageSize: 100 });

/**
 * Handler for Transfers v2024-06-01 listExpectedPayouts.
 *
 * Queries the TRANSFERS namespace for Expected_Payout_Record documents
 * (_type === "EXPECTED_PAYOUT"), applies AND-composed, case-sensitive exact-match
 * filters on `marketplaceIds` and `accountType`, orders by `scheduledDate`
 * descending (ties broken by `_key` ascending lexicographic — a stable,
 * implementation-defined tiebreak as permitted by Requirement 6.4), and paginates
 * the result (default page size 10, max 100).
 *
 * `scheduledDate` is optional on an Expected_Payout_Record: records lacking a
 * `scheduledDate` sort after (below) every record that has one, with ties among
 * them resolved by the same `_key` tiebreak, so ordering stays total and stable.
 *
 * Response envelope is `{ expectedPayouts, nextToken? }` at HTTP 200. A malformed,
 * expired, or filter-mismatched `nextToken` yields `expectedPayouts: []` with no
 * `nextToken` (the Paginator's existing graceful-degradation behavior).
 */
export const listExpectedPayoutsHandler: OperationHandler = async (validationResult) => {
  const qp = validationResult.queryParams;

  // 1. Extract query params. marketplaceIds may arrive as a string or string[]
  //    (comma-separated or repeated); the rest are scalar strings.
  const marketplaceIds = qp.marketplaceIds;
  const accountType = qp.accountType as string | undefined;
  const nextToken = qp.nextToken as string | undefined;

  // 2. Query the TRANSFERS namespace for Expected_Payout_Record documents only.
  const allExpectedPayouts = Context.instance.engine.find(Api.TRANSFERS, { _type: "EXPECTED_PAYOUT" }) as unknown as ExpectedPayoutRecord[];

  // 3. Build AND-composed filter predicates for every filter actually supplied.
  const predicates: ((item: ExpectedPayoutRecord) => boolean)[] = [];

  if (marketplaceIds) {
    // marketplaceIds may be an array or a comma-separated string.
    const marketplaceIdList = Array.isArray(marketplaceIds) ? marketplaceIds : marketplaceIds.split(",").filter((id) => id !== "");
    predicates.push((item) => {
      const marketplaceId = item.partnerMetadata?.marketplaceId;
      return marketplaceId !== undefined && marketplaceIdList.includes(marketplaceId);
    });
  }

  if (accountType) {
    predicates.push((item) => item.partnerMetadata?.accountType === accountType);
  }

  const filtered = allExpectedPayouts.filter(matchesAll(predicates));

  // 4. Order by scheduledDate descending; records with no scheduledDate sort last.
  //    Ties (including two missing dates) break by _key ascending lexicographic —
  //    a stable, implementation-defined ordering per Requirement 6.4.
  filtered.sort((a, b) => {
    const aTime = a.scheduledDate !== undefined ? new Date(a.scheduledDate).getTime() : undefined;
    const bTime = b.scheduledDate !== undefined ? new Date(b.scheduledDate).getTime() : undefined;
    const aValid = aTime !== undefined && Number.isFinite(aTime);
    const bValid = bTime !== undefined && Number.isFinite(bTime);
    if (aValid && bValid) {
      const diff = bTime - aTime;
      if (diff !== 0) return diff;
    } else if (aValid !== bValid) {
      // The record with a usable scheduledDate sorts before the one without.
      return aValid ? -1 : 1;
    }
    return a._key < b._key ? -1 : a._key > b._key ? 1 : 0;
  });

  // 5. Paginate (default page size 10, max 100).
  const paginationResult = expectedPayoutsPaginator.paginate(filtered, { pageToken: nextToken });

  const responseBody: Record<string, unknown> = { expectedPayouts: stripInternalRecordFields(paginationResult.page) };
  if (paginationResult.nextToken) {
    responseBody.nextToken = paginationResult.nextToken;
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
    data: { body: responseBody },
  };
};
