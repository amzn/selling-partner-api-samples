/**
 * Listings Restrictions API v2021-08-01 — deterministic handler.
 *
 * Restrictions are seeded into the LISTINGS_RESTRICTIONS partition keyed
 * by ASIN, shaped like the spec's RestrictionList:
 *   { restrictions: [{ marketplaceId, conditionType?, reasons: [{ reasonCode, message, links? }] }] }
 *
 * Behavior:
 *  - ASIN unknown to the local catalog AND no seeded restrictions →
 *    ASIN_NOT_FOUND reason per requested marketplace (spec vocabulary).
 *  - Seeded restrictions are filtered by requested marketplaceIds and
 *    optional conditionType.
 *  - Otherwise → empty restrictions (no restrictions, eligible to list).
 */
import type { OperationHandler } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";

interface RestrictionReason {
  message?: string;
  reasonCode?: "APPROVAL_REQUIRED" | "ASIN_NOT_FOUND" | "NOT_ELIGIBLE";
  links?: { resource: string; verb: string; title?: string; type?: string }[];
}

interface Restriction {
  marketplaceId: string;
  conditionType?: string;
  reasons?: RestrictionReason[];
}

function parseMarketplaceIds(raw: string | string[] | undefined): string[] {
  const values = Array.isArray(raw) ? raw.flatMap((v) => v.split(",")) : (raw ?? "").split(",");
  return values.map((s) => s.trim()).filter((s) => s !== "");
}

/**
 * Looks up seeded restrictions for an ASIN, filtered by marketplaces and
 * optional condition type.
 */
function findRestrictions(asin: string, marketplaceIds: string[], conditionType?: string): Restriction[] {
  const record = Context.instance.engine.get(Api.LISTINGS_RESTRICTIONS, asin);
  const seeded = (record?.restrictions as Restriction[] | undefined) ?? [];

  return seeded.filter((r) => {
    if (marketplaceIds.length > 0 && !marketplaceIds.includes(r.marketplaceId)) return false;
    if (conditionType && r.conditionType && r.conditionType !== conditionType) return false;
    return true;
  });
}

export const getListingsRestrictionsHandler: OperationHandler = (validationResult) => {
  const qp = validationResult.queryParams;
  const rawAsin = qp.asin;
  const asin = Array.isArray(rawAsin) ? rawAsin[0] : (rawAsin ?? "");
  const conditionType = qp.conditionType as string | undefined;
  const marketplaceIds = parseMarketplaceIds(qp.marketplaceIds);

  let restrictions = findRestrictions(asin, marketplaceIds, conditionType);

  // Unknown ASIN with no seeded restrictions: answer with ASIN_NOT_FOUND.
  if (restrictions.length === 0 && !Context.instance.engine.get(Api.CATALOG, asin)) {
    restrictions = marketplaceIds.map((marketplaceId) => ({
      marketplaceId,
      reasons: [{ reasonCode: "ASIN_NOT_FOUND" as const, message: `The specified ASIN '${asin}' does not exist in the requested marketplace.` }],
    }));
  }

  return Promise.resolve({
    statusCode: 200,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation as unknown,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: { restrictions } },
  });
};
