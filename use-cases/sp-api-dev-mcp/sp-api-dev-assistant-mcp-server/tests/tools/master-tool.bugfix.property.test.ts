import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { CodeGenerationTool } from "../../src/tools/code-generation-tools/code-generation-tool.js";
import { masterCodeGenerationSchema } from "../../src/zod-schemas/code-generation-schemas.js";

// Mock all six dependency tool modules (same pattern as master-tool.property.test.ts)
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

// Arbitraries for generating valid per-action params
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

// Non-pagination actions and their valid param arbitraries (NO page/pageSize)
const nonPaginationActionArgsMap: Record<
  string,
  fc.Arbitrary<Record<string, any>>
> = {
  get_basic_usage: fc.record({ language: languageArbitrary }),
  get_categories: fc.record({ language: languageArbitrary }),
  get_workflow_guide: fc.record({ step: stepArbitrary }, { requiredKeys: [] }),
  clone_repo: fc.record(
    {
      repositoryUrl: fc.constant("https://example.com/repo"),
      targetPath: nonEmptyString,
    },
    { requiredKeys: [] },
  ),
};

// Arbitrary that generates a non-pagination action with valid params (no page/pageSize provided)
const nonPaginationActionWithArgs = fc
  .constantFrom(...Object.keys(nonPaginationActionArgsMap))
  .chain((action) =>
    nonPaginationActionArgsMap[action].map((args) => ({ action, args })),
  );

// Pagination actions with includedData always present
const operationsWithIncludedData = fc.record(
  {
    language: languageArbitrary,
    filePath: nonEmptyString,
    includedData: nonEmptyString,
  },
  { requiredKeys: ["language", "filePath", "includedData"] },
);

const modelsWithIncludedData = fc.record(
  {
    language: languageArbitrary,
    directoryPath: nonEmptyString,
    includedData: nonEmptyString,
  },
  { requiredKeys: ["language", "directoryPath", "includedData"] },
);

// Arbitrary that generates get_operations or get_models with includedData
const paginationActionWithIncludedData = fc.oneof(
  operationsWithIncludedData.map((args) => ({
    action: "get_operations" as const,
    args,
  })),
  modelsWithIncludedData.map((args) => ({
    action: "get_models" as const,
    args,
  })),
);

// Helper: create fresh mocked tool instances and master tool
function createMasterTool() {
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

  return { masterTool, toolMap };
}

