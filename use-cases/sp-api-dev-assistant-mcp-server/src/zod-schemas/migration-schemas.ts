/**
 * Zod schemas for Migration Assistant tool
 */

import { z } from "zod";

export const migrationAssistantSchema = z.object({
  source_code: z
    .string()
    .optional()
    .describe(
      "Your existing API integration code (optional - if not provided, returns general migration guidance)",
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
