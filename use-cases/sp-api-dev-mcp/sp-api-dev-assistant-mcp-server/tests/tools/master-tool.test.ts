import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodeGenerationTool } from "../../src/tools/code-generation-tools/code-generation-tool.js";

// Mock all six dependency tool modules
vi.mock("../../src/tools/code-generation-tools/get-workflow-guide.js", () => ({
  GetWorkflowGuide: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "workflow-guide-result" }],
    }),
  })),
}));

vi.mock("../../src/utils/clone-repo.js", () => ({
  CloneRepo: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "clone-repo-result" }],
    }),
  })),
}));

vi.mock("../../src/tools/code-generation-tools/get-basic-usage.js", () => ({
  GetBasicUsage: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "basic-usage-result" }],
    }),
  })),
}));

vi.mock("../../src/tools/code-generation-tools/get-categories.js", () => ({
  GetCategories: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "categories-result" }],
    }),
  })),
}));

vi.mock("../../src/tools/code-generation-tools/get-operations.js", () => ({
  GetOperations: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "operations-result" }],
    }),
  })),
}));

vi.mock("../../src/tools/code-generation-tools/get-models.js", () => ({
  GetModels: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "models-result" }],
    }),
  })),
}));

import { GetWorkflowGuide } from "../../src/tools/code-generation-tools/get-workflow-guide.js";
import { CloneRepo } from "../../src/utils/clone-repo.js";
import { GetBasicUsage } from "../../src/tools/code-generation-tools/get-basic-usage.js";
import { GetCategories } from "../../src/tools/code-generation-tools/get-categories.js";
import { GetOperations } from "../../src/tools/code-generation-tools/get-operations.js";
import { GetModels } from "../../src/tools/code-generation-tools/get-models.js";

