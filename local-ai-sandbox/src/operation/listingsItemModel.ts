/**
 * Listings Item data model — stored document shape, derivation rules, and
 * patch/merge semantics for the Listings Items API v2021-08-01.
 *
 * Two-layer model:
 *  - `attributes` is the raw seller submission, mutated only by put/patch —
 *    never by triggers, so a read returns exactly what was submitted.
 *  - System data is STORED (issues, mfnAvailability, asin, dates) or DERIVED
 *    at read time (summaries, status, offers, fulfillmentAvailability,
 *    procurement, relationships). Deriving avoids the two layers drifting
 *    apart. Every derivation reads one document except `relationships`, where
 *    half of each relationship is recorded on the listing at the other end.
 */
import { Api, Context } from "../database/Context.js";
import { buildEntityKey } from "../database/types.js";

/**
 * Primary key of a listing. A SKU is unique per seller, so both parts are
 * required; every access to the listings partition goes through this, or two
 * sellers sharing a SKU collide on one record. Identity, not access control —
 * the sandbox authenticates nobody.
 */
export function listingKey(sellerId: string, sku: string): string {
  return buildEntityKey([sellerId, sku]);
}

// --- Types ---

export interface ListingIssue {
  code: string;
  message: string;
  severity: "ERROR" | "WARNING" | "INFO";
  attributeNames?: string[];
  categories: string[];
  enforcements?: { actions: { action: string }[]; exemption?: { status: string } };
}

export interface MfnAvailabilityEntry {
  fulfillmentChannelCode: string;
  quantity: number;
}

/**
 * A `fulfillmentAvailability` entry as reported to the caller. `quantity` is
 * absent for an FBA channel, which Amazon manages and does not echo back.
 */
export interface FulfillmentAvailabilityEntry {
  fulfillmentChannelCode: string;
  quantity?: number;
}

/**
 * The stored listing document (DB layer).
 *
 * `_key` is the composite primary key (seller + SKU), because a SKU is only
 * unique within one seller — two sellers routinely use the same SKU, and
 * keying by SKU alone would make them collide on a single record. Use
 * `listingKey()` to build it, and `sku` (never `_key`) whenever the seller's
 * own identifier is what is meant.
 */
export interface ListingDoc {
  _key: string;
  sku: string;
  sellerId: string;
  productType: string;
  requirements?: string;
  /** Amazon store the submission was made against. */
  marketplaceId: string;
  attributes: Record<string, unknown>;
  /** System-managed: set from validation results, never seller-submitted. */
  issues: ListingIssue[];
  /** Resolved (offer-only) or generated (new product) catalog identity. */
  asin?: string;
  /**
   * Live MFN inventory ledger. Seeded/reset when the seller submits
   * fulfillment_availability quantities; reduced by order triggers.
   * FBA quantities live in the FBA inventory partition, never here.
   */
  mfnAvailability: MfnAvailabilityEntry[];
  createdDate: string;
  lastUpdatedDate: string;
}

// --- Constants ---

/**
 * Sales-term (offer) attributes, from the "offer" property group of the
 * PRODUCT-rooted product type definitions. Seller PUT semantics: product
 * facts are REPLACED, but sales terms are MERGED — omitting a sales-term
 * attribute does NOT remove previously submitted values.
 * (Building Listings Management Workflows Guide, "Update a listing".)
 */
export const SALES_TERM_ATTRIBUTES = new Set([
  "purchasable_offer",
  "fulfillment_availability",
  "condition_type",
  "condition_note",
  "list_price",
  "product_tax_code",
  "merchant_release_date",
  "merchant_shipping_group",
  "max_order_quantity",
  "gift_options",
]);

/**
 * Patch `merge` is only supported for these attributes, keyed by their
 * selector fields. Merge on any other attribute is rejected (sync INVALID).
 * (Merge a listing + Manage purchasable offer docs.)
 */
const MERGEABLE_ATTRIBUTE_SELECTORS: Record<string, string[] | undefined> = {
  fulfillment_availability: ["fulfillment_channel_code"],
  purchasable_offer: ["marketplace_id", "currency", "audience"],
};

