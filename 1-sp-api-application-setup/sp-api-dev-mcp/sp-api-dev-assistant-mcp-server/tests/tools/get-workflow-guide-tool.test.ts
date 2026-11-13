import { describe, it, expect } from "vitest";
import { GetWorkflowGuide } from "../../src/tools/code-generation-tools/get-workflow-guide.js";

describe("GetWorkflowGuide", () => {
  const tool = new GetWorkflowGuide();

  describe("execute", () => {
    it("should return complete workflow guide when no step specified", async () => {
      const result = await tool.execute({});

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");

      const guide = JSON.parse(result.content[0].text);
      expect(guide.overview).toBeDefined();
      expect(guide.steps).toBeDefined();
      expect(guide.common_mistakes).toBeDefined();
      expect(guide.supported_languages).toEqual([
        "python",
        "javascript",
        "java",
        "csharp",
        "php",
      ]);
    });

    it('should return complete workflow guide when step is "all"', async () => {
      const result = await tool.execute({ step: "all" });

      expect(result.content).toBeDefined();
      const guide = JSON.parse(result.content[0].text);
      expect(guide.overview.mandatory_sequence).toHaveLength(4);
      expect(guide.steps["basic-usage"]).toBeDefined();
      expect(guide.steps.categories).toBeDefined();
      expect(guide.steps.operations).toBeDefined();
      expect(guide.steps.models).toBeDefined();
    });

    it("should return basic-usage step details when requested", async () => {
      const result = await tool.execute({ step: "basic-usage" });

      expect(result.content).toBeDefined();
      const guide = JSON.parse(result.content[0].text);
      expect(guide.step.step_number).toBe(1);
      expect(guide.step.tool_name).toBe("sp_api_generate_code_sample");
      expect(guide.step.title).toBe("Get Basic Usage");
    });

    it("should return categories step details when requested", async () => {
      const result = await tool.execute({ step: "categories" });

      expect(result.content).toBeDefined();
      const guide = JSON.parse(result.content[0].text);
      expect(guide.step.step_number).toBe(2);
      expect(guide.step.tool_name).toBe("sp_api_generate_code_sample");
      expect(guide.step.critical_info).toContain("file_path and model_path");
    });

    it("should return operations step details when requested", async () => {
      const result = await tool.execute({ step: "operations" });

      expect(result.content).toBeDefined();
      const guide = JSON.parse(result.content[0].text);
      expect(guide.step.step_number).toBe(3);
      expect(guide.step.tool_name).toBe("sp_api_generate_code_sample");
      expect(guide.prerequisite).toContain("Step 2");
    });

    it("should return models step details when requested", async () => {
      const result = await tool.execute({ step: "models" });

      expect(result.content).toBeDefined();
      const guide = JSON.parse(result.content[0].text);
      expect(guide.step.step_number).toBe(4);
      expect(guide.step.tool_name).toBe("sp_api_generate_code_sample");
      expect(guide.prerequisite).toContain("Step 2");
    });

    it("should include mandatory sequence in overview", async () => {
      const result = await tool.execute({});

      const guide = JSON.parse(result.content[0].text);
      expect(guide.overview.mandatory_sequence).toEqual([
        "1. Get Basic Usage (REQUIRED)",
        "2. Get Categories (REQUIRED)",
        "3. Get Operations (REQUIRED)",
        "4. Get Models (REQUIRED - DO NOT SKIP)",
      ]);
    });

    it("should include common mistakes section", async () => {
      const result = await tool.execute({});

      const guide = JSON.parse(result.content[0].text);
      expect(guide.common_mistakes).toBeDefined();
      expect(Array.isArray(guide.common_mistakes)).toBe(true);
      expect(guide.common_mistakes.length).toBeGreaterThan(0);
    });

    it("should include example usage for each step", async () => {
      const result = await tool.execute({});

      const guide = JSON.parse(result.content[0].text);
      expect(guide.steps["basic-usage"].example).toBeDefined();
      expect(guide.steps.categories.example).toBeDefined();
      expect(guide.steps.operations.example).toBeDefined();
      expect(guide.steps.models.example).toBeDefined();
    });
  });
});

// ============================================================================
// Property-Based Tests for Workflow Guide Tool
// ============================================================================

import * as fc from "fast-check";

