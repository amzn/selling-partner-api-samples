/**
 * Zod schemas for Credential Management tools
 */

import { z } from "zod";

export const credentialToolSchema = z.object({
  action: z
    .enum(["configure", "status", "clear"])
    .describe(
      "Action to perform: 'configure' to set credentials, 'status' to check current config, 'clear' to remove all credentials",
    ),
  clientId: z
    .string()
    .optional()
    .describe(
      "SP-API LWA Client ID (e.g., amzn1.application-oa2-client.xxx) - only used with 'configure' action",
    ),
  clientSecret: z
    .string()
    .optional()
    .describe("SP-API LWA Client Secret - only used with 'configure' action"),
  refreshToken: z
    .string()
    .optional()
    .describe(
      "SP-API Refresh Token (e.g., Atzr|xxx) - only used with 'configure' action",
    ),
  baseUrl: z
    .string()
    .optional()
    .describe(
      "API endpoint region: 'na' (North America), 'eu' (Europe), 'fe' (Far East), or full URL - only used with 'configure' action",
    ),
});
