import { describe, it, expect, beforeEach } from "vitest";
import { Api, Context } from "../../src/database/Context.js";
import { resourceRetrievalTool } from "../../src/tool/resourceRetrievalTool.js";
import { databaseInsertionTool } from "../../src/tool/databaseInsertionTool.js";
import { databaseRemovalTool } from "../../src/tool/databaseRemovalTool.js";
import { databaseLookupTool } from "../../src/tool/databaseLookupTool.js";

describe("Tool Schemas Zod Validation", () => {
  beforeEach(async () => {
    await Context.instance.clear();
  });

  describe("resourceRetrievalTool schema", () => {
    it("validates valid Api enum inputs", async () => {
      const result = await resourceRetrievalTool.invoke({ api: Api.ORDERS });
      expect(result).toBeDefined();
    });

    it("rejects invalid Api inputs", async () => {
      await expect(resourceRetrievalTool.invoke({ api: "invalid_api" as any })).rejects.toThrow();
    });
  });

  describe("databaseInsertionTool schema", () => {
    it("validates valid insertion payload", async () => {
      const input = { api: Api.LISTINGS, id: "SKU-100", entity: { title: "Test Item" } };
      const result = await databaseInsertionTool.invoke(input);
      expect(result).toBe("Success");
    });
  });

  describe("databaseRemovalTool schema", () => {
    it("validates removal payload", async () => {
      const input = { api: Api.INVENTORY, id: "INV-1" };
      const result = await databaseRemovalTool.invoke(input);
      expect(result).toBeDefined();
    });
  });

  describe("databaseLookupTool schema", () => {
    it("validates lookup payload", async () => {
      const input = { api: Api.CATALOG, asin: "B0F4X2K9LM" };
      const result = await databaseLookupTool.invoke(input);
      expect(result).toContain("B0F4X2K9LM");
    });
  });
});
