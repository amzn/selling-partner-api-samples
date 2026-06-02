import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { GetOperations } from "../../src/tools/code-generation-tools/get-operations.js";
import { Operation } from "../../src/tools/code-generation-tools/models/operation.js";

// Mock the DiscoveryService to avoid simple-git dependency
vi.mock("../../src/tools/code-generation-tools/services/discovery.js", () => {
  return {
    DiscoveryService: vi.fn().mockImplementation(() => ({
      getOperations: vi.fn(),
    })),
  };
});

// Property-based tests for GetOperations
describe("GetOperations Property Tests", () => {
  let tool: GetOperations;
  let mockDiscoveryService: any;

  beforeEach(() => {
    tool = new GetOperations();
    mockDiscoveryService = (tool as any).discoveryService;
    vi.clearAllMocks();
  });

  // Feature: code-generation-tools-filtering-enhancements, Property 5: Operations Backward Compatibility
  // Validates: Requirements 1.4, 2.4, 7.1
  describe("Property 5: Operations Backward Compatibility", () => {
    const operationArbitrary = fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      description: fc.string({ minLength: 0, maxLength: 200 }),
      callMethod: fc.constantFrom("GET", "POST", "PUT", "DELETE", "PATCH"),
      returnedModel: fc.string({ minLength: 1, maxLength: 50 }),
      rateLimit: fc.oneof(
        fc.constant(null),
        fc.record({
          requestsPerSecond: fc.option(fc.double({ min: 0.1, max: 100 })),
          requestsPerMinute: fc.option(fc.integer({ min: 1, max: 6000 })),
        }),
      ),
    });

    it("should return identical results when no filtering parameters are provided", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(operationArbitrary, { minLength: 0, maxLength: 20 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          async (operations, page, pageSize) => {
            // Reset mock for this iteration
            mockDiscoveryService.getOperations.mockClear();

            const mockResult = {
              items: operations,
              pagination: {
                page,
                pageSize,
                totalItems: operations.length,
                totalPages: Math.ceil(operations.length / pageSize),
              },
            };

            // Test without any filtering parameters
            mockDiscoveryService.getOperations.mockResolvedValue(mockResult);

            const result = await tool.execute({
              language: "python",
              filePath: "test.py",
              page,
              pageSize,
            });

            // Should not pass any filter params (undefined)
            const calls = mockDiscoveryService.getOperations.mock.calls;
            expect(calls.length).toBe(1);
            expect(calls[0][0]).toBe("python");
            expect(calls[0][1]).toBe("test.py");
            expect(calls[0][3]).toBeUndefined(); // No filter params

            // Should return all operations without modification
            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);
            expect(parsedResult.items).toHaveLength(operations.length);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should include all fields when included_data is not specified", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(operationArbitrary, { minLength: 1, maxLength: 10 }),
          async (operations) => {
            // Reset mock for this iteration
            mockDiscoveryService.getOperations.mockClear();

            const mockResult = {
              items: operations,
              pagination: {
                page: 1,
                pageSize: 50,
                totalItems: operations.length,
                totalPages: 1,
              },
            };

            mockDiscoveryService.getOperations.mockResolvedValue(mockResult);

            const result = await tool.execute({
              language: "python",
              filePath: "test.py",
            });

            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);

            // All operations should have all fields
            parsedResult.items.forEach((op: Operation, index: number) => {
              expect(op).toHaveProperty("name");
              expect(op).toHaveProperty("description");
              expect(op).toHaveProperty("callMethod");
              expect(op).toHaveProperty("returnedModel");
              expect(op).toHaveProperty("rateLimit");

              // Values should match the original
              expect(op.name).toBe(operations[index].name);
              expect(op.description).toBe(operations[index].description);
              expect(op.callMethod).toBe(operations[index].callMethod);
              expect(op.returnedModel).toBe(operations[index].returnedModel);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should return all operations when operations filter is not specified", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(operationArbitrary, { minLength: 0, maxLength: 15 }),
          async (operations) => {
            // Reset mock for this iteration
            mockDiscoveryService.getOperations.mockClear();

            const mockResult = {
              items: operations,
              pagination: {
                page: 1,
                pageSize: 50,
                totalItems: operations.length,
                totalPages: 1,
              },
            };

            mockDiscoveryService.getOperations.mockResolvedValue(mockResult);

            const result = await tool.execute({
              language: "python",
              filePath: "test.py",
            });

            expect(result.isError).toBeFalsy();

            // Should not pass operations filter
            expect(mockDiscoveryService.getOperations).toHaveBeenCalledWith(
              "python",
              "test.py",
              expect.any(Object),
              undefined,
            );

            const parsedResult = JSON.parse(result.content[0].text);
            expect(parsedResult.items).toHaveLength(operations.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: code-generation-tools-filtering-enhancements, Property 10: Operations Response Structure Preservation
  // Validates: Requirements 7.3
  describe("Property 10: Operations Response Structure Preservation", () => {
    const operationArbitrary = fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      description: fc.string({ minLength: 0, maxLength: 200 }),
      callMethod: fc.constantFrom("GET", "POST", "PUT", "DELETE", "PATCH"),
      returnedModel: fc.string({ minLength: 1, maxLength: 50 }),
      rateLimit: fc.oneof(
        fc.constant(null),
        fc.record({
          requestsPerSecond: fc.option(fc.double({ min: 0.1, max: 100 })),
          requestsPerMinute: fc.option(fc.integer({ min: 1, max: 6000 })),
        }),
      ),
      inputParameters: fc.option(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 30 }),
            type: fc.string({ minLength: 1, maxLength: 30 }),
            required: fc.boolean(),
          }),
          { maxLength: 5 },
        ),
      ),
    });

    it("should preserve all original fields plus rateLimit when no field filtering is applied", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(operationArbitrary, { minLength: 1, maxLength: 10 }),
          async (operations) => {
            // Reset mock for this iteration
            mockDiscoveryService.getOperations.mockClear();

            const mockResult = {
              items: operations,
              pagination: {
                page: 1,
                pageSize: 50,
                totalItems: operations.length,
                totalPages: 1,
              },
            };

            mockDiscoveryService.getOperations.mockResolvedValue(mockResult);

            const result = await tool.execute({
              language: "python",
              filePath: "test.py",
            });

            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);

            // All operations should have all original fields plus rateLimit
            parsedResult.items.forEach((op: any) => {
              // Original fields
              expect(op).toHaveProperty("name");
              expect(op).toHaveProperty("description");
              expect(op).toHaveProperty("callMethod");
              expect(op).toHaveProperty("returnedModel");

              // New field
              expect(op).toHaveProperty("rateLimit");

              // Optional field
              if (op.inputParameters !== undefined) {
                expect(op).toHaveProperty("inputParameters");
              }
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should maintain response structure with pagination metadata", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(operationArbitrary, { minLength: 0, maxLength: 20 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 100 }),
          async (operations, page, pageSize) => {
            // Reset mock for this iteration
            mockDiscoveryService.getOperations.mockClear();

            const mockResult = {
              items: operations,
              pagination: {
                page,
                pageSize,
                totalItems: operations.length,
                totalPages: Math.ceil(operations.length / pageSize),
              },
            };

            mockDiscoveryService.getOperations.mockResolvedValue(mockResult);

            const result = await tool.execute({
              language: "python",
              filePath: "test.py",
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

            // Verify no filter params were passed
            const calls = mockDiscoveryService.getOperations.mock.calls;
            expect(calls[0][3]).toBeUndefined();
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should preserve field types and values after filtering", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(operationArbitrary, { minLength: 1, maxLength: 10 }),
          async (operations) => {
            // Reset mock for this iteration
            mockDiscoveryService.getOperations.mockClear();

            const mockResult = {
              items: operations,
              pagination: {
                page: 1,
                pageSize: 50,
                totalItems: operations.length,
                totalPages: 1,
              },
            };

            mockDiscoveryService.getOperations.mockResolvedValue(mockResult);

            const result = await tool.execute({
              language: "python",
              filePath: "test.py",
            });

            expect(result.isError).toBeFalsy();
            const parsedResult = JSON.parse(result.content[0].text);

            // Check that field types are preserved
            parsedResult.items.forEach((op: any, index: number) => {
              expect(typeof op.name).toBe("string");
              expect(typeof op.description).toBe("string");
              expect(typeof op.callMethod).toBe("string");
              expect(typeof op.returnedModel).toBe("string");

              // rateLimit should be null or object
              expect(
                op.rateLimit === null || typeof op.rateLimit === "object",
              ).toBe(true);

              // Values should match original
              expect(op.name).toBe(operations[index].name);
              expect(op.description).toBe(operations[index].description);
              expect(op.callMethod).toBe(operations[index].callMethod);
              expect(op.returnedModel).toBe(operations[index].returnedModel);
            });
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
