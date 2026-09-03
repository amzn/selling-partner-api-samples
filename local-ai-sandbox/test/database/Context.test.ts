import { describe, it, expect, beforeEach } from "vitest";
import { Context, Api } from "../../src/database/Context.js";

describe("Context", () => {
  beforeEach(() => {
    Context.reset();
  });

  describe("singleton instantiation", () => {
    it("returns the same instance on multiple accesses", () => {
      const first = Context.instance;
      const second = Context.instance;

      expect(first).toBe(second);
    });
  });

  describe("defaults to in-memory mode", () => {
    it("engine is accessible", () => {
      const ctx = Context.instance;
      expect(ctx.engine).toBeDefined();
    });
  });

  describe("all Api domain collections are initialized", () => {
    it.each(Object.values(Api))("collection for '%s' is accessible and initially empty", (domain) => {
      const ctx = Context.instance;
      const collection = ctx.engine.getCollection(domain);

      expect(collection).not.toBeNull();
      expect(collection!.count()).toBe(0);
    });
  });

  describe("clear()", () => {
    it("empties all collections after data has been inserted", () => {
      const ctx = Context.instance;

      ctx.engine.put(Api.LISTINGS, "SKU-1", { title: "Test Listing" });
      ctx.engine.put(Api.ORDERS, "ORD-1", { status: "pending" });
      ctx.engine.put(Api.CATALOG, "ASIN-1", { name: "Product" });

      expect(ctx.engine.getCollection(Api.LISTINGS)!.count()).toBe(1);
      expect(ctx.engine.getCollection(Api.ORDERS)!.count()).toBe(1);
      expect(ctx.engine.getCollection(Api.CATALOG)!.count()).toBe(1);

      ctx.clear();

      for (const domain of Object.values(Api)) {
        expect(ctx.engine.getCollection(domain)!.count()).toBe(0);
      }
    });
  });

  describe("reset()", () => {
    it("creates a fresh instance with a different object reference", () => {
      const original = Context.instance;
      Context.reset();
      const fresh = Context.instance;

      expect(fresh).not.toBe(original);
    });

    it("fresh instance does not retain data from the previous instance", () => {
      const ctx = Context.instance;
      ctx.engine.put(Api.INVENTORY, "INV-1", { quantity: 100 });

      Context.reset();

      const freshCtx = Context.instance;
      const result = freshCtx.engine.get(Api.INVENTORY, "INV-1");
      expect(result).toBeNull();
    });
  });

  describe("engine.put/get through Context singleton", () => {
    it("stores and retrieves a document", () => {
      const ctx = Context.instance;
      const doc = { asin: "B0F4X2K9LM", title: "Widget", price: 19.99 };

      ctx.engine.put(Api.CATALOG, "B0F4X2K9LM", doc);

      const result = ctx.engine.get(Api.CATALOG, "B0F4X2K9LM");
      expect(result).toEqual({ _key: "B0F4X2K9LM", asin: "B0F4X2K9LM", title: "Widget", price: 19.99 });
    });

    it("returns null for a key that does not exist", () => {
      const ctx = Context.instance;
      const result = ctx.engine.get(Api.ORDERS, "non-existent");
      expect(result).toBeNull();
    });
  });


});
