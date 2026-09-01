/**
 * Listings Items API v2021-08-01 — deterministic operation handlers.
 *
 * Responses combine the stored submission with read-time derivations
 * (listingsItemModel.ts). PUT validation is delegated to production
 * (listingsValidationPreview.ts); catalog matching runs asynchronously in the
 * listings trigger, as in production.
 *
 * The sandbox has no dry run: a request always mutates the sandbox DB and never
 * production, so the request's own `mode=VALIDATION_PREVIEW` changes nothing
 * here. (Distinct from the sandbox-wide Seller/Vendor MODE, which does apply:
 * both selling partner types call these operations, but the datasets and
 * submission features available to each differ.)
 */
import { randomUUID } from "node:crypto";
import type { OperationHandler } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";
// Read inside handlers only. The registry imports this module, so the binding
// is resolved when a request runs rather than while the modules initialise.
import { CURRENT_MODE } from "../registry/operationRegistry.js";
import { Paginator } from "../service/Paginator.js";
import { runValidationPreview } from "./listingsValidationPreview.js";
import {
  applyPatches,
  applySellerPutSemantics,
  asListingDoc,
  buildItemResponse,
  declaredContainedSkus,
  declaredParentSkus,
  deriveStatus,
  ISSUE_CODE_INVALID_VALUE,
  ledgerFromFulfillmentAttribute,
  listingKey,
  type ListingDoc,
  type ListingIssue,
  type ListingsPatchOperation,
} from "./listingsItemModel.js";

// --- Shared helpers ---

type QueryParams = Record<string, string | string[] | undefined>;

function parseIncludedData(queryParams: QueryParams): string[] {
  const raw = queryParams.includedData;
  if (!raw) return ["summaries"]; // default per API spec
  if (Array.isArray(raw)) return raw.flatMap((v) => v.split(","));
  return raw.split(",").map((s) => s.trim());
}

function firstMarketplaceId(queryParams: QueryParams): string {
  const raw = queryParams.marketplaceIds;
  if (Array.isArray(raw)) return raw[0];
  return (raw ?? "").split(",")[0];
}

/** Parses csv-or-array query params into a flat string array (or undefined). */
function parseArrayParam(param: string | string[] | undefined): string[] | undefined {
  if (param === undefined || param === "") return undefined;
  const values = Array.isArray(param) ? param.flatMap((v) => v.split(",")) : param.split(",");
  const cleaned = values.map((v) => v.trim()).filter((v) => v !== "");
  return cleaned.length > 0 ? cleaned : undefined;
}

function buildContext(
  validationResult: {
    operationId: string;
    apiName: string;
    apiVersion: string;
    pathParams: Record<string, string>;
    queryParams: Record<string, string | string[] | undefined>;
    body: Record<string, unknown> | undefined;
    operation: unknown;
    resolvedEntities: Record<string, Record<string, unknown>>;
  },
  statusCode: number,
  body: unknown,
) {
  return {
    statusCode,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: validationResult.body,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body },
  };
}

interface SubmissionResponse {
  sku: string;
  status: "ACCEPTED" | "INVALID";
  submissionId: string;
  issues: ListingIssue[];
}

function submissionResponse(sku: string, status: "ACCEPTED" | "INVALID", issues: ListingIssue[] = []): SubmissionResponse {
  return { sku, status, submissionId: randomUUID().replace(/-/g, ""), issues };
}

