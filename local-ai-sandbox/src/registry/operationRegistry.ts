/**
 * Operation Registry — the single source of truth for API-registration facts.
 *
 * Generated from the OpenAPI model files by scripts/generateOperationRegistry.ts and checked in
 * at res/generated/operationRegistry.json. Every runtime call site (path identification, database
 * partitions, resource retrieval, agent routing) reads from here instead of a hand-maintained map.
 *
 * The OperationHandlerRegistry singleton centralises handler registration: it calls each domain's
 * registration function during construction, ensuring handlers are available from first access
 * without side-effect imports in index.ts.
 */
import * as fs from "node:fs";

// --- Mode ---

/** The operating mode of the sandbox, controlling which operations are available. */
export type Mode = "Seller" | "Vendor";

/** All valid mode values. */
export const MODES: Mode[] = ["Seller", "Vendor"] as const;

/**
 * Reads and validates the MODE environment variable. Defaults to "Seller" if unset.
 * Throws if set to an invalid value.
 *
 * This is the single source of truth for mapping the MODE env var to a `Mode`.
 * `CURRENT_MODE` captures it once at boot; callers that must observe runtime
 * changes to `process.env.MODE` (e.g. handlers under test) should call this
 * function rather than re-implementing the mapping.
 */
export function readModeFromEnv(): Mode {
  const raw = process.env.MODE;
  if (!raw) return "Seller";
  if (MODES.includes(raw as Mode)) return raw as Mode;
  throw new Error(`Invalid MODE environment variable: "${raw}". Must be one of: ${MODES.join(", ")}`);
}

/** The current operating mode, resolved once at module load. */
export const CURRENT_MODE: Mode = readModeFromEnv();
import { OperationHandler } from "../operation/operationTypes.js";
import { getCatalogItemHandler, searchCatalogItemsHandler } from "../operation/catalogItemsOperations.js";
import { confirmShipmentHandler, getOrderHandler, searchOrdersHandler } from "../operation/ordersOperations.js";
import {
  cancelReportHandler,
  cancelReportScheduleHandler,
  createReportHandler,
  createReportScheduleHandler,
  getReportDocumentHandler,
  getReportHandler,
  getReportScheduleHandler,
  getReportSchedulesHandler,
  getReportsHandler,
} from "../operation/reportsOperations.js";
import { productionPassThroughHandler, sandboxPassThroughHandler } from "../operation/passThroughOperations.js";
import { getInventorySummariesHandler } from "../operation/fbaInventoryOperations.js";
import {
  getListingsItemHandler,
  searchListingsItemsHandler,
  putListingsItemHandler,
  patchListingsItemHandler,
  deleteListingsItemHandler,
} from "../operation/listingsOperations.js";
import { getListingsRestrictionsHandler } from "../operation/listingsRestrictionsOperations.js";
import { getFeaturedOfferExpectedPriceBatchHandler } from "../operation/pricingOperations.js";
import { listReturnsHandler, getReturnHandler } from "../operation/extFulfillmentReturnsOperations.js";
import {
  getShipmentsHandler,
  getShipmentHandler,
  processShipmentHandler,
  createPackagesHandler,
  updatePackageHandler,
  updatePackageStatusHandler,
  retrieveShippingOptionsHandler,
  generateInvoiceHandler,
  retrieveInvoiceHandler,
  generateShipLabelsHandler,
} from "../operation/extFulfillmentShipmentsOperations.js";
import { batchInventoryHandler } from "../operation/extFulfillmentInventoryOperations.js";
import {
  createDestinationHandler,
  getDestinationsHandler,
  getDestinationHandler,
  deleteDestinationHandler,
  createSubscriptionHandler,
  getSubscriptionHandler,
  getSubscriptionsHandler,
  getSubscriptionByIdHandler,
  deleteSubscriptionByIdHandler,
} from "../operation/notificationsOperations.js";
import {
  createQueryHandler,
  getQueriesHandler,
  getQueryHandler,
  cancelQueryHandler,
  getDocumentHandler,
} from "../operation/dataKioskOperations.js";

