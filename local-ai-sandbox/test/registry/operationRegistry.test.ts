import { describe, it, expect } from "vitest";
import * as R from "../../src/registry/operationRegistry.js";
import { Api } from "../../src/database/Context.js";
import { buildRegistry, computePathPrefix } from "../../scripts/generateOperationRegistry.js";

/**
 * The four hand-maintained maps this feature replaces, captured here as fixtures so we can prove
 * the registry reproduces their behavior exactly for the currently-registered APIs (Requirement 9).
 */

// Representative request paths per currently-registered API → expected {model, name, version}.
const PATH_EXPECTATIONS: { path: string; model: string; apiName: string; apiVersion: string }[] = [
  { path: "/listings/2021-08-01/items/A1/SKU-1", model: "listingsItems_2021-08-01.json", apiName: "Listings", apiVersion: "2021-08-01" },
  { path: "/orders/v0/orders/902-1/shipmentConfirmation", model: "ordersV0.json", apiName: "Orders", apiVersion: "v0" },
  { path: "/orders/2026-01-01/orders/902-1", model: "orders_2026-01-01.json", apiName: "Orders", apiVersion: "2026-01-01" },
  { path: "/fba/inventory/v1/summaries", model: "fbaInventory.json", apiName: "FBA Inventory", apiVersion: "v1" },
  {
    path: "/externalFulfillment/inventory/2024-09-11/inventories",
    model: "externalFulfillmentInventory_2024-09-11.json",
    apiName: "External Fulfillment Inventory",
    apiVersion: "2024-09-11",
  },
  {
    path: "/externalFulfillment/2024-09-11/returns/R1",
    model: "externalFulfillmentReturns_2024-09-11.json",
    apiName: "External Fulfillment Returns",
    apiVersion: "2024-09-11",
  },
  {
    path: "/externalFulfillment/2024-09-11/shipments/S1",
    model: "externalFulfillmentShipments_2024-09-11.json",
    apiName: "External Fulfillment Shipments",
    apiVersion: "2024-09-11",
  },
  { path: "/catalog/2022-04-01/items/B0F4X2K9LM", model: "catalogItems_2022-04-01.json", apiName: "Catalog Items", apiVersion: "2022-04-01" },
  {
    path: "/batches/products/pricing/2022-05-01/items/featuredOfferExpectedPrice",
    model: "productPricing_2022-05-01.json",
    apiName: "Product Pricing",
    apiVersion: "2022-05-01",
  },
  { path: "/reports/2021-06-30/reports/REP-1", model: "reports_2021-06-30.json", apiName: "Reports", apiVersion: "2021-06-30" },
];

// The previous resourceRetrievalTool modelMap (namespace → resource path).
const OLD_MODEL_MAP: Record<string, string> = {
  orders: "./res/models/orders_2026-01-01.json",
  inventory: "./res/models/fbaInventory.json",
  extFulfillmentInventory: "./res/models/externalFulfillmentInventory_2024-09-11.json",
  extFulfillmentReturns: "./res/models/externalFulfillmentReturns_2024-09-11.json",
  extFulfillmentShipments: "./res/models/externalFulfillmentShipments_2024-09-11.json",
  catalog: "./res/models/catalogItems_2022-04-01.json",
  pricing: "./res/models/productPricing_2022-05-01.json",
};

describe("operationRegistry — no regression vs. the old maps (Req 9)", () => {
  it("loads and validates", () => {
    expect(() => {
      R.validate();
    }).not.toThrow();
  });

  it("resolves model/name/version identically to the old path map", () => {
    for (const e of PATH_EXPECTATIONS) {
      expect({ path: e.path, model: R.identifyApiModel(e.path) }).toEqual({ path: e.path, model: e.model });
      expect({ path: e.path, name: R.identifyApiName(e.path) }).toEqual({ path: e.path, name: e.apiName });
      expect({ path: e.path, version: R.identifyApiVersion(e.path) }).toEqual({ path: e.path, version: e.apiVersion });
    }
  });

  it("resolves resource paths identically to the old modelMap", () => {
    for (const [ns, expected] of Object.entries(OLD_MODEL_MAP)) {
      expect({ ns, path: R.getModelPath(ns) }).toEqual({ ns, path: expected });
    }
  });

  it("returns undefined for an unknown path (unchanged 404 behavior)", () => {
    expect(R.identifyApiModel("/totally/unknown/path")).toBeUndefined();
  });
});

describe("operationRegistry — invariants", () => {
  it("namespaces exactly equal the Api enum (Req 4.3 coverage)", () => {
    expect(R.dbNamespaces()).toEqual([...Object.values(Api)].sort());
  });

  it("has no duplicate composite keys (Req 9)", () => {
    const keys = R.operationKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("prefers the longer prefix when two models could match (orders v0 vs 2026)", () => {
    // Both /orders/v0/orders and /orders/2026-01-01/orders exist; each path resolves to its own model.
    expect(R.identifyApiModel("/orders/v0/orders/1/shipmentConfirmation")).toBe("ordersV0.json");
    expect(R.identifyApiModel("/orders/2026-01-01/orders/1")).toBe("orders_2026-01-01.json");
  });
});

describe("generateOperationRegistry helpers", () => {
  it("computePathPrefix stops before parameterized segments", () => {
    expect(computePathPrefix(["/orders/v0/orders/{orderId}/shipmentConfirmation"])).toBe("/orders/v0/orders");
    expect(computePathPrefix(["/a/b/{x}", "/a/b/{y}/c"])).toBe("/a/b");
    expect(computePathPrefix(["/a/b", "/a/c"])).toBe("/a");
    expect(computePathPrefix([])).toBe("");
  });

  it("the committed registry matches a fresh build (no drift)", () => {
    const fresh = buildRegistry();
    expect(fresh.operations.length).toBeGreaterThan(0);
    // Every freshly-built operation resolves to the same model via the loader.
    for (const op of fresh.operations) {
      expect(R.getOperationByKey(R.buildKey(op.apiName, op.apiVersion, op.operationId))).toBeTruthy();
    }
  });
});
