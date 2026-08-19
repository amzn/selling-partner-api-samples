import { z } from "zod";

const optimizationGoals = z.enum([
  "error_handling",
  "rate_limiting",
  "batching",
  "caching",
  "pagination",
  "scheduling",
  "notifications",
  "reports",
  "call_reduction",
  "api_modernness",
]);

const supportedLanguage = z.enum([
  "python",
  "javascript",
  "typescript",
  "java",
]);

const sourceFileEntry = z.object({
  fileName: z
    .string()
    .describe('Name of the source file (e.g., "ordersService.js")'),
  code: z
    .string()
    .describe(
      "The complete, unmodified source code content of the file. " +
        "Do NOT strip comments, blank lines, or reformat the code. " +
        "Preserve the original file content exactly as-is for accurate line number reporting.",
    ),
});

export const optimizationSchema = z.object({
  source_code: z
    .string()
    .optional()
    .describe(
      "A single code snippet to analyze. Only use this when the user pastes code directly. " +
        "When analyzing files from a project, always use source_files instead for accurate per-file line numbers. " +
        "Do NOT strip comments, blank lines, or reformat the code — preserve it exactly as-is.",
    ),
  source_files: z
    .array(sourceFileEntry)
    .optional()
    .describe(
      "Array of source files to analyze. Each entry has fileName and code. " +
        "Always use this instead of source_code when you have access to the user's files. " +
        "Each file is analyzed independently with correct per-file line numbers.",
    ),
  optimization_goals: z
    .array(optimizationGoals)
    .optional()
    .describe(
      "Goals to focus the review on specific categories. Valid values: error_handling, rate_limiting, batching, caching, pagination, scheduling, notifications, reports, call_reduction, api_modernness",
    ),
  apiSection: z
    .string()
    .optional()
    .describe(
      "Filter results to a specific API section (e.g., Orders, Catalog, Feeds)",
    ),
  language: supportedLanguage
    .optional()
    .describe(
      "Programming language of the source code (python, javascript, typescript, java)",
    ),
});
