import { GetWorkflowGuide } from "./get-workflow-guide.js";
import { CloneRepo } from "../../utils/clone-repo.js";
import { GetBasicUsage } from "./get-basic-usage.js";
import { GetCategories } from "./get-categories.js";
import { GetOperations } from "./get-operations.js";
import { GetModels } from "./get-models.js";

/**
 * Tool that routes action-based requests to the appropriate code generation sub-tool.
 *
 * Implements requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 12.4, 13.2
 *
 * Valid actions:
 * - get_workflow_guide: Delegates to GetWorkflowGuide
 * - clone_repo: Delegates to CloneRepo
 * - get_basic_usage: Delegates to GetBasicUsage
 * - get_categories: Delegates to GetCategories
 * - get_operations: Delegates to GetOperations
 * - get_models: Delegates to GetModels
 */
export class CodeGenerationTool {
  private static readonly PARAM_ALLOWLIST: Record<string, string[]> = {
    get_workflow_guide: ["step"],
    clone_repo: ["repositoryUrl", "targetPath"],
    get_basic_usage: ["language"],
    get_categories: ["language"],
    get_operations: [
      "language",
      "filePath",
      "page",
      "pageSize",
      "operations",
      "includedData",
    ],
    get_models: [
      "language",
      "directoryPath",
      "page",
      "pageSize",
      "models",
      "includedData",
    ],
  };

  private readonly handlers: Record<
    string,
    { execute: (args: Record<string, any>) => Promise<any> }
  >;

  constructor(overrides?: {
    workflowGuide?: GetWorkflowGuide;
    cloneRepo?: CloneRepo;
    basicUsage?: GetBasicUsage;
    categories?: GetCategories;
    operations?: GetOperations;
    models?: GetModels;
  }) {
    this.handlers = {
      get_workflow_guide: overrides?.workflowGuide ?? new GetWorkflowGuide(),
      clone_repo: overrides?.cloneRepo ?? new CloneRepo(),
      get_basic_usage: overrides?.basicUsage ?? new GetBasicUsage(),
      get_categories: overrides?.categories ?? new GetCategories(),
      get_operations: overrides?.operations ?? new GetOperations(),
      get_models: overrides?.models ?? new GetModels(),
    };
  }

  /**
   * Execute the tool by routing to the appropriate sub-tool based on the action parameter.
   *
   * @param args - Tool arguments containing an `action` field and any additional parameters for the sub-tool
   * @returns The result from the delegated sub-tool, or an error response for unknown actions
   */
  async execute(args: Record<string, any>): Promise<any> {
    const { action, ...params } = args;

    const handler = Object.hasOwn(this.handlers, action)
      ? this.handlers[action]
      : undefined;
    if (!handler) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Unknown action "${action}". Valid actions: ${Object.keys(this.handlers).join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    const allowedKeys = CodeGenerationTool.PARAM_ALLOWLIST[action] ?? [];
    const filteredParams: Record<string, any> = {};
    for (const key of allowedKeys) {
      if (key in params) {
        filteredParams[key] = params[key];
      }
    }

    if ("includedData" in filteredParams) {
      filteredParams["included_data"] = filteredParams["includedData"];
      delete filteredParams["includedData"];
    }

    return handler.execute(filteredParams);
  }
}
