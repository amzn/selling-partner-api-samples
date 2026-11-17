/**
 * Zod schemas for Migration Assistant tool
 */

import { z } from "zod";

const sourceFileEntry = z.object({
  fileName: z
    .string()
    .describe('Name of the source file (e.g., "ordersService.js")'),
  code: z
    .string()
    .describe(
      "The complete, unmodified source code content of the file. " +
        "Do NOT strip comments, blank lines, or reformat the code.",
    ),
});

export const migrationAssistantSchema = z.object({
  source_code: z
    .string()
    .optional()
    .describe(
      "A single code snippet to analyze. Only use this when the user pastes code directly. " +
        "When analyzing files from a project, always use source_files instead.",
    ),
  source_files: z
    .array(sourceFileEntry)
    .optional()
    .describe(
      "Array of source files to analyze. Each entry has fileName and code. " +
        "Always use this instead of source_code when you have access to the user's files.",
    ),
  source_version: z
    .string()
    .describe("Current API version (e.g., 'orders-v0')"),
  target_version: z
    .string()
    .describe("Target API version (e.g., 'orders-2026-01-01')"),
  language: z
    .string()
    .optional()
    .describe("Programming language of the source code"),
  analysis_only: z
    .boolean()
    .default(false)
    .describe("Only analyze without generating code (default: false)"),
});