export interface OperationEntry {
  operationId: string;
  apiName: string;
  apiVersion: string;
  modelFile: string;
  path: string;
  method: string;
  dbNamespace: string;
  pathPrefix: string;
}

export interface ModelIndexEntry {
  modelFile: string;
  apiName: string;
  apiVersion: string;
  pathPrefix: string;
  dbNamespace: string;
  resourcePath: string | null;
}

export interface OperationRegistry {
  operations: OperationEntry[];
  models: ModelIndexEntry[];
}

const REGISTRY_PATH = "res/generated/operationRegistry.json";

let cache: OperationRegistry | null = null;

function data(): OperationRegistry {
  cache ??= JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8")) as OperationRegistry;
  return cache;
}

/** Composite operation key: "apiName:apiVersion:operationId" (matches the validation engine's key format). */
export function buildKey(apiName: string, apiVersion: string, operationId: string): string {
  return `${apiName}:${apiVersion}:${operationId}`;
}

/** The model whose pathPrefix is the longest prefix of the given request path, or undefined. */
function findModelByPath(requestPath: string): ModelIndexEntry | undefined {
  let best: ModelIndexEntry | undefined;
  for (const m of data().models) {
    if (m.pathPrefix && requestPath.startsWith(m.pathPrefix)) {
      if (!best || m.pathPrefix.length > best.pathPrefix.length) best = m;
    }
  }
  return best;
}

export function identifyApiModel(requestPath: string): string | undefined {
  return findModelByPath(requestPath)?.modelFile;
}

export function identifyApiName(requestPath: string): string | undefined {
  return findModelByPath(requestPath)?.apiName;
}

export function identifyApiVersion(requestPath: string): string | undefined {
  return findModelByPath(requestPath)?.apiVersion;
}

/** Ranks versions so dated schemes (YYYY-MM-DD) outrank legacy vN, then most-recent first. */
function versionRank(v: string): [number, string] {
  return [/^\d{4}-\d{2}-\d{2}$/.test(v) ? 1 : 0, v];
}

/**
 * Resource path for a database namespace: the resourcePath override if present, else the newest
 * model file for that namespace. (Only the Orders namespace has multiple model versions; the
 * newest — Orders 2026-01-01 — is selected, matching the previous modelMap.)
 */
export function getModelPath(dbNamespace: string): string | undefined {
  const models = data().models.filter((m) => m.dbNamespace === dbNamespace);
  if (models.length === 0) return undefined;
  models.sort((a, b) => {
    const [ta, va] = versionRank(a.apiVersion);
    const [tb, vb] = versionRank(b.apiVersion);
    return tb - ta || vb.localeCompare(va);
  });
  const primary = models[0];
  return primary.resourcePath ?? `./res/models/${primary.modelFile}`;
}

export function getOperationByKey(key: string): OperationEntry | undefined {
  return data().operations.find((o) => buildKey(o.apiName, o.apiVersion, o.operationId) === key);
}

/** All composite operation keys in the registry. */
export function operationKeys(): string[] {
  return data().operations.map((o) => buildKey(o.apiName, o.apiVersion, o.operationId));
}

/** Distinct database namespaces declared by the registry. */
export function dbNamespaces(): string[] {
  return [...new Set(data().models.map((m) => m.dbNamespace))].sort();
}

export function isDbNamespace(value: string): boolean {
  return dbNamespaces().includes(value);
}

/**
 * Sanity-check the loaded registry. Throws if it is empty or contains duplicate composite keys.
 * Call once at startup to fail fast on a corrupt or stale artifact.
 */
export function validate(): void {
  const { operations, models } = data();
  if (operations.length === 0 || models.length === 0) {
    throw new Error(`Operation registry at ${REGISTRY_PATH} is empty. Run "npm run registry:generate".`);
  }
  const seen = new Set<string>();
  for (const o of operations) {
    const key = buildKey(o.apiName, o.apiVersion, o.operationId);
    if (seen.has(key)) throw new Error(`Operation registry contains a duplicate composite key: ${key}`);
    seen.add(key);
  }
}

