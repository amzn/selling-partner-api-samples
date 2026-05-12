import { describe, it, expect } from "vitest";
import { Operation } from "../../src/tools/code-generation-tools/models/operation";
import { Model } from "../../src/tools/code-generation-tools/models/model";
import {
  OperationsFilterParams,
  ModelsFilterParams,
  VALID_OPERATION_FIELDS,
  VALID_MODEL_FIELDS,
} from "../../src/tools/code-generation-tools/models/filters";
import {
  parseFilterString,
  filterByNames,
  projectFields,
  validateFields,
} from "../../src/utils/filtering";
import { ErrorHandlingUtils } from "../../src/utils/error-handling";

describe("DiscoveryService - Filtering Logic", () => {
  const mockOperations: Operation[] = [
    {
      name: "getOrder",
      description: "Get order details",
      callMethod: "GET",
      returnedModel: "Order",
      rateLimit: { requestsPerSecond: 0.5 },
    },
    {
      name: "listOrders",
      description: "List all orders",
      callMethod: "GET",
      returnedModel: "OrderList",
      rateLimit: null,
    },
    {
      name: "createOrder",
      description: "Create a new order",
      callMethod: "POST",
      returnedModel: "Order",
      rateLimit: { requestsPerMinute: 10 },
    },
  ];

  const mockModels: Model[] = [
    {
      name: "Order",
      swaggerType: { id: "string", total: "number" },
      attributeMap: { id: "id", total: "total" },
      isEnum: false,
    },
    {
      name: "OrderStatus",
      swaggerType: { value: "string" },
      attributeMap: { value: "value" },
      isEnum: true,
      enumValues: ["pending", "shipped", "delivered"],
    },
    {
      name: "OrderItem",
      swaggerType: { sku: "string", quantity: "number" },
      attributeMap: { sku: "sku", quantity: "quantity" },
      isEnum: false,
    },
  ];

  describe("filterOperations - name filtering", () => {
    it("should filter operations by single name", () => {
      const filterParams: OperationsFilterParams = {
        operations: "getOrder",
      };

      const operationNames = parseFilterString(filterParams.operations!);
      const filtered = filterByNames(mockOperations, operationNames);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("getOrder");
    });

    it("should filter operations by multiple names", () => {
      const filterParams: OperationsFilterParams = {
        operations: "getOrder,listOrders",
      };

      const operationNames = parseFilterString(filterParams.operations!);
      const filtered = filterByNames(mockOperations, operationNames);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((op) => op.name)).toEqual(["getOrder", "listOrders"]);
    });

    it("should perform case-insensitive name filtering", () => {
      const filterParams: OperationsFilterParams = {
        operations: "GETORDER,listorders",
      };

      const operationNames = parseFilterString(filterParams.operations!);
      const filtered = filterByNames(mockOperations, operationNames);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((op) => op.name)).toEqual(["getOrder", "listOrders"]);
    });

    it("should return empty array when no operations match filter", () => {
      const filterParams: OperationsFilterParams = {
        operations: "nonExistentOperation",
      };

      const operationNames = parseFilterString(filterParams.operations!);
      const filtered = filterByNames(mockOperations, operationNames);

      expect(filtered).toHaveLength(0);
    });

    it("should return all operations when no filter is provided", () => {
      const filtered = filterByNames(mockOperations, []);

      expect(filtered).toHaveLength(3);
    });
  });

  describe("filterModels - name filtering", () => {
    it("should filter models by single name", () => {
      const filterParams: ModelsFilterParams = {
        models: "Order",
      };

      const modelNames = parseFilterString(filterParams.models!);
      const filtered = filterByNames(mockModels, modelNames);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Order");
    });

    it("should filter models by multiple names", () => {
      const filterParams: ModelsFilterParams = {
        models: "Order,OrderStatus",
      };

      const modelNames = parseFilterString(filterParams.models!);
      const filtered = filterByNames(mockModels, modelNames);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((m) => m.name)).toEqual(["Order", "OrderStatus"]);
    });

    it("should perform case-insensitive name filtering", () => {
      const filterParams: ModelsFilterParams = {
        models: "order,ORDERSTATUS",
      };

      const modelNames = parseFilterString(filterParams.models!);
      const filtered = filterByNames(mockModels, modelNames);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((m) => m.name)).toEqual(["Order", "OrderStatus"]);
    });

    it("should return empty array when no models match filter", () => {
      const filterParams: ModelsFilterParams = {
        models: "NonExistentModel",
      };

      const modelNames = parseFilterString(filterParams.models!);
      const filtered = filterByNames(mockModels, modelNames);

      expect(filtered).toHaveLength(0);
    });

    it("should return all models when no filter is provided", () => {
      const filtered = filterByNames(mockModels, []);

      expect(filtered).toHaveLength(3);
    });
  });

  describe("projectOperationFields", () => {
    it("should project only specified fields", () => {
      const filterParams: OperationsFilterParams = {
        included_data: "name,description",
      };

      const includedFields = parseFilterString(filterParams.included_data!);
      const projected = mockOperations.map((op) =>
        projectFields(op, includedFields, Array.from(VALID_OPERATION_FIELDS)),
      );

      expect(projected).toHaveLength(3);
      projected.forEach((item) => {
        expect(item).toHaveProperty("name");
        expect(item).toHaveProperty("description");
        expect(item).not.toHaveProperty("callMethod");
        expect(item).not.toHaveProperty("returnedModel");
        expect(item).not.toHaveProperty("rateLimit");
      });
    });

    it("should project single field", () => {
      const filterParams: OperationsFilterParams = {
        included_data: "name",
      };

      const includedFields = parseFilterString(filterParams.included_data!);
      const projected = mockOperations.map((op) =>
        projectFields(op, includedFields, Array.from(VALID_OPERATION_FIELDS)),
      );

      expect(projected).toHaveLength(3);
      projected.forEach((item) => {
        expect(item).toHaveProperty("name");
        expect(Object.keys(item)).toHaveLength(1);
      });
    });

    it("should validate and reject invalid field names", () => {
      const filterParams: OperationsFilterParams = {
        included_data: "name,invalidField",
      };

      const includedFields = parseFilterString(filterParams.included_data!);
      const validation = validateFields(
        includedFields,
        Array.from(VALID_OPERATION_FIELDS),
      );

      expect(validation.valid).toBe(false);
      expect(validation.invalidFields).toContain("invalidField");
    });

    it("should handle whitespace in field names", () => {
      const filterParams: OperationsFilterParams = {
        included_data: "name , description , rateLimit",
      };

      const includedFields = parseFilterString(filterParams.included_data!);
      const projected = mockOperations.map((op) =>
        projectFields(op, includedFields, Array.from(VALID_OPERATION_FIELDS)),
      );

      expect(projected).toHaveLength(3);
      projected.forEach((item) => {
        expect(item).toHaveProperty("name");
        expect(item).toHaveProperty("description");
        expect(item).toHaveProperty("rateLimit");
        expect(Object.keys(item)).toHaveLength(3);
      });
    });
  });

  describe("projectModelFields", () => {
    it("should project only specified fields", () => {
      const filterParams: ModelsFilterParams = {
        included_data: "name,isEnum",
      };

      const includedFields = parseFilterString(filterParams.included_data!);
      const projected = mockModels.map((model) =>
        projectFields(model, includedFields, Array.from(VALID_MODEL_FIELDS)),
      );

      expect(projected).toHaveLength(3);
      projected.forEach((item) => {
        expect(item).toHaveProperty("name");
        expect(item).toHaveProperty("isEnum");
        expect(item).not.toHaveProperty("swaggerType");
        expect(item).not.toHaveProperty("attributeMap");
      });
    });

    it("should project single field", () => {
      const filterParams: ModelsFilterParams = {
        included_data: "name",
      };

      const includedFields = parseFilterString(filterParams.included_data!);
      const projected = mockModels.map((model) =>
        projectFields(model, includedFields, Array.from(VALID_MODEL_FIELDS)),
      );

      expect(projected).toHaveLength(3);
      projected.forEach((item) => {
        expect(item).toHaveProperty("name");
        expect(Object.keys(item)).toHaveLength(1);
      });
    });

    it("should validate and reject invalid field names", () => {
      const filterParams: ModelsFilterParams = {
        included_data: "name,invalidField",
      };

      const includedFields = parseFilterString(filterParams.included_data!);
      const validation = validateFields(
        includedFields,
        Array.from(VALID_MODEL_FIELDS),
      );

      expect(validation.valid).toBe(false);
      expect(validation.invalidFields).toContain("invalidField");
    });

    it("should handle whitespace in field names", () => {
      const filterParams: ModelsFilterParams = {
        included_data: "name , swaggerType , isEnum",
      };

      const includedFields = parseFilterString(filterParams.included_data!);
      const projected = mockModels.map((model) =>
        projectFields(model, includedFields, Array.from(VALID_MODEL_FIELDS)),
      );

      expect(projected).toHaveLength(3);
      projected.forEach((item) => {
        expect(item).toHaveProperty("name");
        expect(item).toHaveProperty("swaggerType");
        expect(item).toHaveProperty("isEnum");
        expect(Object.keys(item)).toHaveLength(3);
      });
    });
  });

  describe("combined filtering and projection", () => {
    it("should filter by name and project fields for operations", () => {
      const filterParams: OperationsFilterParams = {
        operations: "getOrder,listOrders",
        included_data: "name,description",
      };

      const operationNames = parseFilterString(filterParams.operations!);
      const filtered = filterByNames(mockOperations, operationNames);

      const includedFields = parseFilterString(filterParams.included_data!);
      const projected = filtered.map((op) =>
        projectFields(op, includedFields, Array.from(VALID_OPERATION_FIELDS)),
      );

      expect(projected).toHaveLength(2);
      projected.forEach((item) => {
        expect(item).toHaveProperty("name");
        expect(item).toHaveProperty("description");
        expect(Object.keys(item)).toHaveLength(2);
      });
    });

    it("should filter by name and project fields for models", () => {
      const filterParams: ModelsFilterParams = {
        models: "Order,OrderStatus",
        included_data: "name,isEnum",
      };

      const modelNames = parseFilterString(filterParams.models!);
      const filtered = filterByNames(mockModels, modelNames);

      const includedFields = parseFilterString(filterParams.included_data!);
      const projected = filtered.map((model) =>
        projectFields(model, includedFields, Array.from(VALID_MODEL_FIELDS)),
      );

      expect(projected).toHaveLength(2);
      projected.forEach((item) => {
        expect(item).toHaveProperty("name");
        expect(item).toHaveProperty("isEnum");
        expect(Object.keys(item)).toHaveLength(2);
      });
    });
  });

  describe("error handling for invalid fields", () => {
    it("should provide clear error message for invalid operation fields", () => {
      const includedFields = ["name", "invalidField", "anotherInvalid"];
      const validation = validateFields(
        includedFields,
        Array.from(VALID_OPERATION_FIELDS),
      );

      expect(validation.valid).toBe(false);
      expect(validation.invalidFields).toEqual([
        "invalidField",
        "anotherInvalid",
      ]);

      // Simulate error creation as done in DiscoveryService
      try {
        if (!validation.valid) {
          throw ErrorHandlingUtils.createError(
            "INVALID_PARAMETER" as any,
            `Invalid fields: ${validation.invalidFields.join(", ")}. Valid fields are: ${VALID_OPERATION_FIELDS.join(", ")}`,
            {
              invalidFields: validation.invalidFields,
              validFields: VALID_OPERATION_FIELDS,
            },
          );
        }
      } catch (error: any) {
        expect(error.message).toContain(
          "Invalid fields: invalidField, anotherInvalid",
        );
        expect(error.message).toContain("Valid fields are:");
      }
    });

    it("should provide clear error message for invalid model fields", () => {
      const includedFields = ["name", "invalidField"];
      const validation = validateFields(
        includedFields,
        Array.from(VALID_MODEL_FIELDS),
      );

      expect(validation.valid).toBe(false);
      expect(validation.invalidFields).toEqual(["invalidField"]);

      // Simulate error creation as done in DiscoveryService
      try {
        if (!validation.valid) {
          throw ErrorHandlingUtils.createError(
            "INVALID_PARAMETER" as any,
            `Invalid fields: ${validation.invalidFields.join(", ")}. Valid fields are: ${VALID_MODEL_FIELDS.join(", ")}`,
            {
              invalidFields: validation.invalidFields,
              validFields: VALID_MODEL_FIELDS,
            },
          );
        }
      } catch (error: any) {
        expect(error.message).toContain("Invalid fields: invalidField");
        expect(error.message).toContain("Valid fields are:");
      }
    });
  });
});