// Bug condition exploration tests
// These tests encode EXPECTED (correct) behavior and are expected to FAIL on unfixed code
describe("Bug Condition Exploration: Leaked Defaults and camelCase Mismatch", () => {
  /**
   * Property 1a - Default Leak
   * Validates: Requirements 1.1, 1.2, 1.3, 1.4
   *
   * For non-pagination actions (get_basic_usage, get_categories, get_workflow_guide, clone_repo)
   * with valid per-action params and NO explicit page/pageSize, the sub-tool args should NOT
   * contain page or pageSize keys.
   *
   * On UNFIXED code, this FAILS because Zod's .default() injects page=1, pageSize=50.
   */
  it("Property 1a: non-pagination actions should NOT receive leaked page/pageSize defaults", async () => {
    await fc.assert(
      fc.asyncProperty(
        nonPaginationActionWithArgs,
        async ({ action, args }) => {
          const { masterTool, toolMap } = createMasterTool();

          // Parse through Zod schema (this is where defaults get injected)
          const rawInput = { action, ...args };
          const parsed = masterCodeGenerationSchema.parse(rawInput);

          // Execute with Zod-parsed input (simulates real MCP flow)
          await masterTool.execute(parsed);

          // Capture args passed to the sub-tool
          const handler = toolMap[action];
          expect(handler.execute).toHaveBeenCalledTimes(1);
          const calledArgs = handler.execute.mock.calls[0][0];

          // Sub-tool should NOT receive page or pageSize (they are irrelevant)
          expect(calledArgs).not.toHaveProperty("page");
          expect(calledArgs).not.toHaveProperty("pageSize");
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Property 1b - camelCase Mismatch
   * Validates: Requirements 1.5, 1.6
   *
   * For get_operations and get_models with includedData provided, the sub-tool args should
   * contain included_data (snake_case) and NOT includedData (camelCase).
   *
   * On UNFIXED code, this FAILS because the master tool passes includedData as-is,
   * but sub-tools expect included_data.
   */
  it("Property 1b: get_operations/get_models should receive included_data (snake_case), not includedData (camelCase)", async () => {
    await fc.assert(
      fc.asyncProperty(
        paginationActionWithIncludedData,
        async ({ action, args }) => {
          const { masterTool, toolMap } = createMasterTool();

          // Parse through Zod schema
          const rawInput = { action, ...args };
          const parsed = masterCodeGenerationSchema.parse(rawInput);

          // Execute with Zod-parsed input
          await masterTool.execute(parsed);

          // Capture args passed to the sub-tool
          const handler = toolMap[action];
          expect(handler.execute).toHaveBeenCalledTimes(1);
          const calledArgs = handler.execute.mock.calls[0][0];

          // Sub-tool should receive included_data (snake_case)
          expect(calledArgs).toHaveProperty("included_data");
          // Sub-tool should NOT receive includedData (camelCase)
          expect(calledArgs).not.toHaveProperty("includedData");
        },
      ),
      { numRuns: 50 },
    );
  });
});

// --- Arbitraries for Preservation Tests ---

// Valid actions list
const validActions = [
  "get_workflow_guide",
  "clone_repo",
  "get_basic_usage",
  "get_categories",
  "get_operations",
  "get_models",
] as const;

// All valid actions mapped to their per-action param arbitraries
const allActionArgsMap: Record<string, fc.Arbitrary<Record<string, any>>> = {
  get_basic_usage: fc.record({ language: languageArbitrary }),
  get_categories: fc.record({ language: languageArbitrary }),
  get_workflow_guide: fc.record({ step: stepArbitrary }, { requiredKeys: [] }),
  clone_repo: fc.record(
    {
      repositoryUrl: fc.constant("https://example.com/repo"),
      targetPath: nonEmptyString,
    },
    { requiredKeys: [] },
  ),
  get_operations: fc.record(
    {
      language: languageArbitrary,
      filePath: nonEmptyString,
      page: fc.integer({ min: 1, max: 100 }),
      pageSize: fc.integer({ min: 1, max: 100 }),
    },
    { requiredKeys: ["language", "filePath"] },
  ),
  get_models: fc.record(
    {
      language: languageArbitrary,
      directoryPath: nonEmptyString,
      page: fc.integer({ min: 1, max: 100 }),
      pageSize: fc.integer({ min: 1, max: 100 }),
    },
    { requiredKeys: ["language", "directoryPath"] },
  ),
};

// Arbitrary that generates any valid action with valid per-action args
const anyValidActionWithArgs = fc
  .constantFrom(...Object.keys(allActionArgsMap))
  .chain((action) =>
    allActionArgsMap[action].map((args) => ({ action, args })),
  );

// Arbitrary for unknown action strings (not in valid action set)
const unknownActionArbitrary = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter(
    (s) =>
      s.trim().length > 0 && !(validActions as readonly string[]).includes(s),
  );

// Arbitrary for get_operations/get_models with EXPLICIT page and pageSize
const operationsWithExplicitPagination = fc.record({
  language: languageArbitrary,
  filePath: nonEmptyString,
  page: fc.integer({ min: 1, max: 100 }),
  pageSize: fc.integer({ min: 1, max: 100 }),
});

const modelsWithExplicitPagination = fc.record({
  language: languageArbitrary,
  directoryPath: nonEmptyString,
  page: fc.integer({ min: 1, max: 100 }),
  pageSize: fc.integer({ min: 1, max: 100 }),
});

const paginationActionWithExplicitPagination = fc.oneof(
  operationsWithExplicitPagination.map((args) => ({
    action: "get_operations" as const,
    args,
  })),
  modelsWithExplicitPagination.map((args) => ({
    action: "get_models" as const,
    args,
  })),
);

// Preservation property tests
// These tests capture baseline behavior on UNFIXED code and must PASS
describe("Preservation: Routing, Error Handling, and Parameter Forwarding", () => {
  /**
   * Property 2a - Routing Preservation
   * Validates: Requirements 3.1, 3.2
   *
   * For all valid actions with valid per-action args, the correct sub-tool handler
   * is called exactly once and no other handlers are called.
   */
  it("Property 2a: each valid action routes to the correct handler and no others", async () => {
    await fc.assert(
      fc.asyncProperty(anyValidActionWithArgs, async ({ action, args }) => {
        const { masterTool, toolMap } = createMasterTool();

        // Parse through Zod schema to simulate real MCP flow
        const rawInput = { action, ...args };
        const parsed = masterCodeGenerationSchema.parse(rawInput);

        await masterTool.execute(parsed);

        // The correct handler should be called exactly once
        const expectedHandler = toolMap[action];
        expect(expectedHandler.execute).toHaveBeenCalledTimes(1);

        // No other handlers should be called
        for (const [otherAction, otherHandler] of Object.entries(toolMap)) {
          if (otherAction !== action) {
            expect(otherHandler.execute).not.toHaveBeenCalled();
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2b - Unknown Action Preservation
   * Validates: Requirement 3.3
   *
   * For all strings NOT in the valid action set, execute() returns { isError: true }
   * with a message containing all valid action names.
   */
  it("Property 2b: unknown actions return isError with valid action list", async () => {
    await fc.assert(
      fc.asyncProperty(unknownActionArbitrary, async (unknownAction) => {
        const { masterTool } = createMasterTool();

        const result = await masterTool.execute({ action: unknownAction });

        expect(result).toHaveProperty("isError", true);
        expect(result.content).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);

        const errorText = result.content[0].text;
        // Error message should contain all valid action names
        for (const validAction of validActions) {
          expect(errorText).toContain(validAction);
        }
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Property 2c - Explicit Pagination Preservation
   * Validates: Requirements 3.1, 3.2
   *
   * For get_operations/get_models with explicitly provided page/pageSize,
   * the sub-tool receives those exact values.
   */
  it("Property 2c: explicit page/pageSize are forwarded to pagination sub-tools", async () => {
    await fc.assert(
      fc.asyncProperty(
        paginationActionWithExplicitPagination,
        async ({ action, args }) => {
          const { masterTool, toolMap } = createMasterTool();

          // Parse through Zod schema
          const rawInput = { action, ...args };
          const parsed = masterCodeGenerationSchema.parse(rawInput);

          await masterTool.execute(parsed);

          // Capture args passed to the sub-tool
          const handler = toolMap[action];
          expect(handler.execute).toHaveBeenCalledTimes(1);
          const calledArgs = handler.execute.mock.calls[0][0];

          // Sub-tool should receive the exact page and pageSize values provided
          expect(calledArgs.page).toBe(args.page);
          expect(calledArgs.pageSize).toBe(args.pageSize);
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Property 2d - Action Stripping
   * Validates: Requirement 3.4
   *
   * For all valid actions, the action field is NOT present in the args
   * passed to the sub-tool.
   */
  it("Property 2d: action field is stripped before forwarding to sub-tool", async () => {
    await fc.assert(
      fc.asyncProperty(anyValidActionWithArgs, async ({ action, args }) => {
        const { masterTool, toolMap } = createMasterTool();

        // Parse through Zod schema
        const rawInput = { action, ...args };
        const parsed = masterCodeGenerationSchema.parse(rawInput);

        await masterTool.execute(parsed);

        // Capture args passed to the sub-tool
        const handler = toolMap[action];
        expect(handler.execute).toHaveBeenCalledTimes(1);
        const calledArgs = handler.execute.mock.calls[0][0];

        // The action field should NOT be in the args passed to the sub-tool
        expect(calledArgs).not.toHaveProperty("action");
      }),
      { numRuns: 100 },
    );
  });
});
