import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetOperations } from "../../src/tools/code-generation-tools/get-operations.js";
import { DiscoveryService } from "../../src/tools/code-generation-tools/services/discovery.js";
import { Operation } from "../../src/tools/code-generation-tools/models/operation.js";

// Mock the DiscoveryService to avoid simple-git dependency
vi.mock("../../src/tools/code-generation-tools/services/discovery.js", () => {
  return {
    DiscoveryService: vi.fn().mockImplementation(() => ({
      getOperations: vi.fn(),
    })),
  };
});

// Integration tests for GetOperations filtering support
// Requirements: 1.1, 2.1, 7.1, 8.1
describe("GetOperations Integration Tests", () => {
  let tool: GetOperations;
  let mockDiscoveryService: any;

  beforeEach(() => {
    tool = new GetOperations();
    mockDiscoveryService = (tool as any).discoveryService;
  });

  describe("Parameter Validation - Requirement 8.1", () => {
    it("should reject non-string operations parameter", async () => {
      const result = await tool.execute({
        language: "python",
        filePath: "test.py",
        operations: 123,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("operations");
      expect(result.content[0].text).toContain("string");
    });

    it("should reject non-string included_data parameter", async () => {
      const result = await tool.execute({
        language: "python",
        filePath: "test.py",
        included_data: ["name", "description"],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("included_data");
      expect(result.content[0].text).toContain("string");
    });

    it("should accept valid filtering parameters", async () => {
      const mockOperations: Operation[] = [
        {
          name: "getOrder",
          description: "Get order details",
          callMethod: "GET",
          returnedModel: "Order",
          rateLimit: null,
        },
      ];

      mockDiscoveryService.getOperations.mockResolvedValue({
        items: mockOperations,
        pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
      });

      const result = await tool.execute({
        language: "python",
        filePath: "test.py",
        operations: "getOrder,listOrders",
        included_data: "name,description",
      });

      expect(result.isError).toBeFalsy();
      expect(mockDiscoveryService.getOperations).toHaveBeenCalledWith(
        "python",
        "test.py",
        expect.any(Object),
        expect.objectContaining({
          operations: "getOrder,listOrders",
          included_data: "name,description",
        }),
      );
    });
  });

  describe("Backward Compatibility - Requirement 7.1", () => {
    it("should work without filtering parameters", async () => {
      const mockOperations: Operation[] = [
        {
          name: "getOrder",
          description: "Get order details",
          callMethod: "GET",
          returnedModel: "Order",
          rateLimit: null,
        },
      ];

      mockDiscoveryService.getOperations.mockResolvedValue({
        items: mockOperations,
        pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
      });

      const result = await tool.execute({
        language: "python",
        filePath: "test.py",
      });

      expect(result.isError).toBeFalsy();
      expect(mockDiscoveryService.getOperations).toHaveBeenCalledWith(
        "python",
        "test.py",
        expect.any(Object),
        undefined,
      );
    });

    it("should work with only pagination parameters", async () => {
      const mockOperations: Operation[] = [];

      mockDiscoveryService.getOperations.mockResolvedValue({
        items: mockOperations,
        pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
      });

      const result = await tool.execute({
        language: "python",
        filePath: "test.py",
        page: 1,
        pageSize: 10,
      });

      expect(result.isError).toBeFalsy();
      expect(mockDiscoveryService.getOperations).toHaveBeenCalledWith(
        "python",
        "test.py",
        expect.objectContaining({ page: 1, pageSize: 10 }),
        undefined,
      );
    });
  });

  describe("Combined Filtering and Pagination - Requirement 1.1, 2.1", () => {
    it("should accept both filtering and pagination parameters", async () => {
      const mockOperations: Operation[] = [
        {
          name: "getOrder",
          description: "Get order details",
          callMethod: "GET",
          returnedModel: "Order",
          rateLimit: { requestsPerSecond: 0.5 },
        },
      ];

      mockDiscoveryService.getOperations.mockResolvedValue({
        items: mockOperations,
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      });

      const result = await tool.execute({
        language: "python",
        filePath: "test.py",
        operations: "getOrder",
        included_data: "name,description",
        page: 1,
        pageSize: 10,
      });

      expect(result.isError).toBeFalsy();
      expect(mockDiscoveryService.getOperations).toHaveBeenCalledWith(
        "python",
        "test.py",
        expect.objectContaining({ page: 1, pageSize: 10 }),
        expect.objectContaining({
          operations: "getOrder",
          included_data: "name,description",
        }),
      );
    });
  });

  describe("Error Handling - Requirement 8.1", () => {
    it("should handle field validation errors with descriptive messages", async () => {
      mockDiscoveryService.getOperations.mockRejectedValue({
        code: "INVALID_PARAMETER",
        message:
          "Invalid fields: invalidField. Valid fields are: name, description, callMethod, inputParameters, returnedModel, rateLimit",
      });

      const result = await tool.execute({
        language: "python",
        filePath: "test.py",
        included_data: "invalidField",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid fields");
      expect(result.content[0].text).toContain("Valid fields");
    });

    it("should handle service errors gracefully", async () => {
      mockDiscoveryService.getOperations.mockRejectedValue({
        code: "REPOSITORY_NOT_FOUND",
        message: "Repository not found",
      });

      const result = await tool.execute({
        language: "python",
        filePath: "test.py",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Repository not found");
    });
  });

  describe("Filtering by Operation Names - Requirement 1.1", () => {
    it("should pass operations filter to discovery service", async () => {
      mockDiscoveryService.getOperations.mockResolvedValue({
        items: [],
        pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
      });

      await tool.execute({
        language: "python",
        filePath: "test.py",
        operations: "getOrder,listOrders,cancelOrder",
      });

      expect(mockDiscoveryService.getOperations).toHaveBeenCalledWith(
        "python",
        "test.py",
        expect.any(Object),
        expect.objectContaining({
          operations: "getOrder,listOrders,cancelOrder",
        }),
      );
    });
  });

  describe("Field Projection with included_data - Requirement 2.1", () => {
    it("should pass included_data filter to discovery service", async () => {
      mockDiscoveryService.getOperations.mockResolvedValue({
        items: [],
        pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
      });

      await tool.execute({
        language: "python",
        filePath: "test.py",
        included_data: "name,description,rateLimit",
      });

      expect(mockDiscoveryService.getOperations).toHaveBeenCalledWith(
        "python",
        "test.py",
        expect.any(Object),
        expect.objectContaining({
          included_data: "name,description,rateLimit",
        }),
      );
    });
  });
});