/**
 * Selector fields across listings attributes. An attribute instance is
 * addressed by whichever of these it carries, which is what makes
 * add/replace/delete operate on a single instance rather than on the whole
 * attribute.
 */
const SELECTOR_FIELDS = new Set(["marketplace_id", "language_tag", "currency", "audience", "fulfillment_channel_code"]);

/** Sub-attribute that can never be deleted via merge-null. */
const NON_NULLABLE_MERGE_FIELDS = new Set(["our_price"]);

/**
 * Reported when a submission names an ASIN that does not match a catalog
 * item. Publicly documented in the Listings Items API issues
 * troubleshooting guide.
 */
export const ISSUE_CODE_ASIN_MISMATCH = "4005015";

/**
 * Reported when a submission cannot be matched to an existing ASIN and
 * carries too little product data to create a new one. Publicly documented
 * and observed on asynchronous processing of a sparse submission.
 */
export const ISSUE_CODE_UNMATCHABLE = "8560";

/** Generic "provided value is invalid" code from the troubleshooting guide. */
export const ISSUE_CODE_INVALID_VALUE = "4000001";

type AttrInstance = Record<string, unknown>;

/** Safe string coercion for unknown values (avoids '[object Object]'). */
function asString(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

/** Reads the first instance's `value` (or given field) of a listings attribute. */
function firstAttrValue(attributes: Record<string, unknown>, name: string, field = "value"): unknown {
  const instances = attributes[name];
  if (!Array.isArray(instances) || instances.length === 0) return undefined;
  const first = instances[0] as AttrInstance;
  return first[field];
}

// --- Seller PUT attribute semantics ---

/**
 * Computes the final attributes for a PUT submission.
 * Product facts: full replacement (omitted => dropped).
 * Sales terms: attribute-level merge (omitted => previous value retained;
 * provided => replaced).
 */
export function applySellerPutSemantics(
  previousAttributes: Record<string, unknown> | undefined,
  submittedAttributes: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...submittedAttributes };
  if (!previousAttributes) return result;

  // Only sales terms are retained when omitted.
  for (const [name, value] of Object.entries(previousAttributes)) {
    if (result[name] === undefined && SALES_TERM_ATTRIBUTES.has(name)) {
      result[name] = value;
    }
  }
  return result;
}

// --- Patch operations ---

export interface ListingsPatchOperation {
  op: "add" | "replace" | "merge" | "delete";
  path: string;
  value?: unknown[];
}

export interface PatchApplicationResult {
  ok: boolean;
  attributes: Record<string, unknown>;
  /** Populated when ok=false: sync issues to return with status INVALID. */
  issues: ListingIssue[];
}

/** Extracts the attribute name from a JSON Pointer path like "/attributes/item_name". */
function attributeNameFromPath(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] === "attributes") return parts[1];
  if (parts.length === 1) return parts[0];
  return null; // deeper pointers unsupported: "patching content within attributes is not supported"
}

function invalidPatch(message: string, attributeName?: string): ListingIssue {
  return {
    code: ISSUE_CODE_INVALID_VALUE,
    message,
    severity: "ERROR",
    categories: ["INVALID_ATTRIBUTE"],
    ...(attributeName ? { attributeNames: [attributeName] } : {}),
  };
}

/** True when every selector field present on `candidate` matches `existing`. */
function selectorsMatch(existing: AttrInstance, candidate: AttrInstance, selectors: string[]): boolean {
  return selectors.every((sel) => candidate[sel] === undefined || existing[sel] === candidate[sel]);
}

/** Selector fields carried by an attribute instance. */
function selectorsOf(instance: AttrInstance): string[] {
  return Object.keys(instance).filter((field) => SELECTOR_FIELDS.has(field));
}

/**
 * Applies an add/replace to a single attribute.
 *
 * When the submitted instances carry selector fields, each one replaces the
 * matching existing instance wholesale — sub-attributes omitted from the
 * submitted instance are dropped from it (that is the difference from
 * `merge`), but instances the patch does not address are left untouched.
 * Instances matching nothing are appended. With no selectors to address an
 * instance by, the whole attribute is replaced.
 */
