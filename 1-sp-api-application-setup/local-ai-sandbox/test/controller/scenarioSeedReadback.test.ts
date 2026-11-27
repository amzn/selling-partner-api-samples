import { describe, it, expect, beforeEach } from "vitest";
import { Api, Context } from "../../src/database/Context.js";
import { seedScenarioById, __resetScenarioCacheForTests } from "../../src/controller/scenariosController.js";
import { listingKey } from "../../src/operation/listingsItemModel.js";

/**
 * Scenario fixtures are written with engine.put() under the id the fixture
 * declares, while the operation handlers look their records up under the key
 * *they* derive. When the two disagree the scenario seeds successfully and then
 * reads back as empty, which is invisible until someone walks the track.
 *
 * These tests pin the readback path for every seeded namespace whose key is
 * derived rather than literal.
 */
describe("scenario seed readback", () => {
  beforeEach(() => {
    __resetScenarioCacheForTests();
    Context.instance.clear();
  });

  it("seeds launch-a-product", () => {
    const result = seedScenarioById("launch-a-product");
    expect(result).toBeDefined();
    expect(result?.seedCount).toBeGreaterThan(0);
  });

  it("stores the seeded listing where getListingsItem looks for it", () => {
    seedScenarioById("launch-a-product");

    const stored = Context.instance.engine.find(Api.LISTINGS, {});
    expect(stored.length).toBeGreaterThan(0);

    // Every seeded listing must carry the sellerId its key is built from, and
    // must live under listingKey(sellerId, sku) — the key getListingsItem and
    // patchListingsItem resolve.
    for (const doc of stored) {
      const record = doc as Record<string, unknown>;
      const sellerId = record.sellerId;
      const sku = record.sku;

      expect(typeof sellerId, `seeded listing ${String(record._key)} needs a sellerId`).toBe("string");
      expect(typeof sku, `seeded listing ${String(record._key)} needs a sku`).toBe("string");

      const expectedKey = listingKey(sellerId as string, sku as string);
      expect(record._key).toBe(expectedKey);
      expect(Context.instance.engine.get(Api.LISTINGS, expectedKey)).toBeDefined();
    }
  });

  it("seeds fixtures without firing data triggers", () => {
    seedScenarioById("launch-a-product");

    // The launch-a-product fixture declares 45 fulfillable units alongside two
    // pending orders. Seeding must not run the inventory-deduction trigger, or
    // the snapshot double-applies and the seeded quantity silently drops.
    const inventory = Context.instance.engine.get(Api.INVENTORY, "LAUNCH-SKU-001");
    expect(inventory).toBeDefined();
    expect(inventory?.fulfillableQuantity).toBe(45);
    expect(inventory?.totalQuantity).toBe(50);
  });

  it("stores the seeded FBA inventory under its sellerSku", () => {
    seedScenarioById("launch-a-product");

    const stored = Context.instance.engine.find(Api.INVENTORY, {});
    expect(stored.length).toBeGreaterThan(0);

    for (const doc of stored) {
      const record = doc as Record<string, unknown>;
      expect(typeof record.sellerSku).toBe("string");
      expect(record._key).toBe(record.sellerSku);
    }
  });
});
