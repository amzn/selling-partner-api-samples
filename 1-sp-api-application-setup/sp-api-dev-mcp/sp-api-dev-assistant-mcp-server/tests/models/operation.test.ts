import { describe, it, expect } from "vitest";
import {
  Operation,
  RateLimit,
  isOperation,
  isRateLimit,
  validateOperation,
  validateRateLimit,
} from "../../src/tools/code-generation-tools/models/operation";

describe("isRateLimit", () => {
  it("should return true for valid RateLimit with requestsPerSecond", () => {
    const rateLimit: RateLimit = { requestsPerSecond: 0.5 };
    expect(isRateLimit(rateLimit)).toBe(true);
  });

  it("should return true for valid RateLimit with requestsPerMinute", () => {
    const rateLimit: RateLimit = { requestsPerMinute: 30 };
    expect(isRateLimit(rateLimit)).toBe(true);
  });

  it("should return true for valid RateLimit with both fields", () => {
    const rateLimit: RateLimit = {
      requestsPerSecond: 0.5,
      requestsPerMinute: 30,
    };
    expect(isRateLimit(rateLimit)).toBe(true);
  });

  it("should return false for RateLimit with no fields", () => {
    const rateLimit = {};
    expect(isRateLimit(rateLimit)).toBe(false);
  });

  it("should return false for RateLimit with zero requestsPerSecond", () => {
    const rateLimit = { requestsPerSecond: 0 };
    expect(isRateLimit(rateLimit)).toBe(false);
  });

  it("should return false for RateLimit with negative requestsPerSecond", () => {
    const rateLimit = { requestsPerSecond: -1 };
    expect(isRateLimit(rateLimit)).toBe(false);
  });

  it("should return false for RateLimit with non-number requestsPerSecond", () => {
    const rateLimit = { requestsPerSecond: "0.5" };
    expect(isRateLimit(rateLimit)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isRateLimit(null)).toBe(false);
  });

  it("should return false for non-object", () => {
    expect(isRateLimit("not an object")).toBe(false);
  });
});

describe("validateRateLimit", () => {
  it("should return no errors for valid RateLimit with requestsPerSecond", () => {
    const rateLimit: RateLimit = { requestsPerSecond: 0.5 };
    const errors = validateRateLimit(rateLimit);
    expect(errors).toEqual([]);
  });

  it("should return no errors for valid RateLimit with requestsPerMinute", () => {
    const rateLimit: RateLimit = { requestsPerMinute: 30 };
    const errors = validateRateLimit(rateLimit);
    expect(errors).toEqual([]);
  });

  it("should return no errors for valid RateLimit with both fields", () => {
    const rateLimit: RateLimit = {
      requestsPerSecond: 0.5,
      requestsPerMinute: 30,
    };
    const errors = validateRateLimit(rateLimit);
    expect(errors).toEqual([]);
  });

  it("should return error for RateLimit with no fields", () => {
    const rateLimit = {};
    const errors = validateRateLimit(rateLimit);
    expect(errors).toContain(
      "RateLimit must have at least one of requestsPerSecond or requestsPerMinute",
    );
  });

  it("should return error for RateLimit with zero requestsPerSecond", () => {
    const rateLimit = { requestsPerSecond: 0 };
    const errors = validateRateLimit(rateLimit);
    expect(errors).toContain(
      "RateLimit requestsPerSecond must be a positive number",
    );
  });

  it("should return error for RateLimit with negative requestsPerSecond", () => {
    const rateLimit = { requestsPerSecond: -1 };
    const errors = validateRateLimit(rateLimit);
    expect(errors).toContain(
      "RateLimit requestsPerSecond must be a positive number",
    );
  });

  it("should return error for RateLimit with non-number requestsPerSecond", () => {
    const rateLimit = { requestsPerSecond: "0.5" };
    const errors = validateRateLimit(rateLimit);
    expect(errors).toContain("RateLimit requestsPerSecond must be a number");
  });

  it("should return error for null", () => {
    const errors = validateRateLimit(null);
    expect(errors).toContain("RateLimit must be an object");
  });

  it("should return error for non-object", () => {
    const errors = validateRateLimit("not an object");
    expect(errors).toContain("RateLimit must be an object");
  });
});

