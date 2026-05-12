import { dirname, join } from "path";
import { getOrdersApiMigrationData } from "./orders-api-migration/migration-data.js";
import { analyzeOrdersApiCode } from "./orders-api-migration/code-analyzer.js";
import { generateRefactoredOrdersApiCode } from "./orders-api-migration/code-generator.js";
import {
  formatAnalysisReport,
  formatMigrationReport,
} from "./orders-api-migration/report-formatter.js";
import { formatGeneralGuidance } from "./orders-api-migration/guidance-formatter.js";
import { getOutboundFulfillmentMigrationData } from "./outbound-fulfillment-migration/migration-data.js";
import { analyzeOutboundFulfillmentCode } from "./outbound-fulfillment-migration/code-analyzer.js";
import { generateRefactoredOutboundCode } from "./outbound-fulfillment-migration/code-generator.js";
import {
  formatOutboundAnalysisReport,
  formatOutboundMigrationReport,
} from "./outbound-fulfillment-migration/report-formatter.js";
import { formatOutboundGeneralGuidance } from "./outbound-fulfillment-migration/guidance-formatter.js";

export interface SourceFileInput {
  fileName: string;
  code: string;
}

export interface MigrationAssistantArgs {
  source_code?: string;
  source_files?: SourceFileInput[];
  source_version: string;
  target_version: string;
  language?: string;
  analysis_only?: boolean;
}

export interface ToolResponse {
  content: Array<{
    type: "text";
    text: string;
    meta?: Record<string, unknown>;
  }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Resolves the resource path for a given migration data file.
 *
 * The constructor accepts either:
 *   - a directory containing migration data JSON files (preferred), or
 *   - a direct path to the orders-api-migration-data.json file (backwards-compatible).
 */
function resolveResourcePath(resourcesBase: string, fileName: string): string {
  // If the caller passed a path that ends with a .json file, treat the parent
  // directory as the resources root. This keeps existing callers working that
  // passed the orders-api JSON path directly.
  if (resourcesBase.endsWith(".json")) {
    return join(dirname(resourcesBase), fileName);
  }
  return join(resourcesBase, fileName);
}

export class SPAPIMigrationAssistantTool {
  private ordersApiResourcePath: string;
  private outboundFulfillmentResourcePath: string;

  /**
   * @param resourcesBase Either a directory containing migration data JSON
   * files, or a direct path to orders-api-migration-data.json (for backwards
   * compatibility with earlier callers).
   */
  constructor(resourcesBase: string) {
    this.ordersApiResourcePath = resolveResourcePath(
      resourcesBase,
      "orders-api-migration-data.json",
    );
    this.outboundFulfillmentResourcePath = resolveResourcePath(
      resourcesBase,
      "outbound-fulfillment-migration-data.json",
    );
  }

