import { describe, it, expect } from "vitest";
import { isExcluded, isOperationExcluded, deriveApiName, deriveDbNamespace, overrideFor } from "../../scripts/config/apiRegistrationConfig.js";

describe("exclude list", () => {
  it("excludes superseded whole models/APIs", () => {
    expect(isExcluded({ apiName: "Catalog Items", apiVersion: "v0" })).toBe(true);
    expect(isExcluded({ modelFile: "listingsItems_2020-09-01.json" })).toBe(true);
  });

  it("does not exclude live APIs — including Orders v0 (hosts confirmShipment)", () => {
    expect(isExcluded({ apiName: "Orders", apiVersion: "v0" })).toBe(false);
    expect(isExcluded({ apiName: "Catalog Items", apiVersion: "2022-04-01" })).toBe(false);
  });

  it("a reason-only / empty identity matches nothing", () => {
    expect(isExcluded({})).toBe(false);
    expect(isOperationExcluded({}, "getOrder")).toBe(false);
  });

  it("a whole-model rule is not treated as an operation-level exclusion", () => {
    // No operationId-scoped rules are configured today, so nothing is op-excluded.
    expect(isOperationExcluded({ apiName: "Orders", apiVersion: "v0" }, "confirmShipment")).toBe(false);
    expect(isOperationExcluded({ apiName: "Catalog Items", apiVersion: "v0" }, "anything")).toBe(false);
  });
});

describe("name / namespace derivation", () => {
  it("uses overrides where the derived value would be wrong", () => {
    expect(overrideFor("productPricing_2022-05-01.json")?.apiName).toBe("Product Pricing");
    expect(deriveApiName("Selling Partner API for Pricing", "productPricing_2022-05-01.json")).toBe("Product Pricing");
    expect(deriveDbNamespace("Product Pricing", "productPricing_2022-05-01.json")).toBe("pricing");
    expect(deriveDbNamespace("FBA Inventory", "fbaInventory.json")).toBe("inventory");
  });

  it("falls back to title cleanup + slug when no override exists", () => {
    expect(deriveApiName("The Selling Partner API for Amazon Foo Bar Processing", "foo.json")).toBe("Foo Bar");
    expect(deriveDbNamespace("External Fulfillment Widgets", "foo.json")).toBe("externalFulfillmentWidgets");
  });
});
