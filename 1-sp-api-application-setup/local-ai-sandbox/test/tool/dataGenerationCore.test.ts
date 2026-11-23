import { describe, it, expect, beforeEach } from "vitest";
import { Api, Context } from "../../src/database/Context.js";
import { listingKey } from "../../src/operation/listingsItemModel.js";
import { insertEntity, noGuidanceMessage, resolveKey, retrieveGuidance, retrieveModel, snapshotData } from "../../src/tool/dataGenerationCore.js";
import { DOMAIN_GUIDANCE } from "../../src/tool/domainGuidance.js";

describe("dataGenerationCore", () => {
  beforeEach(() => {
    Context.reset();
  });

  describe("resolveKey", () => {
    it("uses the id for ordinary domains", () => {
      expect(resolveKey(Api.ORDERS, "111-1", { orderId: "111-1" })).toEqual({ key: "111-1" });
    });

    it("keys FBA inventory by sellerSku and rejects a missing one", () => {
      expect(resolveKey(Api.INVENTORY, "ignored", { sellerSku: "SKU-1" })).toEqual({ key: "SKU-1" });
      expect(resolveKey(Api.INVENTORY, "SKU-1", {})).toHaveProperty("error");
    });

    it("keys listings by seller and sku, falling back to the id for the sku", () => {
      expect(resolveKey(Api.LISTINGS, "SKU-1", { sellerId: "S1", sku: "SKU-2" })).toEqual({ key: listingKey("S1", "SKU-2"), sku: "SKU-2" });
      expect(resolveKey(Api.LISTINGS, "SKU-1", { sellerId: "S1" })).toEqual({ key: listingKey("S1", "SKU-1"), sku: "SKU-1" });
      expect(resolveKey(Api.LISTINGS, "SKU-1", { sku: "SKU-1" })).toHaveProperty("error");
    });
  });

  describe("insertEntity", () => {
    it("stores the entity under the resolved key", () => {
      expect(insertEntity(Api.ORDERS, "111-1", { orderId: "111-1" })).toEqual({ ok: true, key: "111-1" });
      expect(Context.instance.engine.get(Api.ORDERS, "111-1")).toMatchObject({ orderId: "111-1" });
    });

    it("stores listings with the sku the key was built from", () => {
      insertEntity(Api.LISTINGS, "SKU-1", { sellerId: "S1" });
      expect(Context.instance.engine.get(Api.LISTINGS, listingKey("S1", "SKU-1"))).toMatchObject({ sellerId: "S1", sku: "SKU-1" });
    });

    it("returns the error without writing when the key cannot be resolved", () => {
      const result = insertEntity(Api.LISTINGS, "SKU-1", {});
      expect(result.ok).toBe(false);
      expect(snapshotData(Api.LISTINGS)).toEqual({ [Api.LISTINGS]: {} });
    });
  });

  describe("snapshotData", () => {
    it("strips engine bookkeeping and can filter by domain", () => {
      insertEntity(Api.ORDERS, "111-1", { orderId: "111-1" });
      const all = snapshotData();
      expect(Object.keys(all).sort()).toEqual(Object.values(Api).sort());
      expect(snapshotData(Api.ORDERS)).toEqual({ [Api.ORDERS]: { "111-1": { orderId: "111-1" } } });
    });
  });

  describe("model and guidance retrieval", () => {
    it("returns a parseable model for a registered domain", () => {
      const model = retrieveModel(Api.ORDERS);
      expect(model).toBeDefined();
      expect(() => {
        JSON.parse(model ?? "");
      }).not.toThrow();
    });

    it("returns guidance where declared and undefined otherwise", () => {
      expect(retrieveGuidance(Api.LISTINGS)).toBe(DOMAIN_GUIDANCE[Api.LISTINGS]);
      expect(retrieveGuidance(Api.ORDERS)).toBeUndefined();
      expect(noGuidanceMessage(Api.ORDERS)).toContain("orders");
    });
  });
});
