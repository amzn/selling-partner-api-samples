import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
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

// Arbitraries for generating valid args per action
const stepArbitrary = fc.constantFrom(
  "basic-usage",
  "categories",
  "operations",
  "models",
  "all",
);
const languageArbitrary = fc.constantFrom(
  "python",
  "java",
  "javascript",
  "php",
  "csharp",
);
const nonEmptyString = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

const workflowGuideArgsArbitrary = fc.record(
  { step: stepArbitrary },
  { requiredKeys: [] },
);

const cloneRepoArgsArbitrary = fc.record(
  {
    repositoryUrl: nonEmptyString,
    targetPath: nonEmptyString,
  },
  { requiredKeys: [] },
);

const basicUsageArgsArbitrary = fc.record({
  language: languageArbitrary,
});

const categoriesArgsArbitrary = fc.record({
  language: languageArbitrary,
});

const operationsArgsArbitrary = fc.record(
  {
    language: languageArbitrary,
    filePath: nonEmptyString,
    page: fc.integer({ min: 1, max: 100 }),
    pageSize: fc.integer({ min: 1, max: 100 }),
    operations: nonEmptyString,
    includedData: nonEmptyString,
  },
  { requiredKeys: ["language", "filePath"] },
);

const modelsArgsArbitrary = fc.record(
  {
    language: languageArbitrary,
    directoryPath: nonEmptyString,
    page: fc.integer({ min: 1, max: 100 }),
    pageSize: fc.integer({ min: 1, max: 100 }),
    models: nonEmptyString,
    includedData: nonEmptyString,
  },
  { requiredKeys: ["language", "directoryPath"] },
);

// Map action names to their args arbitraries
const actionArgsMap: Record<string, fc.Arbitrary<Record<string, any>>> = {
  get_workflow_guide: workflowGuideArgsArbitrary,
  clone_repo: cloneRepoArgsArbitrary,
  get_basic_usage: basicUsageArgsArbitrary,
  get_categories: categoriesArgsArbitrary,
  get_operations: operationsArgsArbitrary,
  get_models: modelsArgsArbitrary,
};

const validActions = Object.keys(actionArgsMap);

// Arbitrary that generates a random valid action with corresponding valid args
const actionWithArgsArbitrary = fc
  .constantFrom(...validActions)
  .chain((action) => actionArgsMap[action].map((args) => ({ action, args })));

// Property-based tests for CodeGenerationTool
// Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 13.2
describe("CodeGenerationTool Property Tests", () => {
  describe("Property 1: Action routing correctness", () => {
    it("should route each action to the correct tool and strip the action field from args", () => {
      fc.assert(
        fc.asyncProperty(actionWithArgsArbitrary, async ({ action, args }) => {
          // Create fresh mocked tool instances for each iteration
          const workflowGuideTool = new GetWorkflowGuide() as any;
          const cloneRepoTool = new CloneRepo() as any;
          const basicUsageTool = new GetBasicUsage() as any;
          const categoriesTool = new GetCategories() as any;
          const operationsTool = new GetOperations() as any;
          const modelsTool = new GetModels() as any;

          const masterTool = new CodeGenerationTool({
            workflowGuide: workflowGuideTool,
            cloneRepo: cloneRepoTool,
            basicUsage: basicUsageTool,
            categories: categoriesTool,
            operations: operationsTool,
            models: modelsTool,
          });

          const toolMap: Record<string, any> = {
            get_workflow_guide: workflowGuideTool,
            clone_repo: cloneRepoTool,
            get_basic_usage: basicUsageTool,
            get_categories: categoriesTool,
            get_operations: operationsTool,
            get_models: modelsTool,
          };

          await masterTool.execute({ action, ...args });

          // The correct handler should have been called exactly once
          const expectedHandler = toolMap[action];
          expect(expectedHandler.execute).toHaveBeenCalledTimes(1);

          // The args passed should NOT contain the action field
          const calledArgs = expectedHandler.execute.mock.calls[0][0];
          expect(calledArgs).not.toHaveProperty("action");

          // The args passed should match the original args (minus action),
          // with includedData renamed to included_data for get_operations/get_models
          const expectedArgs = { ...args };
          if ("includedData" in expectedArgs) {
            expectedArgs["included_data"] = expectedArgs["includedData"];
            delete expectedArgs["includedData"];
          }
          expect(calledArgs).toEqual(expectedArgs);

          // All other handlers should NOT have been called
          for (const [key, handler] of Object.entries(toolMap)) {
            if (key !== action) {
              expect((handler as any).execute).not.toHaveBeenCalled();
            }
          }
        }),
        { numRuns: 100 },
      );
    });
  });
});