function applyReplace(existing: unknown, submitted: unknown[] | undefined): unknown {
  if (!Array.isArray(existing) || submitted === undefined) return submitted;

  const instances = [...(existing as AttrInstance[])];
  let addressedAny = false;

  for (const candidate of submitted as AttrInstance[]) {
    const selectors = selectorsOf(candidate);
    if (selectors.length === 0) continue;
    addressedAny = true;
    const index = instances.findIndex((inst) => selectorsMatch(inst, candidate, selectors));
    if (index === -1) {
      instances.push(candidate);
    } else {
      instances[index] = candidate;
    }
  }

  return addressedAny ? instances : submitted;
}

/**
 * Applies JSON Patch operations to the attributes layer, honoring
 * production semantics:
 *  - add / replace: replaces the selector-addressed instances, or the whole
 *    attribute when the value carries no selectors.
 *  - delete: with a value, removes the instances matching the provided
 *    selector objects; without a value, removes the whole attribute.
 *  - merge: only for fulfillment_availability and purchasable_offer.
 *    Selector-keyed instance merge that preserves omitted sub-attributes;
 *    explicit null deletes a field (except our_price); unmatched selector
 *    instances are appended.
 *
 * Returns a new attributes object; never mutates the input.
 */
export function applyPatches(attributes: Record<string, unknown>, patches: ListingsPatchOperation[]): PatchApplicationResult {
  const result: Record<string, unknown> = structuredClone(attributes);

  for (const patch of patches) {
    const attrName = attributeNameFromPath(patch.path);
    if (!attrName) {
      return {
        ok: false,
        attributes,
        issues: [invalidPatch(`Unsupported patch path '${patch.path}'. Patching content within attributes is not supported.`)],
      };
    }

    switch (patch.op) {
      case "add":
      case "replace":
        result[attrName] = applyReplace(result[attrName], patch.value);
        break;

      case "delete": {
        const existing = result[attrName];
        if (!Array.isArray(patch.value) || patch.value.length === 0 || !Array.isArray(existing)) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete result[attrName];
          break;
        }
        const selectors = MERGEABLE_ATTRIBUTE_SELECTORS[attrName] ?? Object.keys(patch.value[0] as AttrInstance);
        const remaining = (existing as AttrInstance[]).filter(
          (inst) => !(patch.value as AttrInstance[]).some((sel) => selectorsMatch(inst, sel, selectors)),
        );
        if (remaining.length === 0) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete result[attrName];
        } else {
          result[attrName] = remaining;
        }
        break;
      }

      case "merge": {
        const selectors = MERGEABLE_ATTRIBUTE_SELECTORS[attrName];
        if (!selectors) {
          return {
            ok: false,
            attributes,
            issues: [
              invalidPatch(
                `The 'merge' operation is only supported for ${Object.keys(MERGEABLE_ATTRIBUTE_SELECTORS).join(", ")}. Attribute '${attrName}' is not supported.`,
                attrName,
              ),
            ],
          };
        }
        if (!Array.isArray(patch.value)) {
          return {
            ok: false,
            attributes,
            issues: [invalidPatch(`The 'merge' operation for '${attrName}' requires a value array with selector fields.`, attrName)],
          };
        }

        const instances = Array.isArray(result[attrName]) ? (result[attrName] as AttrInstance[]) : [];
        for (const mergeValue of patch.value as AttrInstance[]) {
          const target = instances.find((inst) => selectorsMatch(inst, mergeValue, selectors));
          if (!target) {
            // No matching instance: append (strip explicit nulls).
            const appended = Object.fromEntries(Object.entries(mergeValue).filter(([, v]) => v !== null));
            instances.push(appended);
            continue;
          }
          for (const [field, value] of Object.entries(mergeValue)) {
            if (selectors.includes(field)) continue;
            if (value === null) {
              if (NON_NULLABLE_MERGE_FIELDS.has(field)) {
                return {
                  ok: false,
                  attributes,
                  issues: [
                    invalidPatch(`The '${field}' sub-attribute cannot be deleted. Use the delete operation to remove the offer entirely.`, attrName),
                  ],
                };
              }
              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
              delete target[field];
            } else {
              target[field] = value;
            }
          }
        }
        result[attrName] = instances;
        break;
      }
    }
  }

  return { ok: true, attributes: result, issues: [] };
}

