import { describe, it, expect } from "vitest";
import { identifyApiName, identifyApiVersion } from "../../src/service/apiSchemaIdentificationService.js";

describe("identifyApiName", () => {
  it("maps /orders/ paths to Orders", () => {
    expect(identifyApiName("/orders/v0/orders/123")).toBe("Orders");
    expect(identifyApiName("/orders/2026-01-01/orders/456")).toBe("Orders");
  });

  it("maps /listings/ paths to Listings", () => {
    expect(identifyApiName("/listings/2021-08-01/items/SKU123")).toBe("Listings");
  });

  it("maps /catalog/ paths to Catalog Items", () => {
    expect(identifyApiName("/catalog/2022-04-01/items")).toBe("Catalog Items");
  });

  it("maps /externalFulfillment/.../shipments paths to External Fulfillment Shipments", () => {
    expect(identifyApiName("/externalFulfillment/2024-09-11/shipments/SHIP1")).toBe("External Fulfillment Shipments");
  });

  it("maps /externalFulfillment/.../returns paths to External Fulfillment Returns", () => {
    expect(identifyApiName("/externalFulfillment/2024-09-11/returns/RET1")).toBe("External Fulfillment Returns");
  });

  it("maps /externalFulfillment/inventory/ paths to External Fulfillment Inventory", () => {
    expect(identifyApiName("/externalFulfillment/inventory/2024-09-11/inventories")).toBe("External Fulfillment Inventory");
  });

  it("maps /fba/inventory/ paths to FBA Inventory", () => {
    expect(identifyApiName("/fba/inventory/v1/items/SKU1")).toBe("FBA Inventory");
  });

  it("maps /batches/products/pricing/ paths to Product Pricing", () => {
    expect(identifyApiName("/batches/products/pricing/2022-05-01/items")).toBe("Product Pricing");
  });

  it("maps /reports/ paths to Reports", () => {
    expect(identifyApiName("/reports/2021-06-30/reports")).toBe("Reports");
  });

  it("returns undefined for unknown paths", () => {
    expect(identifyApiName("/unknown/path")).toBeUndefined();
  });
});

describe("identifyApiVersion", () => {
  it("extracts v0 from ordersV0.json model", () => {
    expect(identifyApiVersion("/orders/v0/orders/123")).toBe("v0");
  });

  it("extracts 2026-01-01 from orders_2026-01-01.json model", () => {
    expect(identifyApiVersion("/orders/2026-01-01/orders/456")).toBe("2026-01-01");
  });

  it("extracts 2022-04-01 from catalogItems_2022-04-01.json model", () => {
    expect(identifyApiVersion("/catalog/2022-04-01/items")).toBe("2022-04-01");
  });

  it("extracts 2021-08-01 from listingsItems_2021-08-01.json model", () => {
    expect(identifyApiVersion("/listings/2021-08-01/items/SKU1")).toBe("2021-08-01");
  });

  it("extracts v1 from fbaInventory_v1.json model", () => {
    expect(identifyApiVersion("/fba/inventory/v1/items/SKU1")).toBe("v1");
  });

  it("extracts 2024-09-11 from externalFulfillmentShipments_2024-09-11.json model", () => {
    expect(identifyApiVersion("/externalFulfillment/2024-09-11/shipments/SHIP1")).toBe("2024-09-11");
  });

  it("extracts 2024-09-11 from externalFulfillmentReturns_2024-09-11.json model", () => {
    expect(identifyApiVersion("/externalFulfillment/2024-09-11/returns/RET1")).toBe("2024-09-11");
  });

  it("extracts 2024-09-11 from externalFulfillmentInventory_2024-09-11.json model", () => {
    expect(identifyApiVersion("/externalFulfillment/inventory/2024-09-11/inventories")).toBe("2024-09-11");
  });

  it("extracts 2022-05-01 from productPricing_2022-05-01.json model", () => {
    expect(identifyApiVersion("/batches/products/pricing/2022-05-01/items")).toBe("2022-05-01");
  });

  it("extracts 2021-06-30 from reports_2021-06-30.json model", () => {
    expect(identifyApiVersion("/reports/2021-06-30/reports")).toBe("2021-06-30");
  });

  it("returns undefined for unknown paths", () => {
    expect(identifyApiVersion("/unknown/path")).toBeUndefined();
  });
});
