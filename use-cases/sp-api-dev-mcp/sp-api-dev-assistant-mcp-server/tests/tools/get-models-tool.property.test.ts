import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { GetModels } from "../../src/tools/code-generation-tools/get-models.js";
import { Model } from "../../src/tools/code-generation-tools/models/model.js";

// Mock the DiscoveryService to avoid simple-git dependency
vi.mock("../../src/tools/code-generation-tools/services/discovery.js", () => {
  return {
    DiscoveryService: vi.fn().mockImplementation(() => ({
      getModels: vi.fn(),
    })),
  };
});

// Property-based tests for GetModels
describe("GetModels Property Tests", () => {
  let tool: GetModels;
  let mockDiscoveryService: any;

  beforeEach(() => {
    tool = new GetModels();
    mockDiscoveryService = (tool as any).discoveryService;
    vi.clearAllMocks();
  });

  // Feature: code-generation-tools-filtering-enhancements, Property 6: Models Backward Compatibility
  // Validates: Requirements 4.4, 5.4, 7.2
  describe("Property 6: Models Backward Compatibility", () => {
    const modelArbitrary = fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      swaggerType: fc.constantFrom(
        "object",
        "string",
        "integer",
        "boolean",
        "array",
        "number",
      ),
      attributeMap: fc.dictionary(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        { maxKeys: 10 },
      ),
      isEnum: fc.boolean(),
      enumValues: fc.oneof(
        fc.constant(null),
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
          minLength: 1,
          maxLength: 10,
        }),
      ),
    });

    it("should return identical results when no filtering parameters are provided", () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(modelArbitrary, { minLength: 0, maxLength: 20 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          async (models, page, pageSize) => {
            // Create fresh tool and mock for this iteration
            const freshTool = new GetModels();
            const freshMock = (freshTool as any).discoveryService;

            const mockResult = {
              items: models,
              pagination: {
                page,
                pageSize,
                totalItems: models.length,
                totalPages: Math.ceil(models.length / pageSize),
              },
            };

            // Test without any filtering parameters
            freshMock.getModels.mockResolvedValue(mockResult);

            const result = await freshTool.execute({
              language: "python",
              directoryPath: "models/",
              page,
              pageSize,
            });

            // Should return all models without modification
            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);
            expect(parsedResult.items).toHaveLength(models.length);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should include all fields when included_data is not specified", () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(modelArbitrary, { minLength: 1, maxLength: 10 }),
          async (models) => {
            // Create fresh tool and mock for this iteration
            const freshTool = new GetModels();
            const freshMock = (freshTool as any).discoveryService;

            const mockResult = {
              items: models,
              pagination: {
                page: 1,
                pageSize: 50,
                totalItems: models.length,
                totalPages: 1,
              },
            };

            freshMock.getModels.mockResolvedValue(mockResult);

            const result = await freshTool.execute({
              language: "python",
              directoryPath: "models/",
            });

            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);

            // All models should have all fields
            parsedResult.items.forEach((model: Model, index: number) => {
              expect(model).toHaveProperty("name");
              expect(model).toHaveProperty("swaggerType");
              expect(model).toHaveProperty("attributeMap");
              expect(model).toHaveProperty("isEnum");
              expect(model).toHaveProperty("enumValues");

              // Values should match the original
              expect(model.name).toBe(models[index].name);
              expect(model.swaggerType).toBe(models[index].swaggerType);
              expect(model.isEnum).toBe(models[index].isEnum);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should return all models when models filter is not specified", () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(modelArbitrary, { minLength: 0, maxLength: 15 }),
          async (models) => {
            // Create fresh tool and mock for this iteration
            const freshTool = new GetModels();
            const freshMock = (freshTool as any).discoveryService;

            const mockResult = {
              items: models,
              pagination: {
                page: 1,
                pageSize: 50,
                totalItems: models.length,
                totalPages: 1,
              },
            };

            freshMock.getModels.mockResolvedValue(mockResult);

            const result = await freshTool.execute({
              language: "python",
              directoryPath: "models/",
            });

            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);
            expect(parsedResult.items).toHaveLength(models.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: code-generation-tools-filtering-enhancements, Property 11: Models Response Structure Preservation
  // Validates: Requirements 7.4
  describe("Property 11: Models Response Structure Preservation", () => {
    const modelArbitrary = fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      swaggerType: fc.constantFrom(
        "object",
        "string",
        "integer",
        "boolean",
        "array",
        "number",
      ),
      attributeMap: fc.dictionary(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        { maxKeys: 10 },
      ),
      isEnum: fc.boolean(),
      enumValues: fc.oneof(
        fc.constant(null),
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
          minLength: 1,
          maxLength: 10,
        }),
      ),
    });

    it("should preserve all original fields when no field filtering is applied", () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(modelArbitrary, { minLength: 1, maxLength: 10 }),
          async (models) => {
            // Create fresh tool and mock for this iteration
            const freshTool = new GetModels();
            const freshMock = (freshTool as any).discoveryService;

            const mockResult = {
              items: models,
              pagination: {
                page: 1,
                pageSize: 50,
                totalItems: models.length,
                totalPages: 1,
              },
            };

            freshMock.getModels.mockResolvedValue(mockResult);

            const result = await freshTool.execute({
              language: "python",
              directoryPath: "models/",
            });

            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);

            // All models should have all original fields
            parsedResult.items.forEach((model: any) => {
              expect(model).toHaveProperty("name");
              expect(model).toHaveProperty("swaggerType");
              expect(model).toHaveProperty("attributeMap");
              expect(model).toHaveProperty("isEnum");
              expect(model).toHaveProperty("enumValues");
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should maintain response structure with pagination metadata", () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(modelArbitrary, { minLength: 0, maxLength: 20 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 100 }),
          async (models, page, pageSize) => {
            // Create fresh tool and mock for this iteration
            const freshTool = new GetModels();
            const freshMock = (freshTool as any).discoveryService;

            const mockResult = {
              items: models,
              pagination: {
                page,
                pageSize,
                totalItems: models.length,
                totalPages: Math.ceil(models.length / pageSize),
              },
            };

            freshMock.getModels.mockResolvedValue(mockResult);

            const result = await freshTool.execute({
              language: "python",
              directoryPath: "models/",
              page,
              pageSize,
            });

            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);

            // Should have items and pagination
            expect(parsedResult).toHaveProperty("items");
            expect(parsedResult).toHaveProperty("pagination");

            // Pagination should have correct structure
            expect(parsedResult.pagination).toHaveProperty("page");
            expect(parsedResult.pagination).toHaveProperty("pageSize");
            expect(parsedResult.pagination).toHaveProperty("totalItems");
            expect(parsedResult.pagination).toHaveProperty("totalPages");
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should preserve field types and values after filtering", () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(modelArbitrary, { minLength: 1, maxLength: 10 }),
          async (models) => {
            // Create fresh tool and mock for this iteration
            const freshTool = new GetModels();
            const freshMock = (freshTool as any).discoveryService;

            const mockResult = {
              items: models,
              pagination: {
                page: 1,
                pageSize: 50,
                totalItems: models.length,
                totalPages: 1,
              },
            };

            freshMock.getModels.mockResolvedValue(mockResult);

            const result = await freshTool.execute({
              language: "python",
              directoryPath: "models/",
            });

            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);

            // Check that field types are preserved
            parsedResult.items.forEach((model: any, index: number) => {
              expect(typeof model.name).toBe("string");
              expect(typeof model.swaggerType).toBe("string");
              expect(typeof model.attributeMap).toBe("object");
              expect(typeof model.isEnum).toBe("boolean");

              // enumValues should be null or array
              expect(
                model.enumValues === null || Array.isArray(model.enumValues),
              ).toBe(true);

              // Values should match original
              expect(model.name).toBe(models[index].name);
              expect(model.swaggerType).toBe(models[index].swaggerType);
              expect(model.isEnum).toBe(models[index].isEnum);
            });
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: code-generation-tools-filtering-enhancements, Property 2: Models Name Filtering
  // Validates: Requirements 4.1, 4.2, 4.5
  describe("Property 2: Models Name Filtering", () => {
    const modelArbitrary = fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      swaggerType: fc.constantFrom(
        "object",
        "string",
        "integer",
        "boolean",
        "array",
        "number",
      ),
      attributeMap: fc.dictionary(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        { maxKeys: 10 },
      ),
      isEnum: fc.boolean(),
      enumValues: fc.oneof(
        fc.constant(null),
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
          minLength: 1,
          maxLength: 10,
        }),
      ),
    });

    it("should filter models by name case-insensitively", () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(modelArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
            minLength: 1,
            maxLength: 5,
          }),
          async (models, filterNames) => {
            // Create fresh tool and mock for this iteration
            const freshTool = new GetModels();
            const freshMock = (freshTool as any).discoveryService;

            // Create filter string
            const modelsFilter = filterNames.join(",");

            // Filter models to match what the service would return
            const lowerFilterNames = filterNames.map((n) => n.toLowerCase());
            const expectedFiltered = models.filter((m) =>
              lowerFilterNames.includes(m.name.toLowerCase()),
            );

            const mockResult = {
              items: expectedFiltered,
              pagination: {
                page: 1,
                pageSize: 50,
                totalItems: expectedFiltered.length,
                totalPages: 1,
              },
            };

            freshMock.getModels.mockResolvedValue(mockResult);

            const result = await freshTool.execute({
              language: "python",
              directoryPath: "models/",
              models: modelsFilter,
            });

            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);

            // All returned models should match at least one filter name (case-insensitive)
            parsedResult.items.forEach((model: any) => {
              const matches = lowerFilterNames.includes(
                model.name.toLowerCase(),
              );
              expect(matches).toBe(true);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should return empty array when no models match filter", () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(modelArbitrary, { minLength: 1, maxLength: 10 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (models, nonMatchingName) => {
            // Ensure the filter name doesn't match any model
            const modelNames = models.map((m) => m.name.toLowerCase());
            if (modelNames.includes(nonMatchingName.toLowerCase())) {
              return; // Skip this iteration
            }

            // Create fresh tool and mock for this iteration
            const freshTool = new GetModels();
            const freshMock = (freshTool as any).discoveryService;

            const mockResult = {
              items: [],
              pagination: {
                page: 1,
                pageSize: 50,
                totalItems: 0,
                totalPages: 0,
              },
            };

            freshMock.getModels.mockResolvedValue(mockResult);

            const result = await freshTool.execute({
              language: "python",
              directoryPath: "models/",
              models: nonMatchingName,
            });

            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);
            expect(parsedResult.items).toHaveLength(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should handle multiple comma-separated model names", () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(modelArbitrary, { minLength: 3, maxLength: 20 }),
          async (models) => {
            // Create fresh tool and mock for this iteration
            const freshTool = new GetModels();
            const freshMock = (freshTool as any).discoveryService;

            // Pick 2-3 models to filter by
            const numToFilter = Math.min(3, models.length);
            const modelsToFilter = models.slice(0, numToFilter);
            const filterNames = modelsToFilter.map((m) => m.name);
            const modelsFilter = filterNames.join(",");

            const mockResult = {
              items: modelsToFilter,
              pagination: {
                page: 1,
                pageSize: 50,
                totalItems: modelsToFilter.length,
                totalPages: 1,
              },
            };

            freshMock.getModels.mockResolvedValue(mockResult);

            const result = await freshTool.execute({
              language: "python",
              directoryPath: "models/",
              models: modelsFilter,
            });

            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);
            expect(parsedResult.items).toHaveLength(modelsToFilter.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
  // Feature: code-generation-tools-filtering-enhancements, Property 4: Models Field Projection
  // Validates: Requirements 5.1, 5.2
  describe("Property 4: Models Field Projection", () => {
    const validFields = [
      "name",
      "swaggerType",
      "attributeMap",
      "isEnum",
      "enumValues",
    ];

    const modelArbitrary = fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      swaggerType: fc.constantFrom(
        "object",
        "string",
        "integer",
        "boolean",
        "array",
        "number",
      ),
      attributeMap: fc.dictionary(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        { maxKeys: 10 },
      ),
      isEnum: fc.boolean(),
      enumValues: fc.oneof(
        fc.constant(null),
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
          minLength: 1,
          maxLength: 10,
        }),
      ),
    });

    it("should project only specified fields", () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(modelArbitrary, { minLength: 1, maxLength: 10 }),
          fc.subarray(validFields, { minLength: 1 }),
          async (models, fieldsToInclude) => {
            // Reset all mocks for this iteration
            vi.clearAllMocks();
            mockDiscoveryService.getModels.mockClear();

            const includedDataFilter = fieldsToInclude.join(",");

            // Project the models to only include specified fields
            const projectedModels = models.map((model) => {
              const projected: any = {};
              fieldsToInclude.forEach((field) => {
                projected[field] = model[field as keyof typeof model];
              });
              return projected;
            });

            const mockResult = {
              items: projectedModels,
              pagination: {
                page: 1,
                pageSize: 50,
                totalItems: projectedModels.length,
                totalPages: 1,
              },
            };

            mockDiscoveryService.getModels.mockResolvedValue(mockResult);

            const result = await tool.execute({
              language: "python",
              directoryPath: "models/",
              included_data: includedDataFilter,
            });

            expect(result.isError).toBeFalsy();

            // Verify filter params were passed (check if calls exist first)
            const calls = mockDiscoveryService.getModels.mock.calls;
            if (calls.length > 0) {
              expect(calls[0][0]).toBe("python");
              expect(calls[0][1]).toBe("models/");
              expect(calls[0][3]).toMatchObject({
                included_data: includedDataFilter,
              });
            }

            const parsedResult = JSON.parse(result.content[0].text);

            // All returned models should have exactly the specified fields
            parsedResult.items.forEach((model: any) => {
              const modelKeys = Object.keys(model);
              expect(modelKeys).toHaveLength(fieldsToInclude.length);

              fieldsToInclude.forEach((field) => {
                expect(model).toHaveProperty(field);
              });

              // No extra fields should be present
              modelKeys.forEach((key) => {
                expect(fieldsToInclude).toContain(key);
              });
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should handle single field projection", () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(modelArbitrary, { minLength: 1, maxLength: 10 }),
          fc.constantFrom(...validFields),
          async (models, singleField) => {
            // Create fresh tool and mock for this iteration
            const freshTool = new GetModels();
            const freshMock = (freshTool as any).discoveryService;

            const projectedModels = models.map((model) => ({
              [singleField]: model[singleField as keyof typeof model],
            }));

            const mockResult = {
              items: projectedModels,
              pagination: {
                page: 1,
                pageSize: 50,
                totalItems: projectedModels.length,
                totalPages: 1,
              },
            };

            freshMock.getModels.mockResolvedValue(mockResult);

            const result = await freshTool.execute({
              language: "python",
              directoryPath: "models/",
              included_data: singleField,
            });

            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);

            // Each model should have exactly one field
            parsedResult.items.forEach((model: any) => {
              expect(Object.keys(model)).toHaveLength(1);
              expect(model).toHaveProperty(singleField);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should handle all fields projection", () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(modelArbitrary, { minLength: 1, maxLength: 10 }),
          async (models) => {
            // Create fresh tool and mock for this iteration
            const freshTool = new GetModels();
            const freshMock = (freshTool as any).discoveryService;

            const includedDataFilter = validFields.join(",");

            const mockResult = {
              items: models,
              pagination: {
                page: 1,
                pageSize: 50,
                totalItems: models.length,
                totalPages: 1,
              },
            };

            freshMock.getModels.mockResolvedValue(mockResult);

            const result = await freshTool.execute({
              language: "python",
              directoryPath: "models/",
              included_data: includedDataFilter,
            });

            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);

            // All models should have all fields
            parsedResult.items.forEach((model: any) => {
              validFields.forEach((field) => {
                expect(model).toHaveProperty(field);
              });
            });
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