// --- MFN ledger sync ---

/**
 * Rebuilds the live MFN ledger from a submitted fulfillment_availability
 * attribute. Submitting a quantity SETS the live quantity (restock
 * semantics); channels without a quantity (FBA enablement rows like
 * AMAZON_NA) never enter the MFN ledger.
 */
export function ledgerFromFulfillmentAttribute(attributes: Record<string, unknown>): MfnAvailabilityEntry[] {
  const instances = attributes.fulfillment_availability;
  if (!Array.isArray(instances)) return [];
  const ledger: MfnAvailabilityEntry[] = [];
  for (const inst of instances as AttrInstance[]) {
    const channel = inst.fulfillment_channel_code;
    const quantity = inst.quantity;
    if (typeof channel === "string" && typeof quantity === "number") {
      ledger.push({ fulfillmentChannelCode: channel, quantity });
    }
  }
  return ledger;
}

// --- Derivations (read-time projections) ---

function hasEnforcement(issues: ListingIssue[], action: string): boolean {
  return issues.some((i) => i.severity === "ERROR" && i.enforcements?.actions.some((a) => a.action === action));
}

/**
 * Reads a date that may be submitted either bare or wrapped in `{ value }`.
 * Anything else — including `null`, which `typeof` reports as "object" — yields
 * undefined rather than throwing, since a read must not fail on data a write
 * accepted.
 */
