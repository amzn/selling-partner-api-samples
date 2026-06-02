import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetModels } from "../../src/tools/code-generation-tools/get-models.js";
import { DiscoveryService } from "../../src/tools/code-generation-tools/services/discovery.js";
import { Model } from "../../src/tools/code-generation-tools/models/model.js";

// Mock the DiscoveryService to avoid simple-git dependency
vi.mock("../../src/tools/code-generation-tools/services/discovery.js", () => {
  return {
    DiscoveryService: vi.fn().mockImplementation(() => ({
      getModels: vi.fn(),
    })),
  };
});

// Integration tests for GetModels filtering support
// Requirements: 4.1, 5.1, 7.2, 8.2
describe("GetModels Integration Tests", () => {
  let tool: GetModels;
  let mockDiscoveryService: any;

  beforeEach(() => {
    tool = new GetModels();
    mockDiscoveryService = (tool as any).discoveryService;
  });

  describe("Parameter Validation - Requirement 8.2", () => {
    it("should reject non-string models parameter", async () => {
      const result = await tool.execute({
        language: "python",
        directoryPath: "models/",
        models: 123,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("models");
      expect(result.content[0].text).toContain("string");
    });

    it("should reject non-string included_data parameter", async () => {
      const result = await tool.execute({
        language: "python",
        directoryPath: "models/",
        included_data: ["name", "swaggerType"],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("included_data");
      expect(result.content[0].text).toContain("string");
    });

    it("should accept valid filtering parameters", async () => {
      const mockModels: Model[] = [
        {
          name: "Order",
          swaggerType: "object",
          attributeMap: { orderId: "order_id" },
          isEnum: false,
          enumValues: null,
        },
      ];

      mockDiscoveryService.getModels.mockResolvedValue({
        items: mockModels,
        pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
      });

      const result = await tool.execute({
        language: "python",
        directoryPath: "models/",
        models: "Order,OrderItem",
        included_data: "name,swaggerType",
      });

      expect(result.isError).toBeFalsy();
      expect(mockDiscoveryService.getModels).toHaveBeenCalledWith(
        "python",
        "models/",
        expect.any(Object),
        expect.objectContaining({
          models: "Order,OrderItem",
          included_data: "name,swaggerType",
        }),
      );
    });
  });

  describe("Backward Compatibility - Requirement 7.2", () => {
    it("should work without filtering parameters", async () => {
      const mockModels: Model[] = [
        {
          name: "Order",
          swaggerType: "object",
          attributeMap: { orderId: "order_id" },
          isEnum: false,
          enumValues: null,
        },
      ];

      mockDiscoveryService.getModels.mockResolvedValue({
        items: mockModels,
        pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
      });

      const result = await tool.execute({
        language: "python",
        directoryPath: "models/",
      });

      expect(result.isError).toBeFalsy();
      expect(mockDiscoveryService.getModels).toHaveBeenCalledWith(
        "python",
        "models/",
        expect.any(Object),
        undefined,
      );
    });

    it("should work with only pagination parameters", async () => {
      const mockModels: Model[] = [];

      mockDiscoveryService.getModels.mockResolvedValue({
        items: mockModels,
        pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
      });

      const result = await tool.execute({
        language: "python",
        directoryPath: "models/",
        page: 1,
        pageSize: 10,
      });

      expect(result.isError).toBeFalsy();
      expect(mockDiscoveryService.getModels).toHaveBeenCalledWith(
        "python",
        "models/",
        expect.objectContaining({ page: 1, pageSize: 10 }),
        undefined,
      );
    });
  });

  describe("Combined Filtering and Pagination - Requirement 4.1, 5.1", () => {
    it("should accept both filtering and pagination parameters", async () => {
      const mockModels: Model[] = [
        {
          name: "Order",
          swaggerType: "object",
          attributeMap: { orderId: "order_id" },
          isEnum: false,
          enumValues: null,
        },
      ];

      mockDiscoveryService.getModels.mockResolvedValue({
        items: mockModels,
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      });

      const result = await tool.execute({
        language: "python",
        directoryPath: "models/",
        models: "Order",
        included_data: "name,swaggerType",
        page: 1,
        pageSize: 10,
      });

      expect(result.isError).toBeFalsy();
      expect(mockDiscoveryService.getModels).toHaveBeenCalledWith(
        "python",
        "models/",
        expect.objectContaining({ page: 1, pageSize: 10 }),
        expect.objectContaining({
          models: "Order",
          included_data: "name,swaggerType",
        }),
      );
    });
  });

  describe("Error Handling - Requirement 8.2", () => {
    it("should handle field validation errors with descriptive messages", async () => {
      mockDiscoveryService.getModels.mockRejectedValue({
        code: "INVALID_PARAMETER",
        message:
          "Invalid fields: invalidField. Valid fields are: name, swaggerType, attributeMap, isEnum, enumValues",
      });

      const result = await tool.execute({
        language: "python",
        directoryPath: "models/",
        included_data: "invalidField",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid fields");
      expect(result.content[0].text).toContain("Valid fields");
    });

    it("should handle service errors gracefully", async () => {
      mockDiscoveryService.getModels.mockRejectedValue({
        code: "REPOSITORY_NOT_FOUND",
        message: "Repository not found",
      });

      const result = await tool.execute({
        language: "python",
        directoryPath: "models/",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Repository not found");
    });
  });

  describe("Filtering by Model Names - Requirement 4.1", () => {
    it("should pass models filter to discovery service", async () => {
      mockDiscoveryService.getModels.mockResolvedValue({
        items: [],
        pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
      });

      await tool.execute({
        language: "python",
        directoryPath: "models/",
        models: "Order,OrderItem,Address",
      });

      expect(mockDiscoveryService.getModels).toHaveBeenCalledWith(
        "python",
        "models/",
        expect.any(Object),
        expect.objectContaining({
          models: "Order,OrderItem,Address",
        }),
      );
    });
  });

  describe("Field Projection with included_data - Requirement 5.1", () => {
    it("should pass included_data filter to discovery service", async () => {
      mockDiscoveryService.getModels.mockResolvedValue({
        items: [],
        pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
      });

      await tool.execute({
        language: "python",
        directoryPath: "models/",
        included_data: "name,swaggerType,isEnum",
      });

      expect(mockDiscoveryService.getModels).toHaveBeenCalledWith(
        "python",
        "models/",
        expect.any(Object),
        expect.objectContaining({
          included_data: "name,swaggerType,isEnum",
        }),
      );
    });
  });
});
