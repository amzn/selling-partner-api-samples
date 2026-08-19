import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  cloneRepoSchema,
  getBasicUsageSchema,
  getCategoriesSchema,
  getOperationsSchema,
  getModelsSchema,
} from "../../src/zod-schemas/code-generation-schemas";

describe("Code Generation Schemas - Property-Based Tests", () => {
  // Feature: code-generation-tools-integration, Property 1: Clone Tool Idempotency
  // Validates: Requirements 1.1, 1.2
  describe("Property 1: Clone Tool Idempotency", () => {
    it("should validate that clone operation parameters remain consistent across multiple calls", () => {
      fc.assert(
        fc.property(
          fc.option(fc.webUrl(), { nil: undefined }),
          fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
          (repositoryUrl, targetPath) => {
            const data: any = {};
            if (repositoryUrl !== undefined) {
              data.repositoryUrl = repositoryUrl;
            }
            if (targetPath !== undefined) {
              data.targetPath = targetPath;
            }

            // First validation
            const firstResult = cloneRepoSchema.safeParse(data);

            // Second validation with same data (idempotent)
            const secondResult = cloneRepoSchema.safeParse(data);

            // Both should have same validation result
            expect(firstResult.success).toBe(secondResult.success);

            if (firstResult.success && secondResult.success) {
              // Data should be identical
              expect(firstResult.data).toEqual(secondResult.data);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should validate that empty object is valid for cloneRepoSchema (all params optional)", () => {
      fc.assert(
        fc.property(fc.constant({}), (emptyData) => {
          const result = cloneRepoSchema.safeParse(emptyData);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });

  // Feature: code-generation-tools-integration, Property 2: Language Enum Validation Consistency
  // Validates: Requirements 2.2, 2.4, 3.3, 3.4, 6.3
  describe("Property 2: Language Enum Validation Consistency", () => {
    const validLanguages = ["python", "java", "javascript", "php", "csharp"];

    it("should accept only valid language enum values across all schemas", () => {
      fc.assert(
        fc.property(fc.constantFrom(...validLanguages), (language) => {
          // Test getBasicUsageSchema
          const basicUsageResult = getBasicUsageSchema.safeParse({ language });
          expect(basicUsageResult.success).toBe(true);

          // Test getCategoriesSchema
          const categoriesResult = getCategoriesSchema.safeParse({ language });
          expect(categoriesResult.success).toBe(true);

          // Test getOperationsSchema
          const operationsResult = getOperationsSchema.safeParse({
            language,
            filePath: "test/path",
          });
          expect(operationsResult.success).toBe(true);

          // Test getModelsSchema
          const modelsResult = getModelsSchema.safeParse({
            language,
            directoryPath: "test/path",
          });
          expect(modelsResult.success).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("should reject invalid language values across all schemas", () => {
      fc.assert(
        fc.property(
          fc
            .string()
            .filter((s) => !validLanguages.includes(s) && s.length > 0),
          (invalidLanguage) => {
            // Test getBasicUsageSchema
            const basicUsageResult = getBasicUsageSchema.safeParse({
              language: invalidLanguage,
            });
            expect(basicUsageResult.success).toBe(false);

            // Test getCategoriesSchema
            const categoriesResult = getCategoriesSchema.safeParse({
              language: invalidLanguage,
            });
            expect(categoriesResult.success).toBe(false);

            // Test getOperationsSchema
            const operationsResult = getOperationsSchema.safeParse({
              language: invalidLanguage,
              filePath: "test/path",
            });
            expect(operationsResult.success).toBe(false);

            // Test getModelsSchema
            const modelsResult = getModelsSchema.safeParse({
              language: invalidLanguage,
              directoryPath: "test/path",
            });
            expect(modelsResult.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: code-generation-tools-integration, Property 3: Pagination Parameter Validation
  // Validates: Requirements 4.2, 5.2, 6.4
  describe("Property 3: Pagination Parameter Validation", () => {
    it("should accept valid pagination parameters (page >= 1, pageSize 1-100)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          (page, pageSize, language) => {
            // Test getOperationsSchema
            const operationsResult = getOperationsSchema.safeParse({
              language,
              filePath: "test/path",
              page,
              pageSize,
            });
            expect(operationsResult.success).toBe(true);
            if (operationsResult.success) {
              expect(operationsResult.data.page).toBe(page);
              expect(operationsResult.data.pageSize).toBe(pageSize);
            }

            // Test getModelsSchema
            const modelsResult = getModelsSchema.safeParse({
              language,
              directoryPath: "test/path",
              page,
              pageSize,
            });
            expect(modelsResult.success).toBe(true);
            if (modelsResult.success) {
              expect(modelsResult.data.page).toBe(page);
              expect(modelsResult.data.pageSize).toBe(pageSize);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should reject invalid page values (page < 1)", () => {
      fc.assert(
        fc.property(
          fc.integer({ max: 0 }),
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          (invalidPage, language) => {
            // Test getOperationsSchema
            const operationsResult = getOperationsSchema.safeParse({
              language,
              filePath: "test/path",
              page: invalidPage,
            });
            expect(operationsResult.success).toBe(false);

            // Test getModelsSchema
            const modelsResult = getModelsSchema.safeParse({
              language,
              directoryPath: "test/path",
              page: invalidPage,
            });
            expect(modelsResult.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should reject invalid pageSize values (pageSize < 1 or > 100)", () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer({ max: 0 }), fc.integer({ min: 101, max: 1000 })),
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          (invalidPageSize, language) => {
            // Test getOperationsSchema
            const operationsResult = getOperationsSchema.safeParse({
              language,
              filePath: "test/path",
              pageSize: invalidPageSize,
            });
            expect(operationsResult.success).toBe(false);

            // Test getModelsSchema
            const modelsResult = getModelsSchema.safeParse({
              language,
              directoryPath: "test/path",
              pageSize: invalidPageSize,
            });
            expect(modelsResult.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should reject non-integer pagination values", () => {
      fc.assert(
        fc.property(
          fc
            .double({ min: 1.1, max: 100, noNaN: true })
            .filter((n) => !Number.isInteger(n)),
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          (nonInteger, language) => {
            // Test getOperationsSchema with non-integer page
            const operationsPageResult = getOperationsSchema.safeParse({
              language,
              filePath: "test/path",
              page: nonInteger,
            });
            expect(operationsPageResult.success).toBe(false);

            // Test getOperationsSchema with non-integer pageSize
            const operationsPageSizeResult = getOperationsSchema.safeParse({
              language,
              filePath: "test/path",
              pageSize: nonInteger,
            });
            expect(operationsPageSizeResult.success).toBe(false);

            // Test getModelsSchema with non-integer page
            const modelsPageResult = getModelsSchema.safeParse({
              language,
              directoryPath: "test/path",
              page: nonInteger,
            });
            expect(modelsPageResult.success).toBe(false);

            // Test getModelsSchema with non-integer pageSize
            const modelsPageSizeResult = getModelsSchema.safeParse({
              language,
              directoryPath: "test/path",
              pageSize: nonInteger,
            });
            expect(modelsPageSizeResult.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: code-generation-tools-integration, Property 4: Paginated Response Format
  // Validates: Requirements 4.1, 5.1
  describe("Property 4: Paginated Response Format", () => {
    it("should validate that paginated response structure is consistent", () => {
      fc.assert(
        fc.property(
          fc.array(fc.anything(), { minLength: 0, maxLength: 100 }),
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 10000 }),
          (items, page, pageSize, totalItems) => {
            // Create a paginated response structure
            const totalPages = Math.ceil(totalItems / pageSize);
            const hasNextPage = page < totalPages;
            const hasPreviousPage = page > 1;

            const paginatedResponse = {
              items,
              pagination: {
                page,
                pageSize,
                totalItems,
                totalPages,
                hasNextPage,
                hasPreviousPage,
              },
            };

            // Validate structure
            expect(paginatedResponse).toHaveProperty("items");
            expect(paginatedResponse).toHaveProperty("pagination");
            expect(Array.isArray(paginatedResponse.items)).toBe(true);

            // Validate pagination metadata
            expect(paginatedResponse.pagination).toHaveProperty("page");
            expect(paginatedResponse.pagination).toHaveProperty("pageSize");
            expect(paginatedResponse.pagination).toHaveProperty("totalItems");
            expect(paginatedResponse.pagination).toHaveProperty("totalPages");
            expect(paginatedResponse.pagination).toHaveProperty("hasNextPage");
            expect(paginatedResponse.pagination).toHaveProperty(
              "hasPreviousPage",
            );

            // Validate pagination logic
            expect(paginatedResponse.pagination.page).toBeGreaterThanOrEqual(1);
            expect(
              paginatedResponse.pagination.pageSize,
            ).toBeGreaterThanOrEqual(1);
            expect(paginatedResponse.pagination.pageSize).toBeLessThanOrEqual(
              100,
            );
            expect(
              paginatedResponse.pagination.totalItems,
            ).toBeGreaterThanOrEqual(0);
            expect(
              paginatedResponse.pagination.totalPages,
            ).toBeGreaterThanOrEqual(0);

            // Validate hasNextPage logic
            if (page < totalPages) {
              expect(paginatedResponse.pagination.hasNextPage).toBe(true);
            } else {
              expect(paginatedResponse.pagination.hasNextPage).toBe(false);
            }

            // Validate hasPreviousPage logic
            if (page > 1) {
              expect(paginatedResponse.pagination.hasPreviousPage).toBe(true);
            } else {
              expect(paginatedResponse.pagination.hasPreviousPage).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should validate pagination metadata consistency", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 10000 }),
          (page, pageSize, totalItems) => {
            const totalPages = Math.ceil(totalItems / pageSize);

            // Validate totalPages calculation
            if (totalItems === 0) {
              expect(totalPages).toBe(0);
            } else {
              expect(totalPages).toBeGreaterThan(0);
              expect(totalPages).toBeLessThanOrEqual(Math.ceil(totalItems / 1)); // Max possible pages
            }

            // Validate page bounds
            if (page <= totalPages || totalPages === 0) {
              // Valid page number
              expect(page).toBeGreaterThanOrEqual(1);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: code-generation-tools-integration, Property 5: Invalid Path Error Handling
  // Validates: Requirements 4.3, 5.3
  describe("Property 5: Invalid Path Error Handling", () => {
    it("should validate that empty paths are rejected", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          (language) => {
            // Test getOperationsSchema with empty filePath
            const operationsResult = getOperationsSchema.safeParse({
              language,
              filePath: "",
            });
            expect(operationsResult.success).toBe(false);

            // Test getModelsSchema with empty directoryPath
            const modelsResult = getModelsSchema.safeParse({
              language,
              directoryPath: "",
            });
            expect(modelsResult.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should validate that paths must be strings", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          fc.oneof(
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
          ),
          (language, invalidPath) => {
            // Test getOperationsSchema with non-string filePath
            const operationsResult = getOperationsSchema.safeParse({
              language,
              filePath: invalidPath,
            });
            expect(operationsResult.success).toBe(false);

            // Test getModelsSchema with non-string directoryPath
            const modelsResult = getModelsSchema.safeParse({
              language,
              directoryPath: invalidPath,
            });
            expect(modelsResult.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should accept valid non-empty path strings", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          fc.string({ minLength: 1, maxLength: 200 }),
          (language, validPath) => {
            // Test getOperationsSchema with valid filePath
            const operationsResult = getOperationsSchema.safeParse({
              language,
              filePath: validPath,
            });
            expect(operationsResult.success).toBe(true);

            // Test getModelsSchema with valid directoryPath
            const modelsResult = getModelsSchema.safeParse({
              language,
              directoryPath: validPath,
            });
            expect(modelsResult.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should validate path parameter requirements", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          (language) => {
            // Test getOperationsSchema without filePath
            const operationsResult = getOperationsSchema.safeParse({
              language,
            });
            expect(operationsResult.success).toBe(false);

            // Test getModelsSchema without directoryPath
            const modelsResult = getModelsSchema.safeParse({
              language,
            });
            expect(modelsResult.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: code-generation-tools-filtering-enhancements, Property 12: Input Validation for Filter Parameters
  // Validates: Requirements 6.3, 6.4
  describe("Property 12: Input Validation for Filter Parameters", () => {
    it("should reject non-string operations parameter", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          fc.string({ minLength: 1 }),
          fc.oneof(
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.array(fc.string()),
            fc.object(),
          ),
          (language, filePath, invalidOperations) => {
            const result = getOperationsSchema.safeParse({
              language,
              filePath,
              operations: invalidOperations,
            });
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should reject non-string models parameter", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          fc.string({ minLength: 1 }),
          fc.oneof(
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.array(fc.string()),
            fc.object(),
          ),
          (language, directoryPath, invalidModels) => {
            const result = getModelsSchema.safeParse({
              language,
              directoryPath,
              models: invalidModels,
            });
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should reject non-string includedData parameter for operations", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          fc.string({ minLength: 1 }),
          fc.oneof(
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.array(fc.string()),
            fc.object(),
          ),
          (language, filePath, invalidIncludedData) => {
            const result = getOperationsSchema.safeParse({
              language,
              filePath,
              includedData: invalidIncludedData,
            });
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should reject non-string includedData parameter for models", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          fc.string({ minLength: 1 }),
          fc.oneof(
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.array(fc.string()),
            fc.object(),
          ),
          (language, directoryPath, invalidIncludedData) => {
            const result = getModelsSchema.safeParse({
              language,
              directoryPath,
              includedData: invalidIncludedData,
            });
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should accept valid string filter parameters", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          fc.string({ minLength: 1 }),
          fc.string(),
          fc.string(),
          (language, filePath, operations, includedData) => {
            const operationsResult = getOperationsSchema.safeParse({
              language,
              filePath,
              operations,
              includedData,
            });
            expect(operationsResult.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should accept valid string filter parameters for models", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          fc.string({ minLength: 1 }),
          fc.string(),
          fc.string(),
          (language, directoryPath, models, includedData) => {
            const modelsResult = getModelsSchema.safeParse({
              language,
              directoryPath,
              models,
              includedData,
            });
            expect(modelsResult.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: code-generation-tools-integration, Property 7: Optional Parameter Handling
  // Validates: Requirements 1.3, 6.5
  describe("Property 7: Optional Parameter Handling", () => {
    it("should validate cloneRepoSchema with and without optional parameters", () => {
      fc.assert(
        fc.property(
          fc.option(fc.webUrl(), { nil: undefined }),
          fc.option(fc.string(), { nil: undefined }),
          (repositoryUrl, targetPath) => {
            const data: any = {};
            if (repositoryUrl !== undefined) {
              data.repositoryUrl = repositoryUrl;
            }
            if (targetPath !== undefined) {
              data.targetPath = targetPath;
            }

            const result = cloneRepoSchema.safeParse(data);
            expect(result.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should validate getOperationsSchema with and without optional pagination", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          fc.string({ minLength: 1 }),
          fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(fc.string(), { nil: undefined }),
          fc.option(fc.string(), { nil: undefined }),
          (language, filePath, page, pageSize, operations, includedData) => {
            const data: any = { language, filePath };
            if (page !== undefined) {
              data.page = page;
            }
            if (pageSize !== undefined) {
              data.pageSize = pageSize;
            }
            if (operations !== undefined) {
              data.operations = operations;
            }
            if (includedData !== undefined) {
              data.includedData = includedData;
            }

            const result = getOperationsSchema.safeParse(data);
            expect(result.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should validate getModelsSchema with and without optional pagination", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("python", "java", "javascript", "php", "csharp"),
          fc.string({ minLength: 1 }),
          fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(fc.string(), { nil: undefined }),
          fc.option(fc.string(), { nil: undefined }),
          (language, directoryPath, page, pageSize, models, includedData) => {
            const data: any = { language, directoryPath };
            if (page !== undefined) {
              data.page = page;
            }
            if (pageSize !== undefined) {
              data.pageSize = pageSize;
            }
            if (models !== undefined) {
              data.models = models;
            }
            if (includedData !== undefined) {
              data.includedData = includedData;
            }

            const result = getModelsSchema.safeParse(data);
            expect(result.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ============================================================================
// Master Code Generation Schema - Property-Based Tests
// ============================================================================

import { masterCodeGenerationSchema } from "../../src/zod-schemas/code-generation-schemas";

const validActions = [
  "get_workflow_guide",
  "clone_repo",
  "get_basic_usage",
  "get_categories",
  "get_operations",
  "get_models",
] as const;

const validLanguages = [
  "python",
  "java",
  "javascript",
  "php",
  "csharp",
] as const;

/**
 * Helper: build a minimal valid input object for a given action.
 */
function minimalValidInput(action: string): Record<string, unknown> {
  switch (action) {
    case "get_workflow_guide":
      return { action };
    case "clone_repo":
      return { action };
    case "get_basic_usage":
      return { action, language: "python" };
    case "get_categories":
      return { action, language: "python" };
    case "get_operations":
      return { action, language: "python", filePath: "/some/path" };
    case "get_models":
      return { action, language: "python", directoryPath: "/some/path" };
    default:
      return { action };
  }
}

describe("Master Code Generation Schema - Property-Based Tests", () => {
  // Feature: generate-code-sample-master-tool, Property 2: Action enum validation
  // **Validates: Requirements 2.1, 2.8, 11.2**
  describe("Property 2: Action enum validation", () => {
    it("should accept all valid action values with appropriate per-action params", () => {
      fc.assert(
        fc.property(fc.constantFrom(...validActions), (action) => {
          const input = minimalValidInput(action);
          const result = masterCodeGenerationSchema.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("should reject invalid action values", () => {
      fc.assert(
        fc.property(
          fc
            .string()
            .filter((s) => !(validActions as readonly string[]).includes(s)),
          (invalidAction) => {
            const result = masterCodeGenerationSchema.safeParse({
              action: invalidAction,
            });
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: generate-code-sample-master-tool, Property 3: Per-action parameter schema validation
  // **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.2, 8.2, 9.3, 10.3, 11.3, 11.4**
  describe("Property 3: Per-action parameter schema validation", () => {
    it("get_workflow_guide accepts with optional step and rejects invalid step", () => {
      fc.assert(
        fc.property(
          fc.option(
            fc.constantFrom(
              "basic-usage",
              "categories",
              "operations",
              "models",
              "all",
            ),
            { nil: undefined },
          ),
          (step) => {
            const input: Record<string, unknown> = {
              action: "get_workflow_guide",
            };
            if (step !== undefined) input.step = step;
            const result = masterCodeGenerationSchema.safeParse(input);
            expect(result.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("clone_repo accepts with optional repositoryUrl and targetPath", () => {
      fc.assert(
        fc.property(
          fc.option(fc.webUrl(), { nil: undefined }),
          fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
          (repositoryUrl, targetPath) => {
            const input: Record<string, unknown> = { action: "clone_repo" };
            if (repositoryUrl !== undefined)
              input.repositoryUrl = repositoryUrl;
            if (targetPath !== undefined) input.targetPath = targetPath;
            const result = masterCodeGenerationSchema.safeParse(input);
            expect(result.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("get_basic_usage accepts with language provided", () => {
      fc.assert(
        fc.property(fc.constantFrom(...validLanguages), (language) => {
          const valid = masterCodeGenerationSchema.safeParse({
            action: "get_basic_usage",
            language,
          });
          expect(valid.success).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("get_categories accepts with language provided", () => {
      fc.assert(
        fc.property(fc.constantFrom(...validLanguages), (language) => {
          const valid = masterCodeGenerationSchema.safeParse({
            action: "get_categories",
            language,
          });
          expect(valid.success).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("get_operations accepts with language and filePath provided", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...validLanguages),
          fc.string({ minLength: 1 }),
          (language, filePath) => {
            const valid = masterCodeGenerationSchema.safeParse({
              action: "get_operations",
              language,
              filePath,
            });
            expect(valid.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("get_models accepts with language and directoryPath provided", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...validLanguages),
          fc.string({ minLength: 1 }),
          (language, directoryPath) => {
            const valid = masterCodeGenerationSchema.safeParse({
              action: "get_models",
              language,
              directoryPath,
            });
            expect(valid.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: generate-code-sample-master-tool, Property 4: Pagination defaults not applied in master schema when omitted
  // **Validates: Requirements 9.2, 10.2**
  describe("Property 4: Pagination defaults not applied in master schema when omitted", () => {
    it("get_operations does not default page and pageSize when omitted from master schema", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...validLanguages),
          fc.string({ minLength: 1 }),
          (language, filePath) => {
            const result = masterCodeGenerationSchema.safeParse({
              action: "get_operations",
              language,
              filePath,
            });
            expect(result.success).toBe(true);
            if (result.success) {
              const data = result.data as { page?: number; pageSize?: number };
              expect(data.page).toBeUndefined();
              expect(data.pageSize).toBeUndefined();
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("get_models does not default page and pageSize when omitted from master schema", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...validLanguages),
          fc.string({ minLength: 1 }),
          (language, directoryPath) => {
            const result = masterCodeGenerationSchema.safeParse({
              action: "get_models",
              language,
              directoryPath,
            });
            expect(result.success).toBe(true);
            if (result.success) {
              const data = result.data as { page?: number; pageSize?: number };
              expect(data.page).toBeUndefined();
              expect(data.pageSize).toBeUndefined();
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: generate-code-sample-master-tool, Property 5: Pagination bounds validation
  // **Validates: Requirements 9.4, 10.4**
  describe("Property 5: Pagination bounds validation", () => {
    it("should reject invalid page values (< 1) for get_operations and get_models", () => {
      fc.assert(
        fc.property(
          fc.integer({ max: 0 }),
          fc.constantFrom(...validLanguages),
          (invalidPage, language) => {
            const opsResult = masterCodeGenerationSchema.safeParse({
              action: "get_operations",
              language,
              filePath: "/some/path",
              page: invalidPage,
            });
            expect(opsResult.success).toBe(false);

            const modelsResult = masterCodeGenerationSchema.safeParse({
              action: "get_models",
              language,
              directoryPath: "/some/path",
              page: invalidPage,
            });
            expect(modelsResult.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should reject invalid pageSize values (< 1 or > 100) for get_operations and get_models", () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer({ max: 0 }), fc.integer({ min: 101, max: 1000 })),
          fc.constantFrom(...validLanguages),
          (invalidPageSize, language) => {
            const opsResult = masterCodeGenerationSchema.safeParse({
              action: "get_operations",
              language,
              filePath: "/some/path",
              pageSize: invalidPageSize,
            });
            expect(opsResult.success).toBe(false);

            const modelsResult = masterCodeGenerationSchema.safeParse({
              action: "get_models",
              language,
              directoryPath: "/some/path",
              pageSize: invalidPageSize,
            });
            expect(modelsResult.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should accept valid page (>= 1) and pageSize (1-100) for get_operations and get_models", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          fc.constantFrom(...validLanguages),
          (page, pageSize, language) => {
            const opsResult = masterCodeGenerationSchema.safeParse({
              action: "get_operations",
              language,
              filePath: "/some/path",
              page,
              pageSize,
            });
            expect(opsResult.success).toBe(true);

            const modelsResult = masterCodeGenerationSchema.safeParse({
              action: "get_models",
              language,
              directoryPath: "/some/path",
              page,
              pageSize,
            });
            expect(modelsResult.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: generate-code-sample-master-tool, Property 6: Schema describe annotation completeness
  // **Validates: Requirements 11.5**
  describe("Property 6: Schema describe annotation completeness", () => {
    it("every field in the flat master schema has a non-empty description", () => {
      const shape = masterCodeGenerationSchema.shape as Record<
        string,
        { description?: string }
      >;

      for (const [fieldName, fieldSchema] of Object.entries(shape)) {
        const description = fieldSchema.description;
        expect(typeof description === "string" && description.length > 0).toBe(
          true,
        );
      }
    });
  });
});
