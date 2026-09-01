/**
 * API registration policy — the single place that governs which models are imported,
 * how their display names / database namespaces are derived, and what is excluded.
 *
 * Consumed by both scripts/fetchModels.ts (copy stage) and
 * scripts/generateOperationRegistry.ts (extraction stage).
 */

export interface ApiMetadataOverride {
  /** Canonical display name, e.g. "Product Pricing". Must match the validation registry's apiName. */
  apiName?: string;
  /** Database partition key; must correspond to a member of the `Api` enum. */
  dbNamespace?: string;
  /** Overrides the model file path returned by the resource-retrieval tool (Listings → Product Type Definition). */
  resourcePath?: string;
}

/**
 * Per-model overrides, ONLY for models where the derived apiName/dbNamespace would be wrong.
 * `apiVersion` always comes from the model's `info.version`. A model with correct derivation needs
 * no entry (e.g. Orders and Reports derive correctly and are intentionally absent here).
 *
 * Two reasons an override is needed:
 *  - dbNamespace: the `Api` enum uses abbreviated partition keys (`catalog`, `inventory`,
 *    `extFulfillment*`) that the display-name slug cannot produce (`catalogItems`, `fbaInventory`,
 *    `externalFulfillment*`).
 *  - apiName: a couple of titles don't match the canonical name — "Pricing" -> "Product Pricing",
 *    "…Return Item" -> "External Fulfillment Returns". Listings also needs a resourcePath override.
 */
export const API_METADATA_OVERRIDES: Record<string, ApiMetadataOverride> = {
  "listingsItems_2021-08-01.json": { apiName: "Listings", dbNamespace: "listings", resourcePath: "./res/pt-definitions/PRODUCT.json" },
  "catalogItems_2022-04-01.json": { apiName: "Catalog Items", dbNamespace: "catalog" },
  "productPricing_2022-05-01.json": { apiName: "Product Pricing", dbNamespace: "pricing" },
  "fbaInventory.json": { apiName: "FBA Inventory", dbNamespace: "inventory" },
  "externalFulfillmentInventory_2024-09-11.json": { apiName: "External Fulfillment Inventory", dbNamespace: "extFulfillmentInventory" },
  "externalFulfillmentReturns_2024-09-11.json": { apiName: "External Fulfillment Returns", dbNamespace: "extFulfillmentReturns" },
  "externalFulfillmentShipments_2024-09-11.json": { apiName: "External Fulfillment Shipments", dbNamespace: "extFulfillmentShipments" },
};

export interface ExcludeListEntry {
  apiName?: string;
  apiVersion?: string;
  modelFile?: string;
  /**
   * When present, only these operationIds are excluded (the rest of the model is still registered).
   * When absent, the whole matching model/API is excluded.
   */
  operationIds?: string[];
  reason: string;
}

/**
 * APIs (or specific operations) excluded from the registry. A rule matches on any combination of
 * apiName/apiVersion/modelFile that is present. Deprecated operations (schema `deprecated: true`)
 * are dropped automatically by the generator and do not need an entry here.
 */
export const EXCLUDE_LIST: ExcludeListEntry[] = [
  // NOTE: ordersV0.json is intentionally NOT excluded — it hosts the live confirmShipment
  // operation (absent from Orders 2026-01-01).
  { apiName: "Catalog Items", apiVersion: "v0", reason: "Superseded by Catalog Items 2022-04-01." },
  { apiName: "Catalog Items", apiVersion: "2020-12-01", reason: "Superseded by Catalog Items 2022-04-01." },
  { modelFile: "listingsItems_2020-09-01.json", reason: "Superseded by Listings Items 2021-08-01." },
  { apiName: "Fulfillment By Amazon (Small and Light)", reason: "Deprecated program." },
  { modelFile: "productPricingV0.json", reason: "Superseded by Product Pricing 2022-05-01." },
];

/**
 * Upstream model folders (in amzn/selling-partner-api-models `models/`) eligible for the fetch
 * script to copy. This is a temporary guard so we don't import the entire SP-API surface before we
 * have handlers for it. Leave it EMPTY to import everything (minus the exclude list) — the intended
 * end state as coverage approaches full parity, at which point the exclude list is the only gate.
 */
export const ALLOWLIST: string[] = [
  "orders-api-model",
  "listings-items-api-model",
  "catalog-items-api-model",
  "product-pricing-api-model",
  "fba-inventory-api-model",
  "external-fulfillment-inventory-api-model",
  "external-fulfillment-returns-api-model",
  "external-fulfillment-shipments-api-model",
  "reports-api-model",
  "product-type-definitions-api-model",
  "listings-restrictions-api-model",
  "notifications-api-model",
  "data-kiosk-api-model",
];

/** Facts an exclude-list rule can match against. */
export interface ApiIdentity {
  apiName?: string;
  apiVersion?: string;
  modelFile?: string;
}

/** Whether a rule's identity fields match the given API. Requires at least one identity field so a reason-only rule matches nothing. */
function matchesIdentity(rule: ExcludeListEntry, identity: ApiIdentity): boolean {
  const hasIdentityField = rule.modelFile !== undefined || rule.apiName !== undefined || rule.apiVersion !== undefined;
  return (
    hasIdentityField &&
    (rule.modelFile === undefined || rule.modelFile === identity.modelFile) &&
    (rule.apiName === undefined || rule.apiName === identity.apiName) &&
    (rule.apiVersion === undefined || rule.apiVersion === identity.apiVersion)
  );
}

/** True if the whole model/API is excluded (a matching rule that is not scoped to specific operations). */
export function isExcluded(identity: ApiIdentity): boolean {
  return EXCLUDE_LIST.some((rule) => matchesIdentity(rule, identity) && rule.operationIds === undefined);
}

/** True if this specific operation is excluded (a matching rule scoped to operationIds that includes it). */
export function isOperationExcluded(identity: ApiIdentity, operationId: string): boolean {
  return EXCLUDE_LIST.some((rule) => matchesIdentity(rule, identity) && rule.operationIds?.includes(operationId) === true);
}

/** Safe lookup for a model's overrides (Record index does not model the missing-key case without noUncheckedIndexedAccess). */
export function overrideFor(modelFile: string): ApiMetadataOverride | undefined {
  return Object.prototype.hasOwnProperty.call(API_METADATA_OVERRIDES, modelFile) ? API_METADATA_OVERRIDES[modelFile] : undefined;
}

/**
 * Fallback display name for a model with no override: strip common SP-API title boilerplate.
 * e.g. "The Selling Partner API for Amazon External Fulfillment Shipments Processing" → "External Fulfillment Shipments".
 */
export function deriveApiName(title: string | undefined, modelFile: string): string {
  const override = overrideFor(modelFile)?.apiName;
  if (override) return override;
  if (!title) return modelFile.replace(/\.json$/, "");
  return (
    title
      .replace(/^The\s+/i, "")
      .replace(/Selling Partner API for\s+/i, "")
      .replace(/^Amazon\s+/i, "")
      .replace(/\s+(Processing|Management)$/i, "")
      .trim() || modelFile.replace(/\.json$/, "")
  );
}

/** Fallback database namespace for a model with no override: lowerCamel slug of the display name. */
export function deriveDbNamespace(apiName: string, modelFile: string): string {
  const override = overrideFor(modelFile)?.dbNamespace;
  if (override) return override;
  const words = apiName.split(/\s+/).filter(Boolean);
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}