// Unit tests for CodeGenerationTool
// Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 12.4
describe("CodeGenerationTool Unit Tests", () => {
  let masterTool: CodeGenerationTool;
  let workflowGuideTool: any;
  let cloneRepoTool: any;
  let basicUsageTool: any;
  let categoriesTool: any;
  let operationsTool: any;
  let modelsTool: any;

  beforeEach(() => {
    workflowGuideTool = new GetWorkflowGuide() as any;
    cloneRepoTool = new CloneRepo() as any;
    basicUsageTool = new GetBasicUsage() as any;
    categoriesTool = new GetCategories() as any;
    operationsTool = new GetOperations() as any;
    modelsTool = new GetModels() as any;

    masterTool = new CodeGenerationTool({
      workflowGuide: workflowGuideTool,
      cloneRepo: cloneRepoTool,
      basicUsage: basicUsageTool,
      categories: categoriesTool,
      operations: operationsTool,
      models: modelsTool,
    });
  });

  describe("Unknown action handling - Requirement 2.8, 12.4", () => {
    it("should return isError true for an unknown action", async () => {
      const result = await masterTool.execute({ action: "invalid_action" });

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("Unknown action");
      expect(result.content[0].text).toContain("invalid_action");
    });

    it("should list all valid actions in the error message", async () => {
      const result = await masterTool.execute({ action: "nonexistent" });

      expect(result.isError).toBe(true);
      const errorText = result.content[0].text;
      expect(errorText).toContain("get_workflow_guide");
      expect(errorText).toContain("clone_repo");
      expect(errorText).toContain("get_basic_usage");
      expect(errorText).toContain("get_categories");
      expect(errorText).toContain("get_operations");
      expect(errorText).toContain("get_models");
    });

    it("should return isError true for undefined action", async () => {
      const result = await masterTool.execute({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown action");
    });
  });

  describe("Action routing - Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.7", () => {
    it("should route get_workflow_guide to GetWorkflowGuide", async () => {
      const args = { action: "get_workflow_guide", step: "all" };

      const result = await masterTool.execute(args);

      expect(workflowGuideTool.execute).toHaveBeenCalledTimes(1);
      expect(workflowGuideTool.execute).toHaveBeenCalledWith({ step: "all" });
      expect(result.content[0].text).toBe("workflow-guide-result");
    });

    it("should route clone_repo to CloneRepo", async () => {
      const args = {
        action: "clone_repo",
        repositoryUrl: "https://example.com/repo.git",
        targetPath: "./sdk",
      };

      const result = await masterTool.execute(args);

      expect(cloneRepoTool.execute).toHaveBeenCalledTimes(1);
      expect(cloneRepoTool.execute).toHaveBeenCalledWith({
        repositoryUrl: "https://example.com/repo.git",
        targetPath: "./sdk",
      });
      expect(result.content[0].text).toBe("clone-repo-result");
    });

    it("should route get_basic_usage to GetBasicUsage", async () => {
      const args = { action: "get_basic_usage", language: "python" };

      const result = await masterTool.execute(args);

      expect(basicUsageTool.execute).toHaveBeenCalledTimes(1);
      expect(basicUsageTool.execute).toHaveBeenCalledWith({
        language: "python",
      });
      expect(result.content[0].text).toBe("basic-usage-result");
    });

    it("should route get_categories to GetCategories", async () => {
      const args = { action: "get_categories", language: "java" };

      const result = await masterTool.execute(args);

      expect(categoriesTool.execute).toHaveBeenCalledTimes(1);
      expect(categoriesTool.execute).toHaveBeenCalledWith({ language: "java" });
      expect(result.content[0].text).toBe("categories-result");
    });

    it("should route get_operations to GetOperations", async () => {
      const args = {
        action: "get_operations",
        language: "javascript",
        filePath: "api/orders.js",
      };

      const result = await masterTool.execute(args);

      expect(operationsTool.execute).toHaveBeenCalledTimes(1);
      expect(operationsTool.execute).toHaveBeenCalledWith({
        language: "javascript",
        filePath: "api/orders.js",
      });
      expect(result.content[0].text).toBe("operations-result");
    });

    it("should route get_models to GetModels", async () => {
      const args = {
        action: "get_models",
        language: "csharp",
        directoryPath: "models/",
      };

      const result = await masterTool.execute(args);

      expect(modelsTool.execute).toHaveBeenCalledTimes(1);
      expect(modelsTool.execute).toHaveBeenCalledWith({
        language: "csharp",
        directoryPath: "models/",
      });
      expect(result.content[0].text).toBe("models-result");
    });
  });

  describe("Action field stripping - Requirement 13.2", () => {
    it("should not pass the action field to the delegated tool", async () => {
      await masterTool.execute({
        action: "get_basic_usage",
        language: "python",
      });

      const calledArgs = basicUsageTool.execute.mock.calls[0][0];
      expect(calledArgs).not.toHaveProperty("action");
      expect(calledArgs).toEqual({ language: "python" });
    });

    it("should pass all other args except action to the delegated tool", async () => {
      await masterTool.execute({
        action: "get_operations",
        language: "python",
        filePath: "api/orders.py",
        page: 2,
        pageSize: 25,
      });

      const calledArgs = operationsTool.execute.mock.calls[0][0];
      expect(calledArgs).not.toHaveProperty("action");
      expect(calledArgs).toEqual({
        language: "python",
        filePath: "api/orders.py",
        page: 2,
        pageSize: 25,
      });
    });

    it("should pass empty object when action is the only arg", async () => {
      await masterTool.execute({ action: "get_workflow_guide" });

      const calledArgs = workflowGuideTool.execute.mock.calls[0][0];
      expect(calledArgs).not.toHaveProperty("action");
      expect(calledArgs).toEqual({});
    });
  });

  describe("Isolation - only the targeted tool is called", () => {
    it("should not call any other tools when routing to get_workflow_guide", async () => {
      await masterTool.execute({ action: "get_workflow_guide" });

      expect(workflowGuideTool.execute).toHaveBeenCalledTimes(1);
      expect(cloneRepoTool.execute).not.toHaveBeenCalled();
      expect(basicUsageTool.execute).not.toHaveBeenCalled();
      expect(categoriesTool.execute).not.toHaveBeenCalled();
      expect(operationsTool.execute).not.toHaveBeenCalled();
      expect(modelsTool.execute).not.toHaveBeenCalled();
    });

    it("should not call any other tools when routing to get_models", async () => {
      await masterTool.execute({
        action: "get_models",
        language: "python",
        directoryPath: "models/",
      });

      expect(modelsTool.execute).toHaveBeenCalledTimes(1);
      expect(workflowGuideTool.execute).not.toHaveBeenCalled();
      expect(cloneRepoTool.execute).not.toHaveBeenCalled();
      expect(basicUsageTool.execute).not.toHaveBeenCalled();
      expect(categoriesTool.execute).not.toHaveBeenCalled();
      expect(operationsTool.execute).not.toHaveBeenCalled();
    });
  });
});
