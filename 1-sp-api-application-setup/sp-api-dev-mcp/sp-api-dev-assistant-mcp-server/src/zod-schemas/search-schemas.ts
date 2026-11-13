/**
 * Zod schemas for Search tool
 */

import { z } from "zod";

export const searchSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Natural language search query about SP-API"),
  top_k: z
    .number()
    .int()
    .positive()
    .optional()
    .default(15)
    .describe("Number of results to return (default: 15)"),
});
