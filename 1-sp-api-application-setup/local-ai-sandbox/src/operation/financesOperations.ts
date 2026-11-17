/**
 * Finances API v2024-06-19 — data model and shared helpers for the three
 * local, deterministic operation handlers (`listTransactions`, `listBalances`,
 * `listSummary`), mirroring the single-file-per-domain convention used by
 * `fbaInventoryOperations.ts` and `catalogItemsOperations.ts`.
 *
 * The FINANCES namespace stores three distinct record shapes under one
 * partition — Transaction_Record, Balance_Record, Summary_Record — each
 * distinguished by the `_type` discriminator, since all three are logically
 * "financial records" that are seeded and queried together but have no
 * natural foreign-key relationship to each other.
 */

import type { OperationContext, OperationHandler } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";
import { Paginator } from "../service/Paginator.js";
import { stripInternalRecordFields } from "../util.js";

// --- Types ---

/** Discriminator shared by every document in the FINANCES namespace. */
export type FinancesRecordType = "TRANSACTION" | "BALANCE" | "SUMMARY";

export interface RelatedIdentifier {
  relatedIdentifierName: string; // e.g. "ORDER_ID", "FINANCIAL_EVENT_GROUP_ID", "SETTLEMENT_ID"
  relatedIdentifierValue: string;
}

export interface Currency {
  currencyCode?: string;
  currencyAmount?: number;
}

/** Document shape for a Transaction_Record. Keyed by `transactionId`. */
export interface TransactionRecord {
  _key: string; // transactionId
  _type: "TRANSACTION";
  transactionId: string;
  transactionType?: string;
  transactionStatus?: string; // "DEFERRED" | "RELEASED" | "DEFERRED_RELEASED"
  description?: string;
  postedDate?: string; // ISO 8601 date-time
  totalAmount?: Currency;
  relatedIdentifiers?: RelatedIdentifier[];
  marketplaceDetails?: {
    marketplaceId?: string;
    marketplaceName?: string;
  };
  sellingPartnerMetadata?: {
    sellingPartnerId?: string;
    accountType?: string;
    marketplaceId?: string;
  };
  items?: unknown[];
}

/** Document shape for a Balance_Record. Keyed by a synthetic identifier. */
export interface BalanceRecord {
  _key: string;
  _type: "BALANCE";
  balanceType?: string; // "AVAILABLE" | "RESERVED" | "ACCOUNT_LEVEL_RESERVE" | "DEFERRED" | "TOTAL"
  amount?: Currency;
  partnerMetadata?: {
    partnerId?: string;
    accountType?: string;
    marketplaceId?: string;
  };
  balances?: BalanceRecord[]; // nested sub-balances per the real API's recursive shape
}

/** Document shape for a Summary_Record. Keyed by a synthetic identifier. */
export interface SummaryRecord {
  _key: string;
  _type: "SUMMARY";
  netProceeds?: Currency;
  relatedIdentifiers?: RelatedIdentifier[];
  breakdowns?: unknown[];
  periodStart?: string; // ISO 8601 date-time
  periodEnd?: string; // ISO 8601 date-time
  partnerMetadata?: {
    partnerId?: string;
    accountType?: string;
    marketplaceId?: string;
  };
}

// --- Data-generation guidance ---

/**
 * Data-generation guidance for the Finances domain, consumed by the data
 * generator's `guidance_retrieval` tool (see src/tool/domainGuidance.ts).
 *
 * The OpenAPI model describes the API *response* shape, not the stored
 * document shape. The two diverge here: all three Finances record kinds share
 * one partition and are told apart by a `_type` discriminator that the handlers
 * query on (`find(Api.FINANCES, { _type: "TRANSACTION" })`) but that appears
 * nowhere in finances_2024-06-19.json. Without this guidance the generator
 * produces response-shaped objects the handlers can never read back.
 */
