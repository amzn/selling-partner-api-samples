import { describe, it, expect } from "vitest";
import { filterCatalogItem, INCLUDED_DATA_CATEGORIES, paginate } from "../../src/operation/catalogItemsOperations.js";
import { encodePageToken, decodePageToken } from "../../src/service/Paginator.js";

describe("filterCatalogItem", () => {
  const fullItem: Record<string, unknown> = {
    asin: "B08N5WRWNW",
    summaries: [{ itemName: "Test Product", brand: "TestBrand" }],
    attributes: { color: "blue" },
    classifications: [{ classificationId: "123" }],
    dimensions: [{ height: { value: 10, unit: "inches" } }],
    identifiers: [{ identifiers: [{ identifierType: "EAN", identifier: "12345" }] }],
    images: [{ images: [{ link: "https://example.com/img.jpg" }] }],
    productTypes: [{ productType: "SHOES" }],
    relationships: [{ type: "VARIATION" }],
    salesRanks: [{ classificationId: "123", rank: 5 }],
    vendorDetails: [{ vendorCode: "ABC" }],
  };

  it("always includes asin in the output", () => {
    const result = filterCatalogItem(fullItem, []);
    expect(result).toHaveProperty("asin", "B08N5WRWNW");
  });

  it("includes only requested data categories plus asin", () => {
    const result = filterCatalogItem(fullItem, ["summaries"]);
    expect(result).toEqual({
      asin: "B08N5WRWNW",
      summaries: [{ itemName: "Test Product", brand: "TestBrand" }],
    });
  });

  it("includes multiple requested categories", () => {
    const result = filterCatalogItem(fullItem, ["summaries", "images", "dimensions"]);
    expect(Object.keys(result).sort()).toEqual(["asin", "dimensions", "images", "summaries"]);
  });

  it("silently skips categories not present on the item", () => {
    const partialItem = { asin: "B000000001", summaries: [{ itemName: "Partial" }] };
    const result = filterCatalogItem(partialItem, ["summaries", "vendorDetails", "classifications"]);
    expect(result).toEqual({
      asin: "B000000001",
      summaries: [{ itemName: "Partial" }],
    });
  });

  it("omits keys not in includedData (except asin)", () => {
    const result = filterCatalogItem(fullItem, ["images"]);
    expect(result).toEqual({
      asin: "B08N5WRWNW",
      images: [{ images: [{ link: "https://example.com/img.jpg" }] }],
    });
    expect(result).not.toHaveProperty("summaries");
    expect(result).not.toHaveProperty("attributes");
  });

  it("returns only asin when includedData is empty", () => {
    const result = filterCatalogItem(fullItem, []);
    expect(result).toEqual({ asin: "B08N5WRWNW" });
  });

  it("handles item with no asin field gracefully", () => {
    const noAsinItem = { summaries: [{ itemName: "No ASIN" }] };
    const result = filterCatalogItem(noAsinItem, ["summaries"]);
    expect(result).toEqual({ summaries: [{ itemName: "No ASIN" }] });
    expect(result).not.toHaveProperty("asin");
  });

  it("exports INCLUDED_DATA_CATEGORIES with all 10 valid categories", () => {
    expect(INCLUDED_DATA_CATEGORIES).toHaveLength(10);
    expect(INCLUDED_DATA_CATEGORIES).toContain("summaries");
    expect(INCLUDED_DATA_CATEGORIES).toContain("attributes");
    expect(INCLUDED_DATA_CATEGORIES).toContain("classifications");
    expect(INCLUDED_DATA_CATEGORIES).toContain("dimensions");
    expect(INCLUDED_DATA_CATEGORIES).toContain("identifiers");
    expect(INCLUDED_DATA_CATEGORIES).toContain("images");
    expect(INCLUDED_DATA_CATEGORIES).toContain("productTypes");
    expect(INCLUDED_DATA_CATEGORIES).toContain("relationships");
    expect(INCLUDED_DATA_CATEGORIES).toContain("salesRanks");
    expect(INCLUDED_DATA_CATEGORIES).toContain("vendorDetails");
  });
});