function dateFieldValue(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null) {
    const value = (raw as { value?: unknown }).value;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

/** An offer schedule entry is active if now is within its optional start/end window. */
function scheduleActive(inst: AttrInstance, now: Date): boolean {
  const startStr = dateFieldValue(inst.start_at);
  const endStr = dateFieldValue(inst.end_at);
  if (startStr && new Date(startStr) > now) return false;
  if (endStr && new Date(endStr) < now) return false;
  return true;
}

/** Active purchasable_offer instances (having a price, within schedule). */
function activeOffers(attributes: Record<string, unknown>, now: Date): AttrInstance[] {
  const offers = attributes.purchasable_offer;
  if (!Array.isArray(offers)) return [];
  return (offers as AttrInstance[]).filter((o) => Array.isArray(o.our_price) && o.our_price.length > 0 && scheduleActive(o, now));
}

/** FBA (Amazon-fulfilled) channel codes declared in the attributes. */
function fbaChannels(attributes: Record<string, unknown>): string[] {
  const instances = attributes.fulfillment_availability;
  if (!Array.isArray(instances)) return [];
  return (instances as AttrInstance[])
    .map((inst) => inst.fulfillment_channel_code)
    .filter((code): code is string => typeof code === "string" && code.startsWith("AMAZON_"));
}

/** Fulfillable FBA quantity for this SKU, held in the inventory partition. */
function fbaQuantity(sku: string): number {
  const fba = Context.instance.engine.get(Api.INVENTORY, sku);
  return typeof fba?.fulfillableQuantity === "number" ? fba.fulfillableQuantity : 0;
}

/** Total quantity across the MFN ledger. */
function mfnQuantity(doc: ListingDoc): number {
  return doc.mfnAvailability.reduce((sum, e) => sum + e.quantity, 0);
}

/**
 * Live fulfillment availability: the channel that would fulfil the next order.
 *
 * Amazon draws on its own inventory first, so a hybrid listing reports only its
 * FBA channels while FBA stock lasts, and falls back to the merchant channels
 * once it runs out. FBA entries carry no `quantity` — Amazon owns that number
 * and does not echo it back — whereas merchant entries report the live ledger.
 *
 * With nothing in stock anywhere, the primary channel is still reported, so the
 * section never comes back empty for a listing that declares a channel.
 */
function deriveFulfillmentAvailability(doc: ListingDoc): FulfillmentAvailabilityEntry[] {
  const fba = fbaChannels(doc.attributes);
  const asFbaEntries = () => fba.map((fulfillmentChannelCode) => ({ fulfillmentChannelCode }));
  const asMfnEntries = () => doc.mfnAvailability.map((e) => ({ ...e }));

  if (fba.length === 0) return asMfnEntries();
  if (fbaQuantity(doc.sku) > 0) return asFbaEntries();
  return mfnQuantity(doc) > 0 ? asMfnEntries() : asFbaEntries();
}

/**
 * Purchasable quantity, for status derivation only — never reported. Either
 * channel can fulfil, so stock in either keeps the listing buyable.
 */
function totalAvailableQuantity(doc: ListingDoc): number {
  return (fbaChannels(doc.attributes).length > 0 ? fbaQuantity(doc.sku) : 0) + mfnQuantity(doc);
}

/** True when any channel declares always-available inventory (never depletes). */
function hasAlwaysAvailableInventory(attributes: Record<string, unknown>): boolean {
  const instances = attributes.fulfillment_availability;
  if (!Array.isArray(instances)) return false;
  return (instances as AttrInstance[]).some((inst) => inst.is_inventory_available === true);
}

/**
 * Listing status derivation (summaries[].status):
 *  - BUYABLE: offer not skipped AND active offer AND in stock (positive
 *    quantity or always-available inventory) AND not listing-suppressed
 *  - DISCOVERABLE: not search-suppressed
 */
export function deriveStatus(doc: ListingDoc, now = new Date()): string[] {
  const skipOffer = firstAttrValue(doc.attributes, "skip_offer") === true;
  const inStock = totalAvailableQuantity(doc) > 0 || hasAlwaysAvailableInventory(doc.attributes);

  const status: string[] = [];
  const buyable = !skipOffer && activeOffers(doc.attributes, now).length > 0 && inStock && !hasEnforcement(doc.issues, "LISTING_SUPPRESSED");
  if (buyable) status.push("BUYABLE");
  if (!hasEnforcement(doc.issues, "SEARCH_SUPPRESSED")) status.push("DISCOVERABLE");
  return status;
}

/** Summaries derivation: the marketplace-scoped live view of the listing. */
function deriveSummaries(doc: ListingDoc, marketplaceId: string, now = new Date()): Record<string, unknown>[] {
  const summary: Record<string, unknown> = {
    marketplaceId,
    productType: doc.productType,
    status: deriveStatus(doc, now),
    createdDate: doc.createdDate,
    lastUpdatedDate: doc.lastUpdatedDate,
  };
  if (doc.asin) summary.asin = doc.asin;

  const conditionType = firstAttrValue(doc.attributes, "condition_type");
  if (typeof conditionType === "string") summary.conditionType = conditionType;

  const itemName = firstAttrValue(doc.attributes, "item_name");
  if (typeof itemName === "string") summary.itemName = itemName;

  const mainImage = firstAttrValue(doc.attributes, "main_product_image_locator", "media_location");
  if (typeof mainImage === "string") {
    summary.mainImage = { link: mainImage, height: 500, width: 500 };
  }

  return [summary];
}

/** Buyer-segment display names for derived offers (IVP audiences). */
const AUDIENCE_DISPLAY_NAMES: Record<string, string> = {
  ALL: "Sell on Amazon",
  B2B: "Amazon Business",
};

/** Single-unit price for an offer instance: active discounted_price else our_price. */
function offerPrice(inst: AttrInstance, now: Date): { currencyCode: string; amount: string } | null {
  const schedules = (field: string): AttrInstance[] => {
    const arr = inst[field];
    if (!Array.isArray(arr) || arr.length === 0) return [];
    const first = (arr[0] as AttrInstance).schedule;
    return Array.isArray(first) ? (first as AttrInstance[]) : [];
  };

  const discounted = schedules("discounted_price").find((s) => scheduleActive(s, now));
  const regularList = schedules("our_price");
  const regular = regularList.length > 0 ? regularList[0] : undefined;
  const chosen = discounted ?? regular;
  if (chosen?.value_with_tax === undefined) return null;
  return { currencyCode: asString(inst.currency, "USD"), amount: asString(chosen.value_with_tax, "") };
}

/**
 * Offers derivation from attributes.purchasable_offer: one entry per
 * active instance. audience=ALL (or absent) => B2C; anything else => B2B.
 * IVP audiences (B2B_*) carry an audience object with a display name.
 */
function deriveOffers(doc: ListingDoc, marketplaceId: string, now = new Date()): Record<string, unknown>[] {
  return activeOffers(doc.attributes, now).flatMap((inst) => {
    const price = offerPrice(inst, now);
    if (!price) return [];
    const audience = asString(inst.audience, "ALL");
    const offer: Record<string, unknown> = {
      marketplaceId: asString(inst.marketplace_id, marketplaceId),
      offerType: audience === "ALL" ? "B2C" : "B2B",
      price,
    };
    if (audience !== "ALL") {
      offer.audience = { value: audience, displayName: AUDIENCE_DISPLAY_NAMES[audience] ?? audience };
    }
    return [offer];
  });
}

/**
 * Splits a variation theme into the attribute names it is composed of:
 * `SIZE/COLOR/NUMBER_OF_ITEMS` becomes `["color", "number_of_items", "size"]`.
 * Sorted, because production reports them alphabetically rather than in theme
 * order.
 */
function themeAttributes(theme: string): string[] {
  return theme
    .split("/")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token !== "")
    .sort((a, b) => a.localeCompare(b));
}