describe("isOperation", () => {
  const validOperation: Operation = {
    name: "getOrder",
    description: "Get order details",
    callMethod: "GET /orders/{orderId}",
    returnedModel: "Order",
    rateLimit: null,
  };

  it("should return true for valid Operation with null rateLimit", () => {
    expect(isOperation(validOperation)).toBe(true);
  });

  it("should return true for valid Operation with valid rateLimit", () => {
    const operation: Operation = {
      ...validOperation,
      rateLimit: { requestsPerSecond: 0.5 },
    };
    expect(isOperation(operation)).toBe(true);
  });

  it("should return true for valid Operation with both rate limit fields", () => {
    const operation: Operation = {
      ...validOperation,
      rateLimit: { requestsPerSecond: 0.5, requestsPerMinute: 30 },
    };
    expect(isOperation(operation)).toBe(true);
  });

  it("should return false for Operation with invalid rateLimit", () => {
    const operation = {
      ...validOperation,
      rateLimit: { requestsPerSecond: 0 },
    };
    expect(isOperation(operation)).toBe(false);
  });

  it("should return false for Operation with rateLimit as non-object", () => {
    const operation = {
      ...validOperation,
      rateLimit: "invalid",
    };
    expect(isOperation(operation)).toBe(false);
  });

  it("should return false for Operation missing rateLimit field", () => {
    const operation = {
      name: "getOrder",
      description: "Get order details",
      callMethod: "GET /orders/{orderId}",
      returnedModel: "Order",
    };
    expect(isOperation(operation)).toBe(false);
  });

  it("should return true for Operation with inputParameters and valid rateLimit", () => {
    const operation: Operation = {
      ...validOperation,
      inputParameters: [
        {
          name: "orderId",
          description: "The order ID",
          type: "string",
          required: true,
        },
      ],
      rateLimit: { requestsPerSecond: 1 },
    };
    expect(isOperation(operation)).toBe(true);
  });
});

describe("validateOperation", () => {
  const validOperation: Operation = {
    name: "getOrder",
    description: "Get order details",
    callMethod: "GET /orders/{orderId}",
    returnedModel: "Order",
    rateLimit: null,
  };

  it("should return no errors for valid Operation with null rateLimit", () => {
    const errors = validateOperation(validOperation);
    expect(errors).toEqual([]);
  });

  it("should return no errors for valid Operation with valid rateLimit", () => {
    const operation: Operation = {
      ...validOperation,
      rateLimit: { requestsPerSecond: 0.5 },
    };
    const errors = validateOperation(operation);
    expect(errors).toEqual([]);
  });

  it("should return no errors for valid Operation with both rate limit fields", () => {
    const operation: Operation = {
      ...validOperation,
      rateLimit: { requestsPerSecond: 0.5, requestsPerMinute: 30 },
    };
    const errors = validateOperation(operation);
    expect(errors).toEqual([]);
  });

  it("should return errors for Operation with invalid rateLimit structure", () => {
    const operation = {
      ...validOperation,
      rateLimit: { requestsPerSecond: 0 },
    };
    const errors = validateOperation(operation);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("RateLimit"))).toBe(true);
  });

  it("should return errors for Operation with rateLimit missing required fields", () => {
    const operation = {
      ...validOperation,
      rateLimit: {},
    };
    const errors = validateOperation(operation);
    expect(errors).toContain(
      "RateLimit: RateLimit must have at least one of requestsPerSecond or requestsPerMinute",
    );
  });

  it("should return errors for Operation with negative rate limit", () => {
    const operation = {
      ...validOperation,
      rateLimit: { requestsPerSecond: -1 },
    };
    const errors = validateOperation(operation);
    expect(errors).toContain(
      "RateLimit: RateLimit requestsPerSecond must be a positive number",
    );
  });

  it("should return no errors when rateLimit is undefined", () => {
    const operation = {
      name: "getOrder",
      description: "Get order details",
      callMethod: "GET /orders/{orderId}",
      returnedModel: "Order",
      rateLimit: undefined,
    };
    const errors = validateOperation(operation);
    expect(errors).toEqual([]);
  });

  it("should validate all Operation fields including rateLimit", () => {
    const operation = {
      name: "",
      description: 123,
      callMethod: "",
      returnedModel: "",
      rateLimit: { requestsPerSecond: 0 },
    };
    const errors = validateOperation(operation);
    expect(errors.length).toBeGreaterThan(4); // Should have errors for all invalid fields
    expect(errors.some((e) => e.includes("name"))).toBe(true);
    expect(errors.some((e) => e.includes("description"))).toBe(true);
    expect(errors.some((e) => e.includes("callMethod"))).toBe(true);
    expect(errors.some((e) => e.includes("returnedModel"))).toBe(true);
    expect(errors.some((e) => e.includes("RateLimit"))).toBe(true);
  });
});