describe("encodePageToken", () => {
  it("encodes an offset into a base64 JSON string", () => {
    const token = encodePageToken(10);
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    expect(decoded).toEqual({ offset: 10 });
  });

  it("encodes offset 0", () => {
    const token = encodePageToken(0);
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    expect(decoded).toEqual({ offset: 0 });
  });
});

describe("decodePageToken", () => {
  it("decodes a valid token to the offset number", () => {
    const token = Buffer.from(JSON.stringify({ offset: 15 })).toString("base64");
    expect(decodePageToken(token)).toBe(15);
  });

  it("returns null for invalid base64", () => {
    expect(decodePageToken("not-valid-base64!!!")).toBeNull();
  });

  it("returns null for valid base64 but invalid JSON", () => {
    const token = Buffer.from("not json").toString("base64");
    expect(decodePageToken(token)).toBeNull();
  });

  it("returns null when offset is missing from parsed object", () => {
    const token = Buffer.from(JSON.stringify({ foo: 5 })).toString("base64");
    expect(decodePageToken(token)).toBeNull();
  });

  it("returns null when offset is negative", () => {
    const token = Buffer.from(JSON.stringify({ offset: -1 })).toString("base64");
    expect(decodePageToken(token)).toBeNull();
  });

  it("returns null when offset is not a number", () => {
    const token = Buffer.from(JSON.stringify({ offset: "abc" })).toString("base64");
    expect(decodePageToken(token)).toBeNull();
  });

  it("roundtrips with encodePageToken", () => {
    expect(decodePageToken(encodePageToken(42))).toBe(42);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));

  it("returns the first page with default pageSize of 10", () => {
    const result = paginate(items, 0);
    expect(result.page).toHaveLength(10);
    expect(result.numberOfResults).toBe(25);
    expect(result.nextToken).toBeDefined();
    expect(result.previousToken).toBeUndefined();
  });

  it("caps pageSize at 20", () => {
    const result = paginate(items, 50);
    expect(result.page).toHaveLength(20);
  });

  it("respects pageSize within bounds", () => {
    const result = paginate(items, 5);
    expect(result.page).toHaveLength(5);
    expect(result.page).toEqual(items.slice(0, 5));
  });

  it("includes nextToken when more items exist", () => {
    const result = paginate(items, 10);
    expect(result.nextToken).toBeDefined();
    const nextOffset = decodePageToken(result.nextToken!);
    expect(nextOffset).toBe(10);
  });

  it("does not include nextToken when on last page", () => {
    const token = encodePageToken(20);
    const result = paginate(items, 10, token);
    expect(result.page).toHaveLength(5);
    expect(result.nextToken).toBeUndefined();
  });

  it("includes previousToken when offset > 0", () => {
    const token = encodePageToken(10);
    const result = paginate(items, 10, token);
    expect(result.previousToken).toBeDefined();
    const prevOffset = decodePageToken(result.previousToken!);
    expect(prevOffset).toBe(0);
  });

  it("does not include previousToken on first page", () => {
    const result = paginate(items, 10);
    expect(result.previousToken).toBeUndefined();
  });

  it("returns empty page for invalid pageToken", () => {
    const result = paginate(items, 10, "invalid-token");
    expect(result.page).toEqual([]);
    expect(result.numberOfResults).toBe(25);
  });

  it("returns empty page when offset >= items length", () => {
    const token = encodePageToken(100);
    const result = paginate(items, 10, token);
    expect(result.page).toEqual([]);
    expect(result.numberOfResults).toBe(25);
  });

  it("handles empty items array", () => {
    const result = paginate([], 10);
    expect(result.page).toEqual([]);
    expect(result.numberOfResults).toBe(0);
    expect(result.nextToken).toBeUndefined();
    expect(result.previousToken).toBeUndefined();
  });
});