  async migrationAssistant(
    args: MigrationAssistantArgs,
  ): Promise<ToolResponse> {
    const {
      source_code,
      source_files,
      source_version,
      target_version,
      analysis_only = false,
    } = args;

    // Validate supported migrations
    const supportedMigrations: Record<
      string,
      { source: string; target: string }
    > = {
      "orders-v0->orders-2026-01-01": {
        source: "orders-v0",
        target: "orders-2026-01-01",
      },
      "fulfillment-outbound-v2020-07-01->fulfillment-outbound-2025-09-24": {
        source: "fulfillment-outbound-v2020-07-01",
        target: "fulfillment-outbound-2025-09-24",
      },
    };

    const isSupported = Object.values(supportedMigrations).some(
      (m) => m.source === source_version && m.target === target_version,
    );

    if (!isSupported) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Unsupported migration path: ${source_version} → ${target_version}\n\nSupported migrations:\n${Object.values(
              supportedMigrations,
            )
              .map((m) => `- ${m.source} → ${m.target}`)
              .join("\n")}`,
          },
        ],
        isError: true,
      };
    }

    // Route to appropriate migration handler
    if (
      source_version === "orders-v0" &&
      target_version === "orders-2026-01-01"
    ) {
      return this.handleOrdersApiMigration(
        source_code,
        source_files,
        target_version,
        analysis_only,
      );
    }

    if (
      source_version === "fulfillment-outbound-v2020-07-01" &&
      target_version === "fulfillment-outbound-2025-09-24"
    ) {
      return this.handleOutboundFulfillmentMigration(
        source_code,
        source_files,
        target_version,
        analysis_only,
      );
    }

    return {
      content: [
        {
          type: "text",
          text: `Migration handler not implemented for ${source_version} → ${target_version}`,
        },
      ],
      isError: true,
    };
  }

  private async handleOrdersApiMigration(
    sourceCode: string | undefined,
    sourceFiles: SourceFileInput[] | undefined,
    targetVersion: string,
    analysisOnly: boolean,
  ): Promise<ToolResponse> {
    const migrationData = getOrdersApiMigrationData(this.ordersApiResourcePath);

    // Prefer source_files over source_code
    const hasSourceFiles = sourceFiles && sourceFiles.length > 0;
    const hasSourceCode = sourceCode && sourceCode.trim();

    if (!hasSourceFiles && !hasSourceCode) {
      return {
        content: [{ type: "text", text: formatGeneralGuidance(migrationData) }],
      };
    }

    // If source_files provided, process each file independently
    if (hasSourceFiles) {
      const sections: string[] = [];

      for (const file of sourceFiles!) {
        const code = file.code?.trim();
        if (!code) continue;

        const analysis = analyzeOrdersApiCode(code, migrationData);

        // Skip files with no migration-relevant findings
        if (
          analysis.apiCalls.length === 0 &&
          analysis.usedAttributes.length === 0 &&
          analysis.breakingChanges.length === 0
        ) {
          continue;
        }

        if (analysisOnly) {
          sections.push(
            `# 📄 ${file.fileName}\n\n${formatAnalysisReport(analysis, migrationData)}`,
          );
        } else {
          const refactoredCode = generateRefactoredOrdersApiCode(
            code,
            analysis,
            targetVersion,
            migrationData,
          );
          sections.push(
            `# 📄 ${file.fileName}\n\n${formatMigrationReport(analysis, refactoredCode, migrationData)}`,
          );
        }
      }

      if (sections.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No Orders API v0 usage detected in the provided files. No migration needed.",
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: sections.join("\n\n---\n\n") }],
      };
    }

    // Single source_code path
    const analysis = analyzeOrdersApiCode(sourceCode!, migrationData);

    if (analysisOnly) {
      return {
        content: [
          { type: "text", text: formatAnalysisReport(analysis, migrationData) },
        ],
      };
    }

    const refactoredCode = generateRefactoredOrdersApiCode(
      sourceCode!,
      analysis,
      targetVersion,
      migrationData,
    );
    return {
      content: [
        {
          type: "text",
          text: formatMigrationReport(analysis, refactoredCode, migrationData),
        },
      ],
    };
  }

  private static readonly OUTBOUND_DISCLAIMER =
    "⚠️ DISCLAIMER: The Fulfillment Outbound API v2025-09-24 schema has NOT been " +
    "officially released yet and is subject to change. Migration guidance provided " +
    "here is based on a pre-release specification and may not reflect the final API.\n\n";

  private async handleOutboundFulfillmentMigration(
    sourceCode: string | undefined,
    sourceFiles: SourceFileInput[] | undefined,
    targetVersion: string,
    analysisOnly: boolean,
  ): Promise<ToolResponse> {
    const migrationData = getOutboundFulfillmentMigrationData(
      this.outboundFulfillmentResourcePath,
    );

    const hasSourceFiles = sourceFiles && sourceFiles.length > 0;
    const hasSourceCode = sourceCode && sourceCode.trim();

    if (!hasSourceFiles && !hasSourceCode) {
      return {
        content: [
          {
            type: "text",
            text:
              SPAPIMigrationAssistantTool.OUTBOUND_DISCLAIMER +
              formatOutboundGeneralGuidance(migrationData),
          },
        ],
      };
    }

    // If source_files provided, process each file independently
    if (hasSourceFiles) {
      const sections: string[] = [];

      for (const file of sourceFiles!) {
        const code = file.code?.trim();
        if (!code) continue;

        const analysis = analyzeOutboundFulfillmentCode(code, migrationData);

        // Skip files with no migration-relevant findings
        if (
          analysis.apiCalls.length === 0 &&
          analysis.usedAttributes.length === 0 &&
          analysis.breakingChanges.length === 0
        ) {
          continue;
        }

        if (analysisOnly) {
          sections.push(
            `# 📄 ${file.fileName}\n\n${formatOutboundAnalysisReport(analysis, migrationData)}`,
          );
        } else {
          const refactoredCode = generateRefactoredOutboundCode(
            code,
            analysis,
            targetVersion,
            migrationData,
          );
          sections.push(
            `# 📄 ${file.fileName}\n\n${formatOutboundMigrationReport(analysis, refactoredCode, migrationData)}`,
          );
        }
      }

      if (sections.length === 0) {
        return {
          content: [
            {
              type: "text",
              text:
                SPAPIMigrationAssistantTool.OUTBOUND_DISCLAIMER +
                "No Fulfillment Outbound API v2020-07-01 usage detected in the provided files. No migration needed.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text:
              SPAPIMigrationAssistantTool.OUTBOUND_DISCLAIMER +
              sections.join("\n\n---\n\n"),
          },
        ],
      };
    }

    // Single source_code path
    const analysis = analyzeOutboundFulfillmentCode(sourceCode!, migrationData);

    if (analysisOnly) {
      return {
        content: [
          {
            type: "text",
            text:
              SPAPIMigrationAssistantTool.OUTBOUND_DISCLAIMER +
              formatOutboundAnalysisReport(analysis, migrationData),
          },
        ],
      };
    }

    const refactoredCode = generateRefactoredOutboundCode(
      sourceCode!,
      analysis,
      targetVersion,
      migrationData,
    );
    return {
      content: [
        {
          type: "text",
          text:
            SPAPIMigrationAssistantTool.OUTBOUND_DISCLAIMER +
            formatOutboundMigrationReport(
              analysis,
              refactoredCode,
              migrationData,
            ),
        },
      ],
    };
  }
}
