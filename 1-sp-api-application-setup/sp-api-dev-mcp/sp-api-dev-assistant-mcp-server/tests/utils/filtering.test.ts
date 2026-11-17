import { describe, it, expect } from "vitest";
import {
  parseFilterString,
  filterByNames,
  projectFields,
  validateFields,
} from "../../src/utils/filtering";

describe("parseFilterString", () => {
  it("should parse comma-separated values", () => {
    const result = parseFilterString("value1,value2,value3");
    expect(result).toEqual(["value1", "value2", "value3"]);
  });

  it("should handle whitespace around values", () => {
    const result = parseFilterString("value1 , value2 , value3");
    expect(result).toEqual(["value1", "value2", "value3"]);
  });

  it("should handle single value", () => {
    const result = parseFilterString("singleValue");
    expect(result).toEqual(["singleValue"]);
  });

  it("should handle empty string", () => {
    const result = parseFilterString("");
    expect(result).toEqual([]);
  });

  it("should handle whitespace-only string", () => {
    const result = parseFilterString("   ");
    expect(result).toEqual([]);
  });

  it("should filter out empty values between commas", () => {
    const result = parseFilterString("value1,,value2");
    expect(result).toEqual(["value1", "value2"]);
  });
});

describe("filterByNames", () => {
  const items = [
    { name: "GetOrder", id: 1 },
    { name: "ListOrders", id: 2 },
    { name: "CreateOrder", id: 3 },
    { name: "UpdateOrder", id: 4 },
  ];

  it("should filter items by exact name match", () => {
    const result = filterByNames(items, ["GetOrder", "ListOrders"]);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(["GetOrder", "ListOrders"]);
  });

  it("should perform case-insensitive matching", () => {
    const result = filterByNames(items, ["getorder", "LISTORDERS"]);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(["GetOrder", "ListOrders"]);
  });

  it("should return empty array when no matches found", () => {
    const result = filterByNames(items, ["NonExistent"]);
    expect(result).toEqual([]);
  });

  it("should return all items when names array is empty", () => {
    const result = filterByNames(items, []);
    expect(result).toEqual(items);
  });

  it("should handle mixed case in filter names", () => {
    const result = filterByNames(items, [
      "GetOrder",
      "listorders",
      "CREATEORDER",
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.name)).toEqual([
      "GetOrder",
      "ListOrders",
      "CreateOrder",
    ]);
  });
});

describe("projectFields", () => {
  const validFields = ["name", "description", "id", "type"];
  const item = {
    name: "TestItem",
    description: "A test item",
    id: 123,
    type: "test",
    internal: "should not appear",
  };

  it("should project only specified valid fields", () => {
    const result = projectFields(item, ["name", "id"], validFields);
    expect(result).toEqual({ name: "TestItem", id: 123 });
  });

  it("should ignore invalid fields", () => {
    const result = projectFields(item, ["name", "invalid"], validFields);
    expect(result).toEqual({ name: "TestItem" });
  });

  it("should return empty object when no valid fields specified", () => {
    const result = projectFields(item, ["invalid1", "invalid2"], validFields);
    expect(result).toEqual({});
  });

  it("should handle all valid fields", () => {
    const result = projectFields(
      item,
      ["name", "description", "id", "type"],
      validFields,
    );
    expect(result).toEqual({
      name: "TestItem",
      description: "A test item",
      id: 123,
      type: "test",
    });
  });

  it("should not include fields not in validFields even if in item", () => {
    const result = projectFields(item, ["name", "internal"], validFields);
    expect(result).toEqual({ name: "TestItem" });
    expect(result).not.toHaveProperty("internal");
  });
});

describe("validateFields", () => {
  const validFields = ["name", "description", "id", "type"];

  it("should return valid true when all fields are valid", () => {
    const result = validateFields(["name", "description"], validFields);
    expect(result.valid).toBe(true);
    expect(result.invalidFields).toEqual([]);
  });

  it("should return valid false when some fields are invalid", () => {
    const result = validateFields(["name", "invalid"], validFields);
    expect(result.valid).toBe(false);
    expect(result.invalidFields).toEqual(["invalid"]);
  });

  it("should return all invalid fields", () => {
    const result = validateFields(
      ["invalid1", "name", "invalid2"],
      validFields,
    );
    expect(result.valid).toBe(false);
    expect(result.invalidFields).toEqual(["invalid1", "invalid2"]);
  });

  it("should return valid true for empty fields array", () => {
    const result = validateFields([], validFields);
    expect(result.valid).toBe(true);
    expect(result.invalidFields).toEqual([]);
  });

  it("should return valid false when all fields are invalid", () => {
    const result = validateFields(["invalid1", "invalid2"], validFields);
    expect(result.valid).toBe(false);
    expect(result.invalidFields).toEqual(["invalid1", "invalid2"]);
  });
});
