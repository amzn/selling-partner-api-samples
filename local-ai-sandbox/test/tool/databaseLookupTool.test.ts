import { describe, it, expect, beforeEach } from "vitest";
import { Context, Api } from "../../src/database/Context.js";
import { databaseLookupCallback } from "../../src/tool/databaseLookupTool.js";

describe("databaseLookupTool", () => {
  beforeEach(() => {
    Context.instance.db.data.listings = {};
  });

  describe("single id lookup", () => {
    it("returns the item when it exists", async () => {
      Context.instance.db.data.listings["SKU-1"] = { name: "Widget", price: 9.99 };
      const result = await databaseLookupCallback({ api: Api.LISTINGS, id: "SKU-1" });
      expect(JSON.parse(result)).toEqual({ name: "Widget", price: 9.99 });
    });

    it('returns "No data found" for a missing id', async () => {
      const result = await databaseLookupCallback({ api: Api.LISTINGS, id: "MISSING" });
      expect(result).toBe("No data found");
    });

    it("returns seeded catalog data", async () => {
      const result = await databaseLookupCallback({ api: Api.CATALOG, asin: "B0F4X2K9LM" });
      const parsed = JSON.parse(result);
      expect(parsed.asin).toBe("B0F4X2K9LM");
    });
  });

  describe("get all (no id)", () => {
    it("returns all items for the api partition", async () => {
      Context.instance.db.data.listings.A = { x: 1 };
      Context.instance.db.data.listings.B = { x: 2 };
      const result = await databaseLookupCallback({ api: Api.LISTINGS });
      const parsed = JSON.parse(result);
      expect(Object.keys(parsed)).toEqual(["A", "B"]);
    });

    it("returns empty object when no data exists", async () => {
      const result = await databaseLookupCallback({ api: Api.LISTINGS });
      expect(JSON.parse(result)).toEqual({});
    });
  });

  describe("batch ids lookup", () => {
    it("returns results for all requested ids", async () => {
      Context.instance.db.data.listings["SKU-1"] = { name: "Widget" };
      Context.instance.db.data.listings["SKU-2"] = { name: "Gadget" };
      const result = await databaseLookupCallback({ api: Api.LISTINGS, ids: ["SKU-1", "SKU-2"] });
      const parsed = JSON.parse(result);
      expect(parsed["SKU-1"]).toEqual({ name: "Widget" });
      expect(parsed["SKU-2"]).toEqual({ name: "Gadget" });
    });

    it("returns null for missing ids in a batch", async () => {
      Context.instance.db.data.listings["SKU-1"] = { name: "Widget" };
      const result = await databaseLookupCallback({ api: Api.LISTINGS, ids: ["SKU-1", "MISSING"] });
      const parsed = JSON.parse(result);
      expect(parsed["SKU-1"]).toEqual({ name: "Widget" });
      expect(parsed.MISSING).toBeNull();
    });

    it("returns all nulls when none exist", async () => {
      const result = await databaseLookupCallback({ api: Api.LISTINGS, ids: ["A", "B", "C"] });
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ A: null, B: null, C: null });
    });
  });

  describe("fields filtering", () => {
    it("returns only requested fields for single id", async () => {
      Context.instance.db.data.listings["SKU-1"] = { name: "Widget", price: 9.99, color: "red", weight: 1.5 };
      const result = await databaseLookupCallback({ api: Api.LISTINGS, id: "SKU-1", fields: ["name", "price"] });
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ name: "Widget", price: 9.99 });
      expect(parsed.color).toBeUndefined();
    });

    it("returns null for fields that do not exist on the item", async () => {
      Context.instance.db.data.listings["SKU-1"] = { name: "Widget" };
      const result = await databaseLookupCallback({ api: Api.LISTINGS, id: "SKU-1", fields: ["name", "nonexistent"] });
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ name: "Widget", nonexistent: null });
    });

    it("applies fields filter to batch lookups", async () => {
      Context.instance.db.data.listings["SKU-1"] = { name: "Widget", price: 9.99, color: "red" };
      Context.instance.db.data.listings["SKU-2"] = { name: "Gadget", price: 19.99, color: "blue" };
      const result = await databaseLookupCallback({ api: Api.LISTINGS, ids: ["SKU-1", "SKU-2"], fields: ["price"] });
      const parsed = JSON.parse(result);
      expect(parsed["SKU-1"]).toEqual({ price: 9.99 });
      expect(parsed["SKU-2"]).toEqual({ price: 19.99 });
    });

    it("returns null for missing ids even with fields filter", async () => {
      const result = await databaseLookupCallback({ api: Api.LISTINGS, ids: ["MISSING"], fields: ["name"] });
      const parsed = JSON.parse(result);
      expect(parsed.MISSING).toBeNull();
    });

    it("does not filter when fields is not provided", async () => {
      Context.instance.db.data.listings["SKU-1"] = { name: "Widget", price: 9.99, color: "red" };
      const result = await databaseLookupCallback({ api: Api.LISTINGS, id: "SKU-1" });
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ name: "Widget", price: 9.99, color: "red" });
    });

    it("applies fields filter to get-all queries", async () => {
      Context.instance.db.data.listings["SKU-1"] = { name: "Widget", price: 9.99, color: "red" };
      Context.instance.db.data.listings["SKU-2"] = { name: "Gadget", price: 19.99, color: "blue" };
      const result = await databaseLookupCallback({ api: Api.LISTINGS, fields: ["price"] });
      const parsed = JSON.parse(result);
      expect(parsed["SKU-1"]).toEqual({ price: 9.99 });
      expect(parsed["SKU-2"]).toEqual({ price: 19.99 });
    });
  });
});