// Feature: generate-code-sample-master-tool, Property 8: Workflow guide tool name consistency
// **Validates: Requirements 3.1, 3.6, 5.3**
describe("Property 8: Workflow guide tool name consistency", () => {
  const tool = new GetWorkflowGuide();

  const OLD_SDK_PATTERNS = [
    "sdk_get_basic_usage",
    "sdk_get_api_categories",
    "sdk_get_api_operations",
    "sdk_get_models",
    "sdk_get_workflow_guide",
    "sdk_clone_repo",
  ];

  /**
   * Recursively extract all string values from a JSON-like object.
   */
  function extractAllStrings(obj: unknown): string[] {
    const strings: string[] = [];
    if (typeof obj === "string") {
      strings.push(obj);
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        strings.push(...extractAllStrings(item));
      }
    } else if (obj !== null && typeof obj === "object") {
      for (const value of Object.values(obj)) {
        strings.push(...extractAllStrings(value));
      }
    }
    return strings;
  }

  /**
   * Recursively extract all values at a given key from a nested object.
   */
  function extractFieldValues(obj: unknown, fieldName: string): unknown[] {
    const values: unknown[] = [];
    if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
      for (const [key, value] of Object.entries(obj)) {
        if (key === fieldName) {
          values.push(value);
        }
        values.push(...extractFieldValues(value, fieldName));
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        values.push(...extractFieldValues(item, fieldName));
      }
    }
    return values;
  }

  it("should contain no old sdk_* tool name patterns and use sp_api_generate_code_sample for all tool_name and example.tool fields", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant("all"),
          fc.constant("basic-usage"),
          fc.constant("categories"),
          fc.constant("operations"),
          fc.constant("models"),
        ),
        async (step) => {
          const result = await tool.execute({ step });
          const guide = JSON.parse(result.content[0].text);

          // 1. Extract all string values and verify none match old sdk_* patterns
          const allStrings = extractAllStrings(guide);
          for (const str of allStrings) {
            for (const oldPattern of OLD_SDK_PATTERNS) {
              expect(str).not.toContain(oldPattern);
            }
          }

          // 2. All tool_name fields should be sp_api_generate_code_sample
          const toolNames = extractFieldValues(guide, "tool_name");
          for (const name of toolNames) {
            expect(name).toBe("sp_api_generate_code_sample");
          }

          // 3. All example.tool fields should be sp_api_generate_code_sample
          const exampleTools = extractFieldValues(guide, "tool");
          for (const t of exampleTools) {
            expect(t).toBe("sp_api_generate_code_sample");
          }

          // 4. Every step object should have an action field
          if (guide.steps) {
            // 'all' response — steps is an object with step keys
            for (const stepObj of Object.values(guide.steps)) {
              expect(stepObj).toHaveProperty("action");
            }
          }
          if (guide.step) {
            // Single-step response
            expect(guide.step).toHaveProperty("action");
          }

          // 5. Every example.arguments should have an action field
          const exampleArgs = extractFieldValues(guide, "arguments");
          for (const args of exampleArgs) {
            if (args !== null && typeof args === "object") {
              expect(args).toHaveProperty("action");
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: generate-code-sample-master-tool, Property 7: Workflow guide structure and filtering
// **Validates: Requirements 5.2, 5.3**
describe("Property 7: Workflow guide structure and filtering", () => {
  const tool = new GetWorkflowGuide();

  const STEP_TO_ACTION: Record<string, string> = {
    "basic-usage": "get_basic_usage",
    categories: "get_categories",
    operations: "get_operations",
    models: "get_models",
  };

  it("should return a scoped step object with correct structure and action for each valid step", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("basic-usage", "categories", "operations", "models"),
        async (step) => {
          const result = await tool.execute({ step });
          const guide = JSON.parse(result.content[0].text);

          // 1. Response should contain a single step object (not steps)
          expect(guide).toHaveProperty("step");
          expect(guide).not.toHaveProperty("steps");

          const stepObj = guide.step;

          // 2. Step object should contain required structural fields
          expect(stepObj).toHaveProperty("tool_name");
          expect(stepObj).toHaveProperty("action");
          expect(stepObj).toHaveProperty("required_parameters");
          // Should have either what_you_get or description
          const hasWhatYouGet = "what_you_get" in stepObj;
          const hasDescription = "description" in stepObj;
          expect(hasWhatYouGet || hasDescription).toBe(true);

          // 3. tool_name should be sp_api_generate_code_sample
          expect(stepObj.tool_name).toBe("sp_api_generate_code_sample");

          // 4. action should match the expected action for the step
          expect(stepObj.action).toBe(STEP_TO_ACTION[step]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
