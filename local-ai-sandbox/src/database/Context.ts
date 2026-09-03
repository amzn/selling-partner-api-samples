import { DatabaseEngine } from "./DatabaseEngine.js";
import { type DatabaseEngineConfig } from "./types.js";
import { dbNamespaces } from "../registry/operationRegistry.js";

export enum Api {
  LISTINGS = "listings",
  ORDERS = "orders",
  INVENTORY = "inventory",
  EXT_FULFILLMENT_INVENTORY = "extFulfillmentInventory",
  EXT_FULFILLMENT_RETURNS = "extFulfillmentReturns",
  EXT_FULFILLMENT_SHIPMENTS = "extFulfillmentShipments",
  CATALOG = "catalog",
  PRICING = "pricing",
  REPORTS = "reports",
  LISTINGS_RESTRICTIONS = "listingsRestrictions",
  PRODUCT_TYPE_DEFINITIONS = "productTypeDefinitions",
  NOTIFICATIONS = "notifications",
  DATA_KIOSK = "dataKiosk",
}

/**
 * The `Api` enum is the typed surface used across the app; the registry is the generated source of
 * truth for which namespaces exist. Fail fast if they diverge so adding an API to the registry
 * without updating the enum (or vice versa) is caught at construction rather than silently.
 */
function assertEnumMatchesRegistry(): void {
  const enumValues = [...Object.values(Api)].sort();
  const registryValues = dbNamespaces();
  const missingFromEnum = registryValues.filter((ns) => !enumValues.includes(ns as Api));
  const missingFromRegistry = enumValues.filter((v) => !registryValues.includes(v));
  if (missingFromEnum.length > 0 || missingFromRegistry.length > 0) {
    throw new Error(
      `Api enum is out of sync with the operation registry. ` +
        `In registry but missing from Api enum: [${missingFromEnum.join(", ")}]. ` +
        `In Api enum but missing from registry: [${missingFromRegistry.join(", ")}]. ` +
        `Update the Api enum in Context.ts to match res/generated/operationRegistry.json.`,
    );
  }
}

/**
 * Reads DatabaseEngineConfig from environment variables.
 * - DB_MODE: "memory" | "persistent" (default: "memory")
 * - DB_FILE_PATH: path to the persistence file (required when DB_MODE is "persistent")
 */
function loadConfigFromEnvironment(): DatabaseEngineConfig {
  const mode = process.env.DB_MODE === "persistent" ? "persistent" : "memory";

  if (mode === "persistent") {
    const filePath = process.env.DB_FILE_PATH;
    if (!filePath) throw new Error("DB_MODE is 'persistent' but DB_FILE_PATH is not set.");
    return { mode: "persistent", filePath };
  }

  return { mode: "memory" };
}

export class Context {
  static #instance: Context;
  readonly engine: DatabaseEngine;

  private constructor() {
    assertEnumMatchesRegistry();
    const resolvedConfig: DatabaseEngineConfig = loadConfigFromEnvironment();
    this.engine = new DatabaseEngine(resolvedConfig);
  }

  /** Get or create the singleton */
  public static get instance(): Context {
    if (!Context.#instance) {
      Context.#instance = new Context();
    }
    return Context.#instance;
  }

  /** Reset singleton for test isolation */
  public static reset(): void {
    Context.#instance = undefined as unknown as Context;
  }

  /** Clear all data */
  public clear(): void {
    this.engine.clear();
  }
}