export const FINANCES_GENERATION_GUIDANCE = `
        - Finances: the 'finances' partition stores three record kinds in one
          namespace, told apart by a required '_type' discriminator the readers
          filter on: '_type' is "TRANSACTION", "BALANCE", or "SUMMARY". An entity
          without the matching '_type' is invisible to every Finances handler.
        - Finances transactions ('_type': "TRANSACTION"): key the entity by its
          'transactionId'. Shape:
          { _type: "TRANSACTION", transactionId, transactionType,
            transactionStatus ("DEFERRED" | "RELEASED" | "DEFERRED_RELEASED"),
            description, postedDate (ISO 8601 date-time),
            totalAmount: { currencyCode, currencyAmount },
            relatedIdentifiers: [{ relatedIdentifierName, relatedIdentifierValue }],
            marketplaceDetails: { marketplaceId, marketplaceName } }.
          listTransactions filters on postedDate, marketplaceDetails.marketplaceId,
          transactionStatus, and relatedIdentifiers — populate those for the
          filters to work.
        - Finances balances ('_type': "BALANCE"): key the entity by a synthetic id.
          Shape:
          { _type: "BALANCE",
            balanceType ("AVAILABLE" | "RESERVED" | "ACCOUNT_LEVEL_RESERVE" | "DEFERRED" | "TOTAL"),
            amount: { currencyCode, currencyAmount },
            partnerMetadata: { partnerId, accountType, marketplaceId } }.
          listBalances filters on partnerMetadata.marketplaceId, balanceType and
          partnerMetadata.accountType.
        - Finances summaries ('_type': "SUMMARY"): key the entity by a synthetic id.
          Shape:
          { _type: "SUMMARY", netProceeds: { currencyCode, currencyAmount },
            relatedIdentifiers: [{ relatedIdentifierName, relatedIdentifierValue }],
            periodStart (ISO 8601 date-time), periodEnd (ISO 8601 date-time),
            partnerMetadata: { partnerId, accountType, marketplaceId } }.
          listSummary filters on partnerMetadata.marketplaceId,
          partnerMetadata.accountType, relatedIdentifiers, and the
          periodStart/periodEnd overlap — populate those (and set both period
          bounds) for the filters to work.
        - Finances: use plain currency objects { currencyCode, currencyAmount }
          (e.g. { currencyCode: "USD", currencyAmount: 19.99 }). Dates are ISO 8601
          date-time strings.`;

// --- Shared helpers ---

/**
 * Composes a list of predicates into a single predicate requiring all of
 * them to pass (AND composition). Every Finances handler builds one
 * predicate per supplied query filter and combines them with this helper,
 * so a record is included only if it satisfies every filter the caller
 * actually provided.
 *
 * Same shape as `searchCatalogItemsHandler`'s predicate composition,
 * generalized slightly since Finances handlers combine more independent
 * filters than Catalog Items does.
 */
export function matchesAll<T>(predicates: ((item: T) => boolean)[]): (item: T) => boolean {
  return (item) => predicates.every((p) => p(item));
}

// --- listTransactions ---

const transactionsPaginator = new Paginator({ defaultPageSize: 100, maxPageSize: 100 });

/**
 * Builds the shared 400 InvalidInput OperationContext shape used by every
 * handler-level validation check in this file (date ordering,
 * bounds, etc.) — identical to what the validation pipeline would produce,
 * so callers can't tell which layer rejected the request.
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

/**
 * Handler for Finances v2024-06-19 listTransactions.
 * Queries the FINANCES namespace for Transaction_Record documents
 * (_type === "TRANSACTION"), applies AND-composed filters, and paginates
 * the result (default/max page size 100).
 */
