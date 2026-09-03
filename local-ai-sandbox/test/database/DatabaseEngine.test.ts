import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseEngine } from "../../src/database/DatabaseEngine.js";
import { InvalidDomainError, InvalidKeyError } from "../../src/database/types.js";
import { Api } from "../../src/database/Context.js";

describe("DatabaseEngine", () => {
  let engine: DatabaseEngine;
  const allDomains = Object.values(Api);

  beforeEach(() => {
    engine = new DatabaseEngine({ mode: "memory" });
  });

  describe("initialization", () => {
    it("creates empty collections for all domains", () => {
      for (const domain of allDomains) {
        const collection = engine.getCollection(domain);
        expect(collection).not.toBeNull();
        expect(collection!.count()).toBe(0);
      }
    });
  });

  describe("put and get", () => {
    it("round-trips a document with concrete data", () => {
      const doc = { title: "Widget", price: 9.99, tags: ["sale", "new"] };
      engine.put(Api.LISTINGS, "SKU-001", doc);

      const result = engine.get(Api.LISTINGS, "SKU-001");
      expect(result).toEqual({ _key: "SKU-001", title: "Widget", price: 9.99, tags: ["sale", "new"] });
    });

    it("returns null for a missing key", () => {
      const result = engine.get(Api.ORDERS, "non-existent-key");
      expect(result).toBeNull();
    });

    it("overwrites existing document on upsert", () => {
      engine.put(Api.CATALOG, "ASIN-1", { name: "Original", color: "red" });
      engine.put(Api.CATALOG, "ASIN-1", { name: "Updated", size: "large" });

      const result = engine.get(Api.CATALOG, "ASIN-1");
      expect(result).toEqual({ _key: "ASIN-1", name: "Updated", size: "large" });
      expect(result).not.toHaveProperty("color");
    });
  });

  describe("remove", () => {
    it("deletes an existing document and returns true", async () => {
      engine.put(Api.INVENTORY, "INV-100", { quantity: 50 });
      const result = await engine.remove(Api.INVENTORY, "INV-100");

      expect(result).toBe(true);
      expect(engine.get(Api.INVENTORY, "INV-100")).toBeNull();
    });

    it("returns true for a missing key without throwing", async () => {
      const result = await engine.remove(Api.PRICING, "does-not-exist");
      expect(result).toBe(true);
    });
  });

  describe("getBatch", () => {
    it("returns a map with existing and missing keys", () => {
      engine.put(Api.ORDERS, "ORD-1", { status: "shipped" });
      engine.put(Api.ORDERS, "ORD-3", { status: "pending" });

      const result = engine.getBatch(Api.ORDERS, ["ORD-1", "ORD-2", "ORD-3"]);

      expect(result).toBeInstanceOf(Map);
      expect(result.get("ORD-1")).toEqual({ _key: "ORD-1", status: "shipped" });
      expect(result.get("ORD-2")).toBeNull();
      expect(result.get("ORD-3")).toEqual({ _key: "ORD-3", status: "pending" });
    });
  });

  describe("error handling", () => {
    it("throws InvalidDomainError for an unknown domain on put", () => {
      expect(() => engine.put("unknownDomain" as Api, "key-1", { data: true })).toThrow(InvalidDomainError);
    });

    it("throws InvalidDomainError for an unknown domain on get", () => {
      expect(() => engine.get("unknownDomain" as Api, "key-1")).toThrow(InvalidDomainError);
    });

    it("throws InvalidDomainError for an unknown domain on remove", async () => {
      await expect(engine.remove("unknownDomain" as Api, "key-1")).rejects.toThrow(InvalidDomainError);
    });

    it("throws InvalidDomainError for an unknown domain on getBatch", () => {
      expect(() => engine.getBatch("unknownDomain" as Api, ["key-1"])).toThrow(InvalidDomainError);
    });

    it("throws InvalidKeyError for null key", () => {
      expect(() => engine.put(Api.LISTINGS, null as unknown as string, { data: true })).toThrow(InvalidKeyError);
    });

    it("throws InvalidKeyError for empty string key", () => {
      expect(() => engine.put(Api.LISTINGS, "", { data: true })).toThrow(InvalidKeyError);
    });
  });

  describe("collection isolation", () => {
    it("operations on one domain do not affect another", async () => {
      engine.put(Api.LISTINGS, "SHARED-KEY", { source: "listings" });
      engine.put(Api.ORDERS, "SHARED-KEY", { source: "orders" });

      await engine.remove(Api.LISTINGS, "SHARED-KEY");

      expect(engine.get(Api.LISTINGS, "SHARED-KEY")).toBeNull();
      expect(engine.get(Api.ORDERS, "SHARED-KEY")).toEqual({ _key: "SHARED-KEY", source: "orders" });
    });
  });

  describe("clear", () => {
    it("empties all collections", () => {
      engine.put(Api.LISTINGS, "L1", { name: "listing" });
      engine.put(Api.ORDERS, "O1", { name: "order" });
      engine.put(Api.CATALOG, "C1", { name: "catalog" });

      engine.clear();

      for (const domain of allDomains) {
        const collection = engine.getCollection(domain);
        expect(collection!.count()).toBe(0);
      }
    });
  });

  describe("getCollection", () => {
    it("returns null for an unknown domain", () => {
      const result = engine.getCollection("nonExistentDomain" as Api);
      expect(result).toBeNull();
    });
  });
});
