/**
 * Credential management tools for SP-API
 * Allows users to configure credentials via chat prompts
 */

import {
  credentialStore,
  SPAPICredentials,
} from "../../auth/credential-store.js";

export interface CredentialToolArgs {
  action: "configure" | "status" | "clear";
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  baseUrl?: string;
}

export interface ToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
  [key: string]: unknown;
}

// Base URL options for different regions
const BASE_URL_OPTIONS: Record<string, string> = {
  na: "https://sellingpartnerapi-na.amazon.com",
  eu: "https://sellingpartnerapi-eu.amazon.com",
  fe: "https://sellingpartnerapi-fe.amazon.com",
  north_america: "https://sellingpartnerapi-na.amazon.com",
  europe: "https://sellingpartnerapi-eu.amazon.com",
  far_east: "https://sellingpartnerapi-fe.amazon.com",
};

export class CredentialTools {
  handleCredentials(args: CredentialToolArgs): ToolResponse {
    switch (args.action) {
      case "configure":
        return this.configureCredentials(args);
      case "status":
        return this.getCredentialStatus();
      case "clear":
        return this.clearCredentials();
      default:
        return {
          content: [
            {
              type: "text",
              text: `❌ Unknown action: ${args.action}. Use 'configure', 'status', or 'clear'.`,
            },
          ],
          isError: true,
        };
    }
  }

  private configureCredentials(args: CredentialToolArgs): ToolResponse {
    const { clientId, clientSecret, refreshToken, baseUrl } = args;

    let resolvedBaseUrl = baseUrl;
    if (baseUrl && BASE_URL_OPTIONS[baseUrl.toLowerCase()]) {
      resolvedBaseUrl = BASE_URL_OPTIONS[baseUrl.toLowerCase()];
    }

    const updates: Partial<SPAPICredentials> = {};
    if (clientId) updates.clientId = clientId;
    if (clientSecret) updates.clientSecret = clientSecret;
    if (refreshToken) updates.refreshToken = refreshToken;
    if (resolvedBaseUrl) updates.baseUrl = resolvedBaseUrl;

    if (Object.keys(updates).length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `⚠️ **No credentials provided**

Please provide at least one of the following:
- \`clientId\`: Your SP-API LWA Client ID
- \`clientSecret\`: Your SP-API LWA Client Secret
- \`refreshToken\`: Your SP-API Refresh Token
- \`baseUrl\`: API endpoint (na, eu, fe, or full URL)

**Example:**
\`\`\`
Configure my SP-API credentials:
- Client ID: amzn1.application-oa2-client.xxx
- Client Secret: xxx
- Refresh Token: Atzr|xxx
- Region: na
\`\`\``,
          },
        ],
        isError: true,
      };
    }

    credentialStore.setCredentials(updates);
    const status = credentialStore.getStatus();
    const masked = credentialStore.getMaskedCredentials();

    const updatedFields = Object.keys(updates).join(", ");

    let statusMessage = status.isConfigured
      ? "✅ **Credentials fully configured!** You can now use the Orders API tools."
      : "⚠️ **Credentials partially configured.** Some fields are still missing.";

    return {
      content: [
        {
          type: "text",
          text: `${statusMessage}

**Updated:** ${updatedFields}

**Current Configuration:**
| Field | Status |
|-------|--------|
| Client ID | ${masked.clientId} |
| Client Secret | ${masked.clientSecret} |
| Refresh Token | ${masked.refreshToken} |
| Base URL | ${status.baseUrl} |

${!status.isConfigured ? this.getMissingFieldsMessage(status) : ""}

**Security Note:** Credentials are stored in memory only and will be cleared when the MCP server restarts.`,
        },
      ],
    };
  }

  private getCredentialStatus(): ToolResponse {
    const status = credentialStore.getStatus();
    const masked = credentialStore.getMaskedCredentials();

    let statusEmoji = status.isConfigured ? "✅" : "❌";
    let statusText = status.isConfigured
      ? "Fully configured - ready to use Orders API"
      : "Not fully configured - some credentials missing";

    return {
      content: [
        {
          type: "text",
          text: `## 🔐 SP-API Credential Status

**Status:** ${statusEmoji} ${statusText}

**Configuration:**
| Field | Status | Value |
|-------|--------|-------|
| Client ID | ${status.hasClientId ? "✅" : "❌"} | ${masked.clientId} |
| Client Secret | ${status.hasClientSecret ? "✅" : "❌"} | ${masked.clientSecret} |
| Refresh Token | ${status.hasRefreshToken ? "✅" : "❌"} | ${masked.refreshToken} |
| Base URL | ✅ | ${status.baseUrl} |

${status.configuredAt ? `**Last Updated:** ${status.configuredAt.toLocaleString()}` : ""}

${!status.isConfigured ? this.getMissingFieldsMessage(status) : "**Ready to use:** search_orders, get_order, cancel_order, etc."}

**Available Regions:**
- \`na\` - North America (US, CA, MX, BR)
- \`eu\` - Europe (UK, DE, FR, IT, ES, etc.)
- \`fe\` - Far East (JP, AU, SG, IN)`,
        },
      ],
    };
  }

  private clearCredentials(): ToolResponse {
    credentialStore.clearCredentials();

    return {
      content: [
        {
          type: "text",
          text: `🗑️ **Credentials Cleared**

All SP-API credentials have been removed from memory.

To reconfigure, use the \`credentials\` tool with action: 'configure'.`,
        },
      ],
    };
  }

  private getMissingFieldsMessage(
    status: ReturnType<typeof credentialStore.getStatus>,
  ): string {
    const missing: string[] = [];
    if (!status.hasClientId) missing.push("clientId");
    if (!status.hasClientSecret) missing.push("clientSecret");
    if (!status.hasRefreshToken) missing.push("refreshToken");

    return `
**Missing Fields:** ${missing.join(", ")}

To configure, use the \`credentials\` tool with action: 'configure':
\`\`\`
Set my SP-API credentials:
- Client ID: your_client_id
- Client Secret: your_client_secret  
- Refresh Token: your_refresh_token
\`\`\``;
  }
}