/** The variation theme declared on a listing, if it declared one. */
function variationTheme(attributes: Record<string, unknown>): { attributes: string[]; theme: string } | undefined {
  const name = firstAttrValue(attributes, "variation_theme", "name");
  if (typeof name !== "string" || name === "") return undefined;
  return { attributes: themeAttributes(name), theme: name };
}

/** SKUs this listing names as its variation parents. */
export function declaredParentSkus(attributes: Record<string, unknown>): string[] {
  const instances = attributes.child_parent_sku_relationship;
  if (!Array.isArray(instances)) return [];
  return (instances as AttrInstance[])
    .map((inst) => inst.parent_sku)
    .filter((sku): sku is string => typeof sku === "string" && sku !== "");
}

/** SKUs this listing declares itself to contain (`package_contains_sku`). */
export function declaredContainedSkus(attributes: Record<string, unknown>): string[] {
  const instances = attributes.package_contains_sku;
  if (!Array.isArray(instances)) return [];
  return (instances as AttrInstance[]).map((inst) => inst.sku).filter((sku): sku is string => typeof sku === "string" && sku !== "");
}

/** The seller's other listings, which relationship resolution has to consult. */
function siblingListings(doc: ListingDoc): ListingDoc[] {
  return Context.instance.engine
    .find(Api.LISTINGS, { sellerId: doc.sellerId })
    .map(asListingDoc)
    .filter((sibling) => sibling.sku !== doc.sku);
}

/**
 * Relationship derivation — the one response section that is not a function of
 * a single listing document, because half of each relationship is recorded on
 * the other listing.
 *
 * The two types record it from opposite ends, so each needs a lookup in the
 * opposite direction:
 *  - VARIATION: the child declares `child_parent_sku_relationship.parent_sku`,
 *    so a child reads its own attributes and a parent finds the siblings that
 *    name it.
 *  - PACKAGE_HIERARCHY: the container declares `package_contains_sku`, so a
 *    case reads its own attributes and a contained unit finds the siblings
 *    that list it.
 *
 * A listing in the middle of a package hierarchy (a case inside a pallet)
 * therefore reports both `parentSkus` and `childSkus` on one entry. Only
 * `VARIATION` carries a `variationTheme`.
 *
 * Returns an empty array for an unrelated listing rather than omitting the
 * section, which is what production does.
 */