/** Generates a plausible, deterministic-format ASIN for newly created products. */
function generateAsin(): string {
  return "B0" + randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Error body for a PUT that cannot be validated against production. */
function upstreamErrorBody(code: string, message: string) {
  return { errors: [{ code, message }] };
}

// --- getListingsItem ---

export const getListingsItemHandler: OperationHandler = (validationResult) => {
  const doc = asListingDoc(validationResult.resolvedEntities.listing);
  const includedData = parseIncludedData(validationResult.queryParams);
  const marketplaceId = firstMarketplaceId(validationResult.queryParams);

  return Promise.resolve(buildContext(validationResult, 200, buildItemResponse(doc, includedData, marketplaceId)));
};

// --- putListingsItem ---

interface PutRequestBody {
  productType: string;
  requirements?: string;
  attributes: Record<string, unknown>;
}

export const putListingsItemHandler: OperationHandler = async (validationResult, request) => {
  const sku = validationResult.pathParams.sku;
  const sellerId = validationResult.pathParams.sellerId;
  const body = request.body as PutRequestBody;
  const now = new Date().toISOString();
  const marketplaceId = firstMarketplaceId(validationResult.queryParams);

  // Synchronous validation is production's answer, never a local imitation.
  const preview = await runValidationPreview(request);
  switch (preview.outcome) {
    case "NO_CREDENTIALS":
      return buildContext(
        validationResult,
        403,
        upstreamErrorBody(
          "Unauthorized",
          "putListingsItem requires a valid 'x-amz-access-token': the sandbox validates submissions against the real Listings Items API.",
        ),
      );
    case "UNAVAILABLE":
      return buildContext(
        validationResult,
        502,
        upstreamErrorBody("BadGateway", `Could not validate the submission against the Listings Items API (${preview.detail}).`),
      );
    case "INVALID":
      // Rejected synchronously: nothing is created, as in production.
      return buildContext(validationResult, 200, { ...submissionResponse(sku, "INVALID"), issues: preview.issues });
    case "VALID":
      break;
  }

  const key = listingKey(sellerId, sku);
  const existingRecord = Context.instance.engine.get(Api.LISTINGS, key);
  const existing = existingRecord ? asListingDoc(existingRecord) : undefined;

  const attributes = applySellerPutSemantics(existing?.attributes, body.attributes);
  const suggestedAsin = (attributes.merchant_suggested_asin as { value?: string }[] | undefined)?.[0]?.value;

  // Submitting fulfillment_availability quantities resets the live MFN
  // ledger (restock semantics). Omitting it keeps the current ledger.
  const submittedFulfillment = body.attributes.fulfillment_availability !== undefined;
  const mfnAvailability = submittedFulfillment ? ledgerFromFulfillmentAttribute(attributes) : (existing?.mfnAvailability ?? []);

  const doc: ListingDoc = {
    _key: key,
    sku,
    sellerId,
    productType: body.productType,
    requirements: body.requirements,
    marketplaceId,
    attributes,
    // The preview answer covers the whole new submission, so it replaces the
    // previous validation issues. The trigger reconciles its own codes.
    issues: preview.issues,
    // Seller-suggested match target, previously resolved identity, or a new
    // ASIN for a product Amazon does not know yet.
    asin: suggestedAsin ?? existing?.asin ?? generateAsin(),
    mfnAvailability,
    createdDate: existing?.createdDate ?? now,
    lastUpdatedDate: now,
  };

  Context.instance.engine.put(Api.LISTINGS, key, doc as unknown as Record<string, unknown>);

  return buildContext(validationResult, 200, submissionResponse(sku, "ACCEPTED"));
};

// --- patchListingsItem ---

interface PatchRequestBody {
  productType: string;
  patches: ListingsPatchOperation[];
}

/**
 * Patch is an upsert: production creates the SKU when it does not exist yet,
 * so an unknown SKU is not a 404 here either. Patches are not sent to
 * production for validation — the same submission can draw different issues
 * from a real account, so patch results would not be reproducible.
 */
export const patchListingsItemHandler: OperationHandler = (validationResult, request) => {
  const sku = validationResult.pathParams.sku;
  const sellerId = validationResult.pathParams.sellerId;
  const now = new Date().toISOString();
  const marketplaceId = firstMarketplaceId(validationResult.queryParams);
  const body = request.body as PatchRequestBody;

  // A vendor may add or replace attribute values but not delete them. This is
  // per-operation rather than per-request, so it cannot be a modeRestriction
  // rule, which resolves one named parameter.
  if (CURRENT_MODE !== "Seller" && body.patches.some((p) => p.op === "delete")) {
    const issue: ListingIssue = {
      code: ISSUE_CODE_INVALID_VALUE,
      message: "The 'delete' patch operation is not supported for vendors. Use 'add' or 'replace' to change attribute values.",
      severity: "ERROR",
      categories: ["INVALID_ATTRIBUTE"],
    };
    return Promise.resolve(buildContext(validationResult, 200, { ...submissionResponse(sku, "INVALID"), issues: [issue] }));
  }

  // Keyed by seller and SKU, so the upsert lands on this seller's listing
  // rather than on a different seller's listing that reuses the SKU.
  const key = listingKey(sellerId, sku);
  const existingRecord = Context.instance.engine.get(Api.LISTINGS, key);
  const existing: ListingDoc = existingRecord
    ? asListingDoc(existingRecord)
    : {
        _key: key,
        sku,
        sellerId,
        productType: body.productType,
        marketplaceId,
        attributes: {},
        issues: [],
        mfnAvailability: [],
        createdDate: now,
        lastUpdatedDate: now,
      };

  const patchResult = applyPatches(existing.attributes, body.patches);
  if (!patchResult.ok) {
    // Structural patch rejection: HTTP 200 with status INVALID + issues,
    // matching production put/patch response semantics.
    return Promise.resolve(buildContext(validationResult, 200, { ...submissionResponse(sku, "INVALID"), issues: patchResult.issues }));
  }

  // Any patch touching fulfillment_availability resets the affected
  // channels' live quantities (restock semantics).
  const touchedFulfillment = body.patches.some((p) => p.path.includes("fulfillment_availability"));
  const mfnAvailability = touchedFulfillment ? ledgerFromFulfillmentAttribute(patchResult.attributes) : existing.mfnAvailability;

  const suggestedAsin = (patchResult.attributes.merchant_suggested_asin as { value?: string }[] | undefined)?.[0]?.value;

  const doc: ListingDoc = {
    ...existing,
    attributes: patchResult.attributes,
    mfnAvailability,
    asin: suggestedAsin ?? existing.asin ?? generateAsin(),
    lastUpdatedDate: now,
  };

  Context.instance.engine.put(Api.LISTINGS, key, doc as unknown as Record<string, unknown>);

  return Promise.resolve(buildContext(validationResult, 200, submissionResponse(sku, "ACCEPTED")));
};

// --- deleteListingsItem ---

export const deleteListingsItemHandler: OperationHandler = async (validationResult) => {
  const sku = validationResult.pathParams.sku;
  // engine.remove emits the DELETE data event itself.
  await Context.instance.engine.remove(Api.LISTINGS, listingKey(validationResult.pathParams.sellerId, sku));

  return buildContext(validationResult, 200, submissionResponse(sku, "ACCEPTED"));
};

// --- searchListingsItems ---

/** Production caps search results at 1000 across all pages. */
const SEARCH_RESULT_CAP = 1000;

const listingsPaginator = new Paginator({ defaultPageSize: 10, maxPageSize: 20 });

function matchesIdentifiers(doc: ListingDoc, identifiers: string[], identifiersType: string): boolean {
  switch (identifiersType) {
    case "SKU":
      return identifiers.includes(doc.sku);
    case "ASIN":
      return doc.asin !== undefined && identifiers.includes(doc.asin);
    default: {
      // EAN, UPC, GTIN, ISBN, JAN, MINSAN, FNSKU — match against
      // externally_assigned_product_identifier instances.
      const instances = doc.attributes.externally_assigned_product_identifier;
      if (!Array.isArray(instances)) return false;
      return (instances as { value?: unknown }[]).some((inst) => typeof inst.value === "string" && identifiers.includes(inst.value));
    }
  }
}

function withinDateRange(value: string, after?: string, before?: string): boolean {
  if (after && value < after) return false;
  if (before && value > before) return false;
  return true;
}

export const searchListingsItemsHandler: OperationHandler = (validationResult) => {
  const qp = validationResult.queryParams;
  const marketplaceId = firstMarketplaceId(qp);
  const now = new Date();

  const identifiers = parseArrayParam(qp.identifiers);
  // Guaranteed present alongside identifiers by the requiredTogether rule.
  const identifiersType = (qp.identifiersType as string | undefined) ?? "SKU";
  const variationParentSku = qp.variationParentSku as string | undefined;
  const packageHierarchySku = qp.packageHierarchySku as string | undefined;
  const withStatus = parseArrayParam(qp.withStatus);
  const withoutStatus = parseArrayParam(qp.withoutStatus);
  const withIssueSeverity = parseArrayParam(qp.withIssueSeverity);
  const createdAfter = qp.createdAfter as string | undefined;
  const createdBefore = qp.createdBefore as string | undefined;
  const lastUpdatedAfter = qp.lastUpdatedAfter as string | undefined;
  const lastUpdatedBefore = qp.lastUpdatedBefore as string | undefined;

  // Filtered to the selling partner in the path, so a search only ever lists
  // that seller's own listings.
  let docs = Context.instance.engine.find(Api.LISTINGS, { sellerId: validationResult.pathParams.sellerId }).map(asListingDoc);

  if (identifiers) docs = docs.filter((d) => matchesIdentifiers(d, identifiers, identifiersType));

  // Relationship filters. Mutually exclusive with each other and with
  // identifiers, enforced by the atMostOneAllowed rule.
  if (variationParentSku) {
    docs = docs.filter((d) => declaredParentSkus(d.attributes).includes(variationParentSku));
  }
  if (packageHierarchySku) {
    // "contain or are contained by": a listing qualifies if it names the
    // anchor among its contents, or the anchor names it among its own. The
    // anchor itself does neither, so it is not in its own results.
    const anchor = Context.instance.engine.get(Api.LISTINGS, listingKey(validationResult.pathParams.sellerId, packageHierarchySku));
    const anchorContains = anchor ? declaredContainedSkus(asListingDoc(anchor).attributes) : [];
    docs = docs.filter((d) => declaredContainedSkus(d.attributes).includes(packageHierarchySku) || anchorContains.includes(d.sku));
  }
  docs = docs.filter((d) => withinDateRange(d.createdDate, createdAfter, createdBefore));
  docs = docs.filter((d) => withinDateRange(d.lastUpdatedDate, lastUpdatedAfter, lastUpdatedBefore));

  if (withStatus || withoutStatus) {
    docs = docs.filter((d) => {
      const status = new Set(deriveStatus(d, now));
      if (withStatus?.every((s) => status.has(s)) === false) return false;
      if (withoutStatus?.some((s) => status.has(s)) === true) return false;
      return true;
    });
  }

  if (withIssueSeverity) {
    docs = docs.filter((d) => d.issues.some((i) => withIssueSeverity.includes(i.severity)));
  }

  // Sort: sku | createdDate | lastUpdatedDate (default lastUpdatedDate DESC).
  const sortBy = (qp.sortBy as string | undefined) ?? "lastUpdatedDate";
  const sortOrder = (qp.sortOrder as string | undefined) ?? "DESC";
  const sortValue = (d: ListingDoc): string => (sortBy === "sku" ? d.sku : sortBy === "createdDate" ? d.createdDate : d.lastUpdatedDate);
  docs.sort((a, b) => (sortOrder === "ASC" ? sortValue(a).localeCompare(sortValue(b)) : sortValue(b).localeCompare(sortValue(a))));

  // Cap at 1000 results across all pages, per production behavior.
  docs = docs.slice(0, SEARCH_RESULT_CAP);

  // Pagination (pageSize default 10, max 20; base64 offset tokens).
  const paginationResult = listingsPaginator.paginate(docs, { pageSize: qp.pageSize as string | undefined, pageToken: qp.pageToken as string | undefined });

  const includedData = parseIncludedData(qp);
  const items = paginationResult.page.map((d) => buildItemResponse(d, includedData, marketplaceId, now));

  const pagination: Record<string, string> = {};
  if (paginationResult.nextToken) pagination.nextToken = paginationResult.nextToken;
  if (paginationResult.previousToken) pagination.previousToken = paginationResult.previousToken;

  const responseBody: Record<string, unknown> = { numberOfResults: paginationResult.numberOfResults, items };
  if (Object.keys(pagination).length > 0) responseBody.pagination = pagination;

  return Promise.resolve(buildContext(validationResult, 200, responseBody));
};
