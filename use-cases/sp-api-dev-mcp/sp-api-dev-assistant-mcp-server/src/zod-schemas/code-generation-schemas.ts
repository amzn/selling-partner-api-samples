import { z } from "zod";

/**
 * Supported programming languages for the Amazon Selling Partner API SDKs.
 * This enum is shared across all code generation tool schemas.
 */
const languageEnum = z.enum(["python", "java", "javascript", "php", "csharp"]);

/**
 * Schema for the sdk_clone_repo tool.
 * Validates parameters for cloning the Amazon Selling Partner API SDK repository.
 */
export const cloneRepoSchema = z.object({
  repositoryUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "Optional custom repository URL (defaults to official Amazon SP API repository)",
    ),
  targetPath: z
    .string()
    .optional()
    .describe(
      "Optional custom target path for cloning (defaults to ./selling-partner-api-sdk)",
    ),
});

/**
 * Schema for the sdk_get_basic_usage tool.
 * Validates parameters for retrieving basic usage information and setup instructions.
 */
export const getBasicUsageSchema = z.object({
  language: languageEnum.describe("Programming language identifier"),
});

/**
 * Schema for the sdk_get_api_categories tool.
 * Validates parameters for retrieving all available API categories.
 */
export const getCategoriesSchema = z.object({
  language: languageEnum.describe("Programming language identifier"),
});

/**
 * Schema for the sdk_get_api_operations tool.
 * Validates parameters for retrieving API operations with pagination support.
 */
export const getOperationsSchema = z.object({
  language: languageEnum.describe("Programming language identifier"),
  filePath: z
    .string()
    .min(1)
    .describe("Path to the operations file within the SDK"),
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .describe("Page number for pagination (1-based, defaults to 1)"),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe("Number of items per page (defaults to 50, max 100)"),
  operations: z
    .string()
    .optional()
    .describe("Comma-separated list of operation names to filter"),
  includedData: z
    .string()
    .optional()
    .describe("Comma-separated list of fields to include in response"),
});

/**
 * Schema for the sdk_get_models tool.
 * Validates parameters for retrieving data models with pagination support.
 */
export const getModelsSchema = z.object({
  language: languageEnum.describe("Programming language identifier"),
  directoryPath: z
    .string()
    .min(1)
    .describe("Path to the models directory within the SDK"),
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .describe("Page number for pagination (1-based, defaults to 1)"),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe("Number of items per page (defaults to 50, max 100)"),
  models: z
    .string()
    .optional()
    .describe("Comma-separated list of model names to filter"),
  includedData: z
    .string()
    .optional()
    .describe("Comma-separated list of fields to include in response"),
});

/**
 * Schema for the sdk_get_workflow_guide tool.
 * Validates parameters for retrieving workflow guidance on using code generation tools.
 */
export const getWorkflowGuideSchema = z.object({
  step: z
    .enum(["basic-usage", "categories", "operations", "models", "all"])
    .optional()
    .describe(
      "Optional: Get details for a specific step or all steps (defaults to all)",
    ),
});

/**
 * Master code generation schema as a flat object with an explicit `action` discriminator.
 *
 * NOTE: We intentionally use a flat z.object() instead of z.discriminatedUnion() because
 * the MCP SDK's normalizeObjectSchema() does not recognize discriminated unions as object
 * schemas. This causes the JSON Schema exposed to clients via tools/list to fall back to
 * an empty `{ type: "object", properties: {} }`, hiding the `action` field and all
 * parameters. A flat object schema serializes correctly while the master tool's routing
 * logic and individual sub-tool schemas still enforce per-action validation at runtime.
 */
export const masterCodeGenerationSchema = z.object({
  action: z
    .enum([
      "get_workflow_guide",
      "clone_repo",
      "get_basic_usage",
      "get_categories",
      "get_operations",
      "get_models",
    ])
    .describe(
      "Action to perform. Workflow order: get_workflow_guide → clone_repo → get_basic_usage → get_categories → get_operations → get_models.",
    ),

  // get_workflow_guide params
  step: z
    .enum(["basic-usage", "categories", "operations", "models", "all"])
    .optional()
    .describe(
      '(get_workflow_guide) Optional: Get guidance for a specific step. Defaults to "all".',
    ),

  // clone_repo params
  repositoryUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "(clone_repo) Optional custom Git URL. Defaults to official Amazon SP-API SDK repo.",
    ),
  targetPath: z
    .string()
    .optional()
    .describe(
      "(clone_repo) Optional local directory. Defaults to ./selling-partner-api-sdk.",
    ),

  // Shared across get_basic_usage, get_categories, get_operations, get_models
  language: languageEnum
    .optional()
    .describe(
      "(get_basic_usage, get_categories, get_operations, get_models) Programming language (python | java | javascript | php | csharp). Required for these actions.",
    ),

  // get_operations params
  filePath: z
    .string()
    .min(1)
    .optional()
    .describe(
      "(get_operations) Path to operations file. MUST use operationsPath from get_categories response. Do NOT construct manually.",
    ),

  // get_models params
  directoryPath: z
    .string()
    .min(1)
    .optional()
    .describe(
      "(get_models) Path to models directory. MUST use modelsPath from get_categories response. Do NOT construct manually.",
    ),

  // Shared pagination params for get_operations and get_models
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      "(get_operations, get_models) Page number (1-based). Defaults to 1.",
    ),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe(
      "(get_operations, get_models) Items per page. Defaults to 50, max 100.",
    ),

  // get_operations filter
  operations: z
    .string()
    .optional()
    .describe(
      '(get_operations) Comma-separated operation names to filter (e.g., "getOrder, listOrders").',
    ),

  // get_models filter
  models: z
    .string()
    .optional()
    .describe(
      '(get_models) Comma-separated model names to filter (e.g., "Order, OrderItem").',
    ),

  // Shared for get_operations and get_models
  includedData: z
    .string()
    .optional()
    .describe(
      '(get_operations, get_models) Comma-separated fields to include (e.g., "name, swaggerType, attributeMap, isEnum, enumValues"). get_operations valid enums: ["name","description","callMethod","inputParameters","returnedModel","rateLimit"] get_models valid enums: ["name", "swaggerType", "attributeMap", "isEnum", "enumValues"]',
    ),
});