function deriveRelationships(doc: ListingDoc, marketplaceId: string): Record<string, unknown>[] {
  const siblings = siblingListings(doc);
  const relationships: Record<string, unknown>[] = [];

  const variationParents = declaredParentSkus(doc.attributes);
  const variationChildren = siblings.filter((s) => declaredParentSkus(s.attributes).includes(doc.sku)).map((s) => s.sku);
  if (variationParents.length > 0 || variationChildren.length > 0) {
    const entry: Record<string, unknown> = { type: "VARIATION" };
    if (variationParents.length > 0) entry.parentSkus = variationParents;
    if (variationChildren.length > 0) entry.childSkus = variationChildren;
    const theme = variationTheme(doc.attributes);
    if (theme) entry.variationTheme = theme;
    relationships.push(entry);
  }

  const containedSkus = declaredContainedSkus(doc.attributes);
  const containers = siblings.filter((s) => declaredContainedSkus(s.attributes).includes(doc.sku)).map((s) => s.sku);
  if (containedSkus.length > 0 || containers.length > 0) {
    const entry: Record<string, unknown> = { type: "PACKAGE_HIERARCHY" };
    if (containers.length > 0) entry.parentSkus = containers;
    if (containedSkus.length > 0) entry.childSkus = containedSkus;
    relationships.push(entry);
  }

  return relationships.length > 0 ? [{ marketplaceId, relationships }] : [];
}

/**
 * Procurement derivation from attributes.cost_price: the cost Amazon pays a
 * vendor for the product, which is the vendor counterpart of a merchant's
 * `offers`. Derived from the submission rather than stored separately, so a
 * vendor reads back exactly the cost they submitted.
 *
 * Empty when no cost was submitted, which is also the merchant case — a seller
 * never submits `cost_price`, so the section stays empty for them.
 */
function deriveProcurement(doc: ListingDoc): Record<string, unknown>[] {
  const instances = doc.attributes.cost_price;
  if (!Array.isArray(instances)) return [];
  return (instances as AttrInstance[]).flatMap((inst) => {
    if (inst.value === undefined || inst.value === null) return [];
    return [{ costPrice: { currencyCode: asString(inst.currency, "USD"), amount: asString(inst.value, "") } }];
  });
}

/**
 * Builds the Item response for a listing per the requested includedData
 * sections. `sku` is always present; sections are derived or read from
 * the stored document.
 */
export function buildItemResponse(doc: ListingDoc, includedData: string[], marketplaceId: string, now = new Date()): Record<string, unknown> {
  const item: Record<string, unknown> = { sku: doc.sku };

  for (const section of includedData) {
    switch (section) {
      case "summaries":
        item.summaries = deriveSummaries(doc, marketplaceId, now);
        break;
      case "attributes":
        item.attributes = doc.attributes;
        break;
      case "issues":
        item.issues = doc.issues;
        break;
      case "offers":
        item.offers = deriveOffers(doc, marketplaceId, now);
        break;
      case "fulfillmentAvailability":
        item.fulfillmentAvailability = deriveFulfillmentAvailability(doc);
        break;
      case "procurement":
        item.procurement = deriveProcurement(doc);
        break;
      case "relationships":
        item.relationships = deriveRelationships(doc, marketplaceId);
        break;
      case "productTypes":
        item.productTypes = [{ marketplaceId, productType: doc.productType }];
        break;
    }
  }
  return item;
}

/** Coerces a raw DB record into the typed ListingDoc shape with defaults. */
export function asListingDoc(record: Record<string, unknown>): ListingDoc {
  return {
    _key: asString(record._key, ""),
    sku: asString(record.sku, ""),
    sellerId: asString(record.sellerId, ""),
    productType: asString(record.productType, ""),
    requirements: record.requirements as string | undefined,
    marketplaceId: asString(record.marketplaceId, ""),
    attributes: (record.attributes as Record<string, unknown> | undefined) ?? {},
    issues: (record.issues as ListingIssue[] | undefined) ?? [],
    asin: record.asin as string | undefined,
    mfnAvailability: (record.mfnAvailability as MfnAvailabilityEntry[] | undefined) ?? [],
    createdDate: asString(record.createdDate, ""),
    lastUpdatedDate: asString(record.lastUpdatedDate, ""),
  };
}