export const listTransactionsHandler: OperationHandler = async (validationResult) => {
  const qp = validationResult.queryParams;

  // Extract query params
  const postedAfter = qp.postedAfter as string | undefined;
  const postedBefore = qp.postedBefore as string | undefined;
  const marketplaceId = qp.marketplaceId as string | undefined;
  const transactionStatus = qp.transactionStatus as string | undefined;
  const relatedIdentifierName = qp.relatedIdentifierName as string | undefined;
  const relatedIdentifierValue = qp.relatedIdentifierValue as string | undefined;
  const nextToken = qp.nextToken as string | undefined;

  // Validate postedAfter/postedBefore ordering before querying.
  if (postedAfter && postedBefore) {
    const afterTime = new Date(postedAfter).getTime();
    const beforeTime = new Date(postedBefore).getTime();
    if (afterTime > beforeTime) {
      return invalidInput(validationResult, "Parameter 'postedAfter' must be before or equal to 'postedBefore'");
    }
  }

  // Query the FINANCES namespace for Transaction_Record documents only.
  const allTransactions = Context.instance.engine.find(Api.FINANCES, { _type: "TRANSACTION" }) as unknown as TransactionRecord[];

  // Build AND-composed filter predicates for every filter actually supplied.
  const predicates: ((item: TransactionRecord) => boolean)[] = [];

  if (postedAfter) {
    const afterTime = new Date(postedAfter).getTime();
    predicates.push((item) => !!item.postedDate && new Date(item.postedDate).getTime() >= afterTime);
  }

  if (postedBefore) {
    const beforeTime = new Date(postedBefore).getTime();
    predicates.push((item) => !!item.postedDate && new Date(item.postedDate).getTime() < beforeTime);
  }

  if (marketplaceId) {
    predicates.push((item) => item.marketplaceDetails?.marketplaceId === marketplaceId);
  }

  if (transactionStatus) {
    predicates.push((item) => item.transactionStatus === transactionStatus);
  }

  if (relatedIdentifierName && relatedIdentifierValue) {
    predicates.push((item) =>
      (item.relatedIdentifiers ?? []).some(
        (ri) => ri.relatedIdentifierName === relatedIdentifierName && ri.relatedIdentifierValue === relatedIdentifierValue,
      ),
    );
  }

  const filtered = allTransactions.filter(matchesAll(predicates));

  // Paginate (default/max page size 100).
  const paginationResult = transactionsPaginator.paginate(filtered, { pageToken: nextToken });

  const payload: Record<string, unknown> = { transactions: stripInternalRecordFields(paginationResult.page) };
  if (paginationResult.nextToken) {
    payload.nextToken = paginationResult.nextToken;
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
    data: { body: { payload } },
  };
};

// --- listBalances ---

const balancesPaginator = new Paginator({ defaultPageSize: 10, maxPageSize: 100 });

/**
 * Handler for Finances v2024-06-19 listBalances.
 * Queries the FINANCES namespace for Balance_Record documents
 * (_type === "BALANCE"), applies AND-composed, case-sensitive exact-match
 * filters, and paginates the result.
 */
