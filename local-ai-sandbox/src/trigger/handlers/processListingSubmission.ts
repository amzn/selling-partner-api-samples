/**
 * Catalog matching — the sandbox analogue of the downstream processing
 * production runs asynchronously after a submission passes validation:
 *
 *  - Full submission not yet in the catalog: create the catalog item.
 *  - Offer-only matching a catalog item: nothing to do.
 *  - Offer-only matching nothing: report a matching issue. The sandbox catalog
 *    is the only authority, so an offer against a real production ASIN the
 *    sandbox was never told about is still unmatched; seed it via /chat.
 *
 * Listing attributes are never modified, so a read returns only what the
 * seller submitted. Issues are reconciled against OWNED_CODES rather than
 * appended, which keeps this idempotent and unable to disturb validation
 * issues. Writes are silent, so they cannot re-enter the trigger.
 *
 * Re-runs on listing writes only: a later catalog change does not re-evaluate
 * matching (see the spec's scheduled-reconciliation follow-up).
 */
import { DataEvent } from "../DataEvent.js";
import { Api, Context } from "../../database/Context.js";
import {
  asListingDoc,
  ISSUE_CODE_ASIN_MISMATCH,
  ISSUE_CODE_UNMATCHABLE,
  SALES_TERM_ATTRIBUTES,
  type ListingDoc,
  type ListingIssue,
} from "../../operation/listingsItemModel.js";

/** Every issue code this handler owns. Nothing else may be emitted here. */
const OWNED_CODES = new Set<string>([ISSUE_CODE_ASIN_MISMATCH, ISSUE_CODE_UNMATCHABLE]);

// --- Catalog matching ---

/** External product identifier values (EAN/UPC/GTIN/...) on a submission. */
function externalIdentifiers(attributes: Record<string, unknown>): { type?: unknown; value?: unknown }[] {
  const instances = attributes.externally_assigned_product_identifier;
  return Array.isArray(instances) ? (instances as { type?: unknown; value?: unknown }[]) : [];
}

/** Finds a catalog item whose identifiers include one of the given values. */
function findByIdentifier(values: string[]): Record<string, unknown> | undefined {
  if (values.length === 0) return undefined;

  for (const item of Context.instance.engine.find(Api.CATALOG, {})) {
    const groups = item.identifiers;
    if (!Array.isArray(groups)) continue;
    const matched = (groups as { identifiers?: { identifier?: unknown }[] }[]).some((group) =>
      (group.identifiers ?? []).some((id) => typeof id.identifier === "string" && values.includes(id.identifier)),
    );
    if (matched) return item;
  }
  return undefined;
}

/** The catalog item a submission resolves to, by ASIN or external identifier. */
function matchCatalogItem(doc: ListingDoc): Record<string, unknown> | undefined {
  const byAsin = doc.asin ? Context.instance.engine.get(Api.CATALOG, doc.asin) : null;
  if (byAsin) return byAsin;

  const values = externalIdentifiers(doc.attributes)
    .map((inst) => inst.value)
    .filter((value): value is string => typeof value === "string");
  return findByIdentifier(values);
}

/**
 * Creates a catalog item for a net-new ASIN from the submission's product
 * facts. The keys match the Catalog Items `includedData` categories, so
 * getCatalogItem and searchCatalogItems serve the item as-is. Sales terms
 * belong to the seller's offer, not to the shared catalog item, so they are
 * left out.
 */
function createCatalogItem(doc: ListingDoc, asin: string): void {
  const attributes = Object.fromEntries(Object.entries(doc.attributes).filter(([name]) => !SALES_TERM_ATTRIBUTES.has(name)));

  const firstValue = (name: string): unknown => (doc.attributes[name] as { value?: unknown }[] | undefined)?.[0]?.value;
  const itemName = firstValue("item_name");
  const brand = firstValue("brand");

  const summary: Record<string, unknown> = { marketplaceId: doc.marketplaceId };
  if (typeof itemName === "string") summary.itemName = itemName;
  if (typeof brand === "string") summary.brand = brand;

  const identifiers = externalIdentifiers(doc.attributes).flatMap((inst) =>
    typeof inst.value === "string"
      ? [{ identifierType: (typeof inst.type === "string" ? inst.type : "UPC").toUpperCase(), identifier: inst.value }]
      : [],
  );

  Context.instance.engine.put(Api.CATALOG, asin, {
    asin,
    attributes,
    productTypes: [{ marketplaceId: doc.marketplaceId, productType: doc.productType }],
    summaries: [summary],
    ...(identifiers.length > 0 ? { identifiers: [{ marketplaceId: doc.marketplaceId, identifiers }] } : {}),
  });
  console.info(`[Trigger] Created catalog item ${asin} (${doc.productType}) for listing ${doc.sku} (${doc.sellerId})`);
}

/**
 * Issue for an offer-only submission that matched nothing: production
 * distinguishes a suggested ASIN that does not match (4005015) from a
 * submission it cannot match or create at all (8560).
 */
function matchingIssue(doc: ListingDoc): ListingIssue {
  const suggestedAsin = (doc.attributes.merchant_suggested_asin as { value?: string }[] | undefined)?.[0]?.value;

  if (suggestedAsin) {
    return {
      code: ISSUE_CODE_ASIN_MISMATCH,
      message: `The ASIN provided ('${suggestedAsin}') does not match the existing item in the Amazon catalog.`,
      severity: "ERROR",
      attributeNames: ["merchant_suggested_asin"],
      categories: ["INVALID_ATTRIBUTE"],
    };
  }

  return {
    code: ISSUE_CODE_UNMATCHABLE,
    message:
      "Your product details are not complete enough to find a matching ASIN or create a new one. Check that your product identifiers are correct and that all required product information is included.",
    severity: "ERROR",
    attributeNames: ["product_type"],
    categories: ["INVALID_ATTRIBUTE", "MISSING_ATTRIBUTE"],
  };
}

/** Replaces this handler's owned issues with the ones that currently apply. */
function reconcileIssues(doc: ListingDoc, computed: ListingIssue[]): void {
  const preserved = doc.issues.filter((issue) => !OWNED_CODES.has(issue.code));
  const nextIssues = [...preserved, ...computed];
  if (JSON.stringify(nextIssues) === JSON.stringify(doc.issues)) return;

  const record = Context.instance.engine.get(Api.LISTINGS, doc._key);
  if (!record) return;
  Context.instance.engine.put(Api.LISTINGS, doc._key, { ...record, issues: nextIssues }, { silent: true });
  console.info(`[Trigger] Reconciled matching issues for listing ${doc.sku} (${doc.sellerId}): ${String(computed.length)} issue(s)`);
}

/** Trigger handler: runs catalog matching for the written listing. */
export function processListingSubmission(event: DataEvent): void {
  const record = Context.instance.engine.get(Api.LISTINGS, event.id);
  if (!record) return; // deleted between event and processing

  const doc = asListingDoc(record);
  const matched = matchCatalogItem(doc);

  if (doc.requirements === "LISTING_OFFER_ONLY") {
    reconcileIssues(doc, matched ? [] : [matchingIssue(doc)]);
    return;
  }

  // Full submission: the product is contributed to the catalog when the
  // sandbox does not hold it yet.
  reconcileIssues(doc, []);
  if (!matched && doc.asin) createCatalogItem(doc, doc.asin);
}
