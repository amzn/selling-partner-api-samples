import { describe, it, expect } from "vitest";
import {
  cloneRepoSchema,
  getBasicUsageSchema,
  getCategoriesSchema,
  getOperationsSchema,
  getModelsSchema,
} from "../../src/zod-schemas/code-generation-schemas";

describe("Code Generation Schemas", () => {
  describe("cloneRepoSchema", () => {
    describe("valid inputs", () => {
      it("should validate with no parameters", () => {
        const result = cloneRepoSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it("should validate with repositoryUrl only", () => {
        const validData = {
          repositoryUrl: "https://github.com/example/repo.git",
        };
        const result = cloneRepoSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.repositoryUrl).toBe(
            "https://github.com/example/repo.git",
          );
        }
      });

      it("should validate with targetPath only", () => {
        const validData = {
          targetPath: "./custom-path",
        };
        const result = cloneRepoSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.targetPath).toBe("./custom-path");
        }
      });

      it("should validate with both parameters", () => {
        const validData = {
          repositoryUrl: "https://github.com/example/repo.git",
          targetPath: "./custom-path",
        };
        const result = cloneRepoSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe("invalid inputs", () => {
      it("should reject invalid URL format", () => {
        const invalidData = {
          repositoryUrl: "not-a-url",
        };
        const result = cloneRepoSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject non-string repositoryUrl", () => {
        const invalidData = {
          repositoryUrl: 123,
        };
        const result = cloneRepoSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject non-string targetPath", () => {
        const invalidData = {
          targetPath: 123,
        };
        const result = cloneRepoSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("getBasicUsageSchema", () => {
    describe("valid inputs", () => {
      it("should validate with python language", () => {
        const validData = { language: "python" };
        const result = getBasicUsageSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.language).toBe("python");
        }
      });

      it("should validate with java language", () => {
        const validData = { language: "java" };
        const result = getBasicUsageSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should validate with javascript language", () => {
        const validData = { language: "javascript" };
        const result = getBasicUsageSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should validate with php language", () => {
        const validData = { language: "php" };
        const result = getBasicUsageSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should validate with csharp language", () => {
        const validData = { language: "csharp" };
        const result = getBasicUsageSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe("invalid inputs", () => {
      it("should reject invalid language", () => {
        const invalidData = { language: "ruby" };
        const result = getBasicUsageSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject missing language", () => {
        const invalidData = {};
        const result = getBasicUsageSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject non-string language", () => {
        const invalidData = { language: 123 };
        const result = getBasicUsageSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("getCategoriesSchema", () => {
    describe("valid inputs", () => {
      it("should validate with valid language", () => {
        const validData = { language: "python" };
        const result = getCategoriesSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe("invalid inputs", () => {
      it("should reject invalid language", () => {
        const invalidData = { language: "invalid" };
        const result = getCategoriesSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject missing language", () => {
        const invalidData = {};
        const result = getCategoriesSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("getOperationsSchema", () => {
    describe("valid inputs", () => {
      it("should validate with required parameters only", () => {
        const validData = {
          language: "python",
          filePath: "path/to/operations.py",
        };
        const result = getOperationsSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.page).toBe(1);
          expect(result.data.pageSize).toBe(50);
        }
      });

      it("should validate with pagination parameters", () => {
        const validData = {
          language: "python",
          filePath: "path/to/operations.py",
          page: 2,
          pageSize: 25,
        };
        const result = getOperationsSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.page).toBe(2);
          expect(result.data.pageSize).toBe(25);
        }
      });

      it("should validate with optional filter parameters", () => {
        const validData = {
          language: "python",
          filePath: "path/to/operations.py",
          operations: "getOrder,listOrders",
          includedData: "name,description",
        };
        const result = getOperationsSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should validate with all parameters", () => {
        const validData = {
          language: "python",
          filePath: "path/to/operations.py",
          page: 1,
          pageSize: 100,
          operations: "getOrder",
          includedData: "name",
        };
        const result = getOperationsSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe("invalid inputs", () => {
      it("should reject missing language", () => {
        const invalidData = {
          filePath: "path/to/operations.py",
        };
        const result = getOperationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject missing filePath", () => {
        const invalidData = {
          language: "python",
        };
        const result = getOperationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject empty filePath", () => {
        const invalidData = {
          language: "python",
          filePath: "",
        };
        const result = getOperationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject invalid language", () => {
        const invalidData = {
          language: "ruby",
          filePath: "path/to/operations.rb",
        };
        const result = getOperationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe("filter parameter validation", () => {
      it("should allow omitted operations parameter", () => {
        const validData = {
          language: "python",
          filePath: "path/to/operations.py",
        };
        const result = getOperationsSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should allow omitted includedData parameter", () => {
        const validData = {
          language: "python",
          filePath: "path/to/operations.py",
        };
        const result = getOperationsSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should reject non-string operations parameter", () => {
        const invalidData = {
          language: "python",
          filePath: "path/to/operations.py",
          operations: 123,
        };
        const result = getOperationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject non-string includedData parameter", () => {
        const invalidData = {
          language: "python",
          filePath: "path/to/operations.py",
          includedData: ["name", "description"],
        };
        const result = getOperationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject boolean operations parameter", () => {
        const invalidData = {
          language: "python",
          filePath: "path/to/operations.py",
          operations: true,
        };
        const result = getOperationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject object includedData parameter", () => {
        const invalidData = {
          language: "python",
          filePath: "path/to/operations.py",
          includedData: { name: true },
        };
        const result = getOperationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe("boundary conditions for pagination", () => {
      it("should validate page = 1", () => {
        const validData = {
          language: "python",
          filePath: "path/to/operations.py",
          page: 1,
        };
        const result = getOperationsSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should reject page = 0", () => {
        const invalidData = {
          language: "python",
          filePath: "path/to/operations.py",
          page: 0,
        };
        const result = getOperationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject negative page", () => {
        const invalidData = {
          language: "python",
          filePath: "path/to/operations.py",
          page: -1,
        };
        const result = getOperationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should validate pageSize = 1", () => {
        const validData = {
          language: "python",
          filePath: "path/to/operations.py",
          pageSize: 1,
        };
        const result = getOperationsSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should validate pageSize = 100", () => {
        const validData = {
          language: "python",
          filePath: "path/to/operations.py",
          pageSize: 100,
        };
        const result = getOperationsSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should reject pageSize = 0", () => {
        const invalidData = {
          language: "python",
          filePath: "path/to/operations.py",
          pageSize: 0,
        };
        const result = getOperationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject pageSize > 100", () => {
        const invalidData = {
          language: "python",
          filePath: "path/to/operations.py",
          pageSize: 101,
        };
        const result = getOperationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject non-integer page", () => {
        const invalidData = {
          language: "python",
          filePath: "path/to/operations.py",
          page: 1.5,
        };
        const result = getOperationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject non-integer pageSize", () => {
        const invalidData = {
          language: "python",
          filePath: "path/to/operations.py",
          pageSize: 50.5,
        };
        const result = getOperationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("getModelsSchema", () => {
    describe("valid inputs", () => {
      it("should validate with required parameters only", () => {
        const validData = {
          language: "python",
          directoryPath: "path/to/models",
        };
        const result = getModelsSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.page).toBe(1);
          expect(result.data.pageSize).toBe(50);
        }
      });

      it("should validate with pagination parameters", () => {
        const validData = {
          language: "python",
          directoryPath: "path/to/models",
          page: 3,
          pageSize: 20,
        };
        const result = getModelsSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.page).toBe(3);
          expect(result.data.pageSize).toBe(20);
        }
      });

      it("should validate with optional filter parameters", () => {
        const validData = {
          language: "python",
          directoryPath: "path/to/models",
          models: "Order,OrderItem",
          includedData: "name,swagger_type",
        };
        const result = getModelsSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should validate with all parameters", () => {
        const validData = {
          language: "python",
          directoryPath: "path/to/models",
          page: 1,
          pageSize: 100,
          models: "Order",
          includedData: "name",
        };
        const result = getModelsSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe("invalid inputs", () => {
      it("should reject missing language", () => {
        const invalidData = {
          directoryPath: "path/to/models",
        };
        const result = getModelsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject missing directoryPath", () => {
        const invalidData = {
          language: "python",
        };
        const result = getModelsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject empty directoryPath", () => {
        const invalidData = {
          language: "python",
          directoryPath: "",
        };
        const result = getModelsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject invalid language", () => {
        const invalidData = {
          language: "ruby",
          directoryPath: "path/to/models",
        };
        const result = getModelsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe("filter parameter validation", () => {
      it("should allow omitted models parameter", () => {
        const validData = {
          language: "python",
          directoryPath: "path/to/models",
        };
        const result = getModelsSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should allow omitted includedData parameter", () => {
        const validData = {
          language: "python",
          directoryPath: "path/to/models",
        };
        const result = getModelsSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should reject non-string models parameter", () => {
        const invalidData = {
          language: "python",
          directoryPath: "path/to/models",
          models: 456,
        };
        const result = getModelsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject non-string includedData parameter", () => {
        const invalidData = {
          language: "python",
          directoryPath: "path/to/models",
          includedData: ["name", "swagger_type"],
        };
        const result = getModelsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject boolean models parameter", () => {
        const invalidData = {
          language: "python",
          directoryPath: "path/to/models",
          models: false,
        };
        const result = getModelsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject object includedData parameter", () => {
        const invalidData = {
          language: "python",
          directoryPath: "path/to/models",
          includedData: { name: true },
        };
        const result = getModelsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe("boundary conditions for pagination", () => {
      it("should validate page = 1", () => {
        const validData = {
          language: "python",
          directoryPath: "path/to/models",
          page: 1,
        };
        const result = getModelsSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should reject page = 0", () => {
        const invalidData = {
          language: "python",
          directoryPath: "path/to/models",
          page: 0,
        };
        const result = getModelsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject negative page", () => {
        const invalidData = {
          language: "python",
          directoryPath: "path/to/models",
          page: -1,
        };
        const result = getModelsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should validate pageSize = 1", () => {
        const validData = {
          language: "python",
          directoryPath: "path/to/models",
          pageSize: 1,
        };
        const result = getModelsSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should validate pageSize = 100", () => {
        const validData = {
          language: "python",
          directoryPath: "path/to/models",
          pageSize: 100,
        };
        const result = getModelsSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should reject pageSize = 0", () => {
        const invalidData = {
          language: "python",
          directoryPath: "path/to/models",
          pageSize: 0,
        };
        const result = getModelsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject pageSize > 100", () => {
        const invalidData = {
          language: "python",
          directoryPath: "path/to/models",
          pageSize: 101,
        };
        const result = getModelsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject non-integer page", () => {
        const invalidData = {
          language: "python",
          directoryPath: "path/to/models",
          page: 2.5,
        };
        const result = getModelsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it("should reject non-integer pageSize", () => {
        const invalidData = {
          language: "python",
          directoryPath: "path/to/models",
          pageSize: 75.5,
        };
        const result = getModelsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });
});