export const listBalancesHandler: OperationHandler = async (validationResult) => {
  const qp = validationResult.queryParams;

  // Extract query params
  const marketplaceIds = qp.marketplaceIds;
  const balanceType = qp.balanceType as string | undefined;
  const accountType = qp.accountType as string | undefined;
  const nextToken = qp.nextToken as string | undefined;

  // Query the FINANCES namespace for Balance_Record documents only.
  const allBalances = Context.instance.engine.find(Api.FINANCES, { _type: "BALANCE" }) as unknown as BalanceRecord[];

  // Build AND-composed filter predicates for every filter actually supplied.
  const predicates: ((item: BalanceRecord) => boolean)[] = [];

  if (marketplaceIds) {
    // Parse marketplaceIds (may be array or comma-separated string).
    const marketplaceIdList = Array.isArray(marketplaceIds) ? marketplaceIds : marketplaceIds.split(",").filter((id) => id !== "");
    predicates.push((item) => {
      const marketplaceId = item.partnerMetadata?.marketplaceId;
      return marketplaceId !== undefined && marketplaceIdList.includes(marketplaceId);
    });
  }

  if (balanceType) {
    predicates.push((item) => item.balanceType === balanceType);
  }

  if (accountType) {
    predicates.push((item) => item.partnerMetadata?.accountType === accountType);
  }

  const filtered = allBalances.filter(matchesAll(predicates));

  // Paginate (default page size 10, max 100 — clamping handled by Paginator itself).
  const paginationResult = balancesPaginator.paginate(filtered, { pageToken: nextToken });

  const responseBody: Record<string, unknown> = { balances: stripInternalRecordFields(paginationResult.page) };
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

// --- listSummary ---

const summaryPaginator = new Paginator({ defaultPageSize: 100, maxPageSize: 100 });

/**
 * Handler for Finances v2024-06-19 listSummary.
 * Queries the FINANCES namespace for Summary_Record documents
 * (_type === "SUMMARY"), applies AND-composed filters (including the
 * periodStart/periodEnd overlap semantics from design.md Property 11), and
 * paginates the result (default/max page size 100).
 */
export const listSummaryHandler: OperationHandler = async (validationResult) => {
  const qp = validationResult.queryParams;

  // Extract query params
  const marketplaceIds = qp.marketplaceIds;
  const accountType = qp.accountType as string | undefined;
  const relatedIdentifierName = qp.relatedIdentifierName as string | undefined;
  const relatedIdentifierValue = qp.relatedIdentifierValue as string | undefined;
  const periodStart = qp.periodStart as string | undefined;
  const periodEnd = qp.periodEnd as string | undefined;
  const nextToken = qp.nextToken as string | undefined;

  // Validate periodStart/periodEnd parse as valid date-times before querying.
  let periodStartTime: number | undefined;
  if (periodStart !== undefined) {
    periodStartTime = new Date(periodStart).getTime();
    if (!Number.isFinite(periodStartTime)) {
      return invalidInput(validationResult, "Parameter 'periodStart' must be a valid date-time");
    }
  }

  let periodEndTime: number | undefined;
  if (periodEnd !== undefined) {
    periodEndTime = new Date(periodEnd).getTime();
    if (!Number.isFinite(periodEndTime)) {
      return invalidInput(validationResult, "Parameter 'periodEnd' must be a valid date-time");
    }
  }

  // Query the FINANCES namespace for Summary_Record documents only.
  const allSummaries = Context.instance.engine.find(Api.FINANCES, { _type: "SUMMARY" }) as unknown as SummaryRecord[];

  // Build AND-composed filter predicates for every filter actually supplied.
  const predicates: ((item: SummaryRecord) => boolean)[] = [];

  if (marketplaceIds) {
    // Parse marketplaceIds (may be array or comma-separated string).
    const marketplaceIdList = Array.isArray(marketplaceIds) ? marketplaceIds : marketplaceIds.split(",").filter((id) => id !== "");
    predicates.push((item) => {
      const marketplaceId = item.partnerMetadata?.marketplaceId;
      return marketplaceId !== undefined && marketplaceIdList.includes(marketplaceId);
    });
  }

  if (accountType) {
    predicates.push((item) => item.partnerMetadata?.accountType === accountType);
  }

  if (relatedIdentifierName && relatedIdentifierValue) {
    predicates.push((item) =>
      (item.relatedIdentifiers ?? []).some(
        (ri) => ri.relatedIdentifierName === relatedIdentifierName && ri.relatedIdentifierValue === relatedIdentifierValue,
      ),
    );
  }

  if (periodStartTime !== undefined) {
    predicates.push((item) => !!item.periodEnd && new Date(item.periodEnd).getTime() >= periodStartTime);
  }

  if (periodEndTime !== undefined) {
    predicates.push((item) => !!item.periodStart && new Date(item.periodStart).getTime() <= periodEndTime);
  }

  const filtered = allSummaries.filter(matchesAll(predicates));

  // Paginate (default/max page size 100).
  const paginationResult = summaryPaginator.paginate(filtered, { pageToken: nextToken });

  const responseBody: Record<string, unknown> = { summaries: stripInternalRecordFields(paginationResult.page) };
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
