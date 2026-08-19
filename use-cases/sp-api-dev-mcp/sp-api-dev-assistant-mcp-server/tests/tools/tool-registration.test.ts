import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Unit tests for tool registration in src/index.ts
 * Validates: Requirements 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 3.5
 *
 * Since SPAPIDevMCPServer is not exported, we read the source file as text
 * and verify tool registrations via string/regex analysis.
 */

const indexSource = readFileSync(
  join(__dirname, "..", "..", "src", "index.ts"),
  "utf-8",
);

// Extract all registerTool calls with their tool names
function extractRegisteredToolNames(source: string): string[] {
  const regex = /this\.server\.registerTool\(\s*['"`]([^'"`]+)['"`]/g;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    names.push(match[1]);
  }
  return names;
}

// Extract the description string for a specific tool registration
function extractToolDescription(source: string, toolName: string): string {
  // Find the registerTool call for this tool and extract the description
  const escapedName = toolName.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\9504f1a1-71e0-4877-b215-0679c6c4feb4",
  );
  const regex = new RegExp(
    `this\\.server\\.registerTool\\(\\s*['"\`]${escapedName}['"\`]\\s*,\\s*\\{\\s*description\\s*:\\s*`,
    "s",
  );
  const match = regex.exec(source);
  if (!match) return "";

  // Starting from after "description:", find the template literal or string
  const afterDescription = source.slice(match.index + match[0].length);

  // Handle template literal (backtick)
  if (afterDescription.startsWith("`")) {
    const endIdx = afterDescription.indexOf("`", 1);
    if (endIdx !== -1) return afterDescription.slice(1, endIdx);
  }

  // Handle template literal with newline: `...`
  if (afterDescription.trimStart().startsWith("`")) {
    const trimmed = afterDescription.trimStart();
    const endIdx = trimmed.indexOf("`", 1);
    if (endIdx !== -1) return trimmed.slice(1, endIdx);
  }

  return "";
}

const registeredTools = extractRegisteredToolNames(indexSource);

describe("Tool Registration - Requirements 1.1, 1.2, 1.3", () => {
  describe("Requirement 1.1: Single sp_api_generate_code_sample registration", () => {
    it("should register exactly one sp_api_generate_code_sample tool", () => {
      const masterToolRegistrations = registeredTools.filter(
        (name) => name === "sp_api_generate_code_sample",
      );
      expect(masterToolRegistrations).toHaveLength(1);
    });
  });

  describe("Requirement 1.2: No old sdk_* code generation tools", () => {
    const oldCodeGenTools = [
      "sdk_get_workflow_guide",
      "sdk_clone_repo",
      "sdk_get_basic_usage",
      "sdk_get_api_categories",
      "sdk_get_api_operations",
      "sdk_get_models",
    ];

    it.each(oldCodeGenTools)(
      "should not register old tool: %s",
      (oldToolName) => {
        expect(registeredTools).not.toContain(oldToolName);
      },
    );

    it("should have zero old sdk_* code generation tools total", () => {
      const oldTools = registeredTools.filter((name) =>
        oldCodeGenTools.includes(name),
      );
      expect(oldTools).toHaveLength(0);
    });
  });

  describe("Requirement 1.3: Non-code-generation tools still registered", () => {
    // Orders API tools have been removed - only sp_api_migration_assistant remains
    const nonCodeGenTools = ["sp_api_migration_assistant"];

    it.each(nonCodeGenTools)(
      "should still register non-code-gen tool: %s",
      (toolName) => {
        expect(registeredTools).toContain(toolName);
      },
    );

    it("should register all non-code-generation tools", () => {
      const found = registeredTools.filter((name) =>
        nonCodeGenTools.includes(name),
      );
      expect(found).toHaveLength(nonCodeGenTools.length);
    });
  });
});

describe("Tool Description Content - Requirements 3.1, 3.2, 3.3, 3.4, 3.5", () => {
  const description = extractToolDescription(
    indexSource,
    "sp_api_generate_code_sample",
  );

  it("should have a non-empty description for sp_api_generate_code_sample", () => {
    expect(description.length).toBeGreaterThan(0);
  });

  describe("Requirement 3.1: All six action values listed", () => {
    const actionValues = [
      "get_workflow_guide",
      "clone_repo",
      "get_basic_usage",
      "get_categories",
      "get_operations",
      "get_models",
    ];

    it.each(actionValues)("should contain action value: %s", (action) => {
      expect(description).toContain(action);
    });
  });

  describe("Requirement 3.2: Workflow sequence section", () => {
    it("should contain RECOMMENDED WORKFLOW SEQUENCE section", () => {
      expect(description).toContain("RECOMMENDED WORKFLOW SEQUENCE");
    });

    it("should contain numbered workflow steps 1 through 6", () => {
      for (let i = 1; i <= 6; i++) {
        expect(description).toMatch(new RegExp(`${i}\\.\\s*action:`));
      }
    });
  });

  describe("Requirement 3.3: Per-action parameter documentation", () => {
    it("should contain ACTIONS AND PARAMETERS section", () => {
      expect(description).toContain("ACTIONS AND PARAMETERS");
    });

    it("should document Required and Optional fields for get_workflow_guide", () => {
      expect(description).toMatch(/get_workflow_guide[\s\S]*?Optional:.*step/);
    });

    it("should document Required and Optional fields for clone_repo", () => {
      expect(description).toMatch(/clone_repo[\s\S]*?Optional:.*repositoryUrl/);
      expect(description).toMatch(/clone_repo[\s\S]*?Optional:.*targetPath/);
    });

    it("should document Required language for get_basic_usage", () => {
      expect(description).toMatch(/get_basic_usage[\s\S]*?Required:.*language/);
    });

    it("should document Required language for get_categories", () => {
      expect(description).toMatch(/get_categories[\s\S]*?Required:.*language/);
    });

    it("should document Required language and filePath for get_operations", () => {
      expect(description).toMatch(
        /get_operations[\s\S]*?Required:.*language.*filePath/,
      );
    });

    it("should document Required language and directoryPath for get_models", () => {
      expect(description).toMatch(
        /get_models[\s\S]*?Required:.*language.*directoryPath/,
      );
    });
  });

  describe("Requirement 3.4, 3.5: Output chaining instructions", () => {
    it("should contain OUTPUT CHAINING section", () => {
      expect(description).toContain("OUTPUT CHAINING");
    });

    it("should document operationsPath → filePath chaining", () => {
      expect(description).toMatch(/operationsPath.*filePath/);
    });

    it("should document modelsPath → directoryPath chaining", () => {
      expect(description).toMatch(/modelsPath.*directoryPath/);
    });
  });
});