/** Test-only: drop the cached registry so a subsequent call reloads from disk. */
export function __resetCacheForTests(): void {
  cache = null;
}

// --- Runtime Operation Handlers Registry (Singleton) ---

/**
 * Singleton that owns the runtime map of composite key → OperationHandler.
 * All domain-specific handlers are registered during construction via registerAllHandlers().
 */
class OperationHandlerRegistry {
  private readonly handlers = new Map<string, OperationHandler>();
  private readonly supportedModes = new Map<string, Mode[]>();

  constructor() {
    this.registerAllHandlers();
  }

  /** Invokes each domain module's registration function to populate the handler map. */
  private registerAllHandlers(): void {
    this.register("Orders", "2026-01-01", "getOrder", getOrderHandler,  ["Seller"]);
    this.register("Orders", "2026-01-01", "searchOrders", searchOrdersHandler,  ["Seller"]);
    this.register("Orders", "v0", "confirmShipment", confirmShipmentHandler,  ["Seller"]);
    this.register("Reports", "2021-06-30", "createReport", createReportHandler);
    this.register("Reports", "2021-06-30", "getReport", getReportHandler);
    this.register("Reports", "2021-06-30", "getReports", getReportsHandler);
    this.register("Reports", "2021-06-30", "cancelReport", cancelReportHandler);
    this.register("Reports", "2021-06-30", "getReportDocument", getReportDocumentHandler);
    this.register("Reports", "2021-06-30", "createReportSchedule", createReportScheduleHandler);
    this.register("Reports", "2021-06-30", "getReportSchedule", getReportScheduleHandler);
    this.register("Reports", "2021-06-30", "getReportSchedules", getReportSchedulesHandler);
    this.register("Reports", "2021-06-30", "cancelReportSchedule", cancelReportScheduleHandler);
    this.register("Product Type Definitions", "2020-09-01", "searchDefinitionsProductTypes", productionPassThroughHandler);
    this.register("Product Type Definitions", "2020-09-01", "getDefinitionsProductType", productionPassThroughHandler);
    // Listings Items is available to sellers AND vendors, so every operation
    // is registered for both modes. What differs between them is not the
    // operation but the data: the seller-only datasets (offers,
    // fulfillmentAvailability), the vendor-only one (procurement), and the
    // seller-only LISTING_OFFER_ONLY submission are gated by modeRestriction
    // rules in validationRegistry.ts.
    this.register("Listings", "2021-08-01", "getListingsItem", getListingsItemHandler);
    this.register("Listings", "2021-08-01", "searchListingsItems", searchListingsItemsHandler);
    this.register("Listings", "2021-08-01", "putListingsItem", putListingsItemHandler);
    this.register("Listings", "2021-08-01", "patchListingsItem", patchListingsItemHandler);
    this.register("Listings", "2021-08-01", "deleteListingsItem", deleteListingsItemHandler);
    // Listings Restrictions is documented "Sellers only".
    this.register("Listings Restrictions", "2021-08-01", "getListingsRestrictions", getListingsRestrictionsHandler, ["Seller"]);
    this.register("Product Pricing", "2022-05-01", "getCompetitiveSummary", productionPassThroughHandler, ["Seller"]);
    this.register("Product Pricing", "2022-05-01", "getFeaturedOfferExpectedPriceBatch", getFeaturedOfferExpectedPriceBatchHandler, ["Seller"]);
    this.register("Catalog Items", "2022-04-01", "getCatalogItem", getCatalogItemHandler);
    this.register("Catalog Items", "2022-04-01", "searchCatalogItems", searchCatalogItemsHandler);
    this.register("FBA Inventory", "v1", "getInventorySummaries", getInventorySummariesHandler, ["Seller"]);
    this.register("External Fulfillment Returns", "2024-09-11", "listReturns", listReturnsHandler, ["Seller"]);
    this.register("External Fulfillment Returns", "2024-09-11", "getReturn", getReturnHandler, ["Seller"]);
    this.register("External Fulfillment Shipments", "2024-09-11", "getShipments", getShipmentsHandler, ["Seller"]);
    this.register("External Fulfillment Shipments", "2024-09-11", "getShipment", getShipmentHandler, ["Seller"]);
    this.register("External Fulfillment Shipments", "2024-09-11", "processShipment", processShipmentHandler, ["Seller"]);
    this.register("External Fulfillment Shipments", "2024-09-11", "createPackages", createPackagesHandler, ["Seller"]);
    this.register("External Fulfillment Shipments", "2024-09-11", "updatePackage", updatePackageHandler, ["Seller"]);
    this.register("External Fulfillment Shipments", "2024-09-11", "updatePackageStatus", updatePackageStatusHandler, ["Seller"]);
    this.register("External Fulfillment Shipments", "2024-09-11", "retrieveShippingOptions", retrieveShippingOptionsHandler, ["Seller"]);
    this.register("External Fulfillment Shipments", "2024-09-11", "generateInvoice", generateInvoiceHandler, ["Seller"]);
    this.register("External Fulfillment Shipments", "2024-09-11", "retrieveInvoice", retrieveInvoiceHandler, ["Seller"]);
    this.register("External Fulfillment Shipments", "2024-09-11", "generateShipLabels", generateShipLabelsHandler, ["Seller"]);
    this.register("External Fulfillment Inventory", "2024-09-11", "batchInventory", batchInventoryHandler, ["Seller"]);
    this.register("Notifications", "v1", "createDestination", createDestinationHandler);
    this.register("Notifications", "v1", "getDestinations", getDestinationsHandler);
    this.register("Notifications", "v1", "getDestination", getDestinationHandler);
    this.register("Notifications", "v1", "deleteDestination", deleteDestinationHandler);
    this.register("Notifications", "v1", "createSubscription", createSubscriptionHandler);
    this.register("Notifications", "v1", "getSubscription", getSubscriptionHandler);
    this.register("Notifications", "v1", "getSubscriptions", getSubscriptionsHandler);
    this.register("Notifications", "v1", "getSubscriptionById", getSubscriptionByIdHandler);
    this.register("Notifications", "v1", "deleteSubscriptionById", deleteSubscriptionByIdHandler);
    // Data Kiosk is available to sellers AND vendors (both modes, the default).
    this.register("Data Kiosk", "2023-11-15", "createQuery", createQueryHandler);
    this.register("Data Kiosk", "2023-11-15", "getQueries", getQueriesHandler);
    this.register("Data Kiosk", "2023-11-15", "getQuery", getQueryHandler);
    this.register("Data Kiosk", "2023-11-15", "cancelQuery", cancelQueryHandler);
    this.register("Data Kiosk", "2023-11-15", "getDocument", getDocumentHandler);
  }

  /**
   * Registers a single operation handler.
   * @param supportedModes - Which modes this operation is available in. Defaults to all modes (both Seller and Vendor).
   */
  register(
    apiName: string,
    apiVersion: string,
    operationId: string,
    handler: OperationHandler,
    supportedModes = MODES
  ): void {
    const key = buildKey(apiName, apiVersion, operationId);
    this.handlers.set(key, handler);
    this.supportedModes.set(key, supportedModes);
  }

  /** Retrieves the handler for a composite key, or undefined if none is registered. */
  get(key: string): OperationHandler | undefined {
    return this.handlers.get(key);
  }

  /** Returns true if the operation is allowed in the current MODE, otherwise false. */
  isAllowedInCurrentMode(key: string): boolean {
    const modes = this.supportedModes.get(key);
    if (!modes) return false;
    return modes.includes(CURRENT_MODE);
  }
}

/** Singleton instance — handlers are registered on first access. */
let instance: OperationHandlerRegistry | null = null;

/**
 * The runtime operation handler registry singleton.
 */
export const OPERATIONS_REGISTRY: OperationHandlerRegistry = (() => {
  instance ??= new OperationHandlerRegistry();
  return instance;
})();


