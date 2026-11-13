/**
 * Provides workflow guidance on using code generation classes
 * Returns step-by-step instructions for the proper sequence of usage
 */
export class GetWorkflowGuide {
  /**
   * Execute the workflow guide
   * @param args - Arguments containing optional step parameter
   * @returns Execution result with workflow guidance
   */
  async execute(args: Record<string, any>): Promise<any> {
    const step = args.step || "all";

    const workflowGuide = {
      overview: {
        title: "Code Generation Tools Workflow",
        description:
          "Follow these steps in sequence to effectively use the SP-API code generation tools",
        critical_warning:
          '⚠️ ALWAYS call sp_api_generate_code_sample with action: "get_workflow_guide" FIRST before using any other code generation actions. This ensures you follow the correct sequence and have all required information.',
        mandatory_requirement:
          "🚨 ALL 4 STEPS ARE MANDATORY - You MUST complete every step in order. DO NOT skip Step 4 (Get Models) even if you think you have enough information. Models are essential for understanding response structures and generating correct code.",
        mandatory_sequence: [
          "1. Get Basic Usage (REQUIRED)",
          "2. Get Categories (REQUIRED)",
          "3. Get Operations (REQUIRED)",
          "4. Get Models (REQUIRED - DO NOT SKIP)",
        ],
        important_notes: [
          "ALL 4 steps are mandatory - never skip any step",
          "Step 4 (Get Models) is NOT optional - it provides essential response structure information",
          "Always follow this exact sequence",
          "Use the same programming language throughout the workflow",
          "Save file_path and model_path from categories for use in operations and models",
          "Never skip steps or attempt to use tools out of order",
        ],
      },
      steps: {
        "basic-usage": {
          step_number: 1,
          tool_name: "sp_api_generate_code_sample",
          action: "get_basic_usage",
          title: "Get Basic Usage",
          description:
            "Retrieve setup instructions and basic usage information for the SDK in your chosen programming language",
          when_to_use:
            "First step - to understand SDK setup and authentication",
          required_parameters: {
            language:
              "Programming language (python, java, javascript, php, csharp)",
          },
          optional_parameters: {},
          example: {
            tool: "sp_api_generate_code_sample",
            arguments: {
              action: "get_basic_usage",
              language: "python",
            },
          },
          what_you_get: [
            "SDK installation instructions",
            "Authentication setup guide",
            "Basic code examples",
            "Configuration requirements",
          ],
          next_step:
            "After understanding basic setup, proceed to Step 2: Get Categories",
        },
        categories: {
          step_number: 2,
          tool_name: "sp_api_generate_code_sample",
          action: "get_categories",
          title: "Get Categories",
          description:
            "Discover all available API categories for your programming language",
          when_to_use:
            "Second step - to find available APIs and get paths for next steps",
          required_parameters: {
            language: "Programming language (must match Step 1)",
          },
          optional_parameters: {},
          example: {
            tool: "sp_api_generate_code_sample",
            arguments: {
              action: "get_categories",
              language: "python",
            },
          },
          what_you_get: [
            "List of all API categories (e.g., OrdersV0, CatalogItems)",
            "file_path for each category (needed for operations)",
            "model_path for each category (needed for models)",
            "Category descriptions",
          ],
          critical_info:
            "SAVE the file_path and model_path from the category you want to explore - you will need these for Steps 3 and 4",
          next_step:
            "After getting categories, proceed to Steps 3 and 4 (can be done in any order)",
        },
        operations: {
          step_number: 3,
          tool_name: "sp_api_generate_code_sample",
          action: "get_operations",
          title: "Get Operations",
          description:
            "Retrieve all API operations (methods) for a specific category",
          when_to_use:
            "Third step - to discover available API methods and their parameters",
          required_parameters: {
            language: "Programming language (must match previous steps)",
            filePath: "The operationsPath obtained from Step 2 (categories)",
          },
          optional_parameters: {
            page: "Page number for pagination (default: 1)",
            page_size: "Results per page (default: 10, max: 100)",
            operations: "Comma-separated operation names to filter",
            included_data: "Comma-separated fields to include in response",
          },
          example: {
            tool: "sp_api_generate_code_sample",
            arguments: {
              action: "get_operations",
              language: "python",
              filePath: "selling_partner_api_models/orders_v0/orders_v0_api.py",
              page: 1,
              page_size: 10,
            },
          },
          what_you_get: [
            "Operation names (e.g., get_order, get_orders)",
            "Input parameters with types and descriptions",
            "Return types",
            "HTTP methods and endpoints",
          ],
          critical_info:
            "The file_path MUST come from Step 2 - do not construct it manually",
          next_step:
            "Proceed to Step 4 (Get Models) - this step is REQUIRED and must not be skipped",
        },
        models: {
          step_number: 4,
          tool_name: "sp_api_generate_code_sample",
          action: "get_models",
          title: "Get Models (REQUIRED FINAL STEP)",
          description:
            "Retrieve data models (request/response structures) for a specific API category. Models define the structure of data sent to and received from the API. THIS STEP IS MANDATORY - models are essential for understanding response structures and generating correct code.",
          when_to_use:
            "Fourth step (REQUIRED) - to understand data structures used by the API. DO NOT skip this step.",
          required_parameters: {
            language: "Programming language (must match previous steps)",
            directoryPath: "The modelsPath obtained from Step 2 (categories)",
          },
          optional_parameters: {
            page: "Page number for pagination (default: 1)",
            page_size: "Results per page (default: 10, max: 100)",
            models: "Comma-separated model names to filter",
            included_data: "Comma-separated fields to include in response",
          },
          example: {
            tool: "sp_api_generate_code_sample",
            arguments: {
              action: "get_models",
              language: "python",
              directoryPath: "selling_partner_api_models/orders_v0/models",
              page: 1,
              page_size: 10,
            },
          },
          what_you_get: [
            "Model names (e.g., Order, OrderItem)",
            "Properties with types and descriptions",
            "Required vs optional fields",
            "Nested model structures",
            "Complete understanding of API response structures",
          ],
          critical_info:
            "🚨 CRITICAL: This step is MANDATORY and must NOT be skipped. The model_path MUST come from Step 2 - do not construct it manually. Models provide essential information about response structures that is required for generating correct code.",
          next_step:
            "Workflow complete - you now have ALL information needed to use the API correctly. Only after completing this step should you generate code.",
        },
      },
      common_mistakes: [
        {
          mistake: "Skipping Step 1 (Basic Usage)",
          consequence: "Missing critical setup and authentication information",
          solution:
            'Always start with sp_api_generate_code_sample with action: "get_basic_usage" to understand SDK setup',
        },
        {
          mistake: "Not getting categories before operations/models",
          consequence: "Missing required file_path and model_path parameters",
          solution:
            'Always call sp_api_generate_code_sample with action: "get_categories" (Step 2) before Steps 3 and 4',
        },
        {
          mistake: "🚨 CRITICAL: Skipping Step 4 (Get Models)",
          consequence:
            "Missing essential response structure information, leading to incomplete or incorrect code generation. You will not understand what data the API returns.",
          solution:
            "ALWAYS complete Step 4 - it is MANDATORY. Models provide critical information about response structures that is required for correct code generation. Never skip this step.",
        },
        {
          mistake: "Manually constructing file_path or model_path",
          consequence: "Incorrect paths leading to errors",
          solution: "Always use exact paths from category results",
        },
        {
          mistake: "Using different languages across steps",
          consequence: "Path mismatches and errors",
          solution:
            "Use the same language parameter throughout the entire workflow",
        },
        {
          mistake: "Not saving paths from categories",
          consequence: "Unable to proceed to operations and models",
          solution:
            "Extract and save file_path and model_path from category results",
        },
      ],
      supported_languages: ["python", "javascript", "java", "csharp", "php"],
    };

    // Return specific step or all steps based on request
    if (step === "all") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(workflowGuide, null, 2),
          },
        ],
      };
    } else if (step === "basic-usage") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                overview: workflowGuide.overview,
                step: workflowGuide.steps["basic-usage"],
                supported_languages: workflowGuide.supported_languages,
              },
              null,
              2,
            ),
          },
        ],
      };
    } else if (step === "categories") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                overview: workflowGuide.overview,
                step: workflowGuide.steps.categories,
                supported_languages: workflowGuide.supported_languages,
              },
              null,
              2,
            ),
          },
        ],
      };
    } else if (step === "operations") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                overview: workflowGuide.overview,
                step: workflowGuide.steps.operations,
                prerequisite: "Must complete Step 2 (Get Categories) first",
                supported_languages: workflowGuide.supported_languages,
              },
              null,
              2,
            ),
          },
        ],
      };
    } else if (step === "models") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                overview: workflowGuide.overview,
                step: workflowGuide.steps.models,
                prerequisite: "Must complete Step 2 (Get Categories) first",
                supported_languages: workflowGuide.supported_languages,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Should not reach here due to enum validation, but handle gracefully
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(workflowGuide, null, 2),
        },
      ],
    };
  }
}
