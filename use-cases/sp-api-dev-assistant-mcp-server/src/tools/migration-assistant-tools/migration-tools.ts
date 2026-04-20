import { getOrdersApiMigrationData } from "./orders-api-migration/migration-data.js";
import { analyzeOrdersApiCode } from "./orders-api-migration/code-analyzer.js";
import { generateRefactoredOrdersApiCode } from "./orders-api-migration/code-generator.js";
import {
  formatAnalysisReport,
  formatMigrationReport,
} from "./orders-api-migration/report-formatter.js";
import { formatGeneralGuidance } from "./orders-api-migration/guidance-formatter.js";

export interface MigrationAssistantArgs {
  source_code?: string;
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

export class SPAPIMigrationAssistantTool {
  async migrationAssistant(
    args: MigrationAssistantArgs,
  ): Promise<ToolResponse> {
    const {
      source_code,
      source_version,
      target_version,
      analysis_only = false,
    } = args;

    const supportedMigrations: Record<
      string,
      { source: string; target: string }
    > = {
      "orders-v0->orders-2026-01-01": {
        source: "orders-v0",
        target: "orders-2026-01-01",
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

    if (
      source_version === "orders-v0" &&
      target_version === "orders-2026-01-01"
    ) {
      return this.handleOrdersApiMigration(
        source_code,
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
    targetVersion: string,
    analysisOnly: boolean,
  ): Promise<ToolResponse> {
    const migrationData = getOrdersApiMigrationData();

    if (!sourceCode) {
      return {
        content: [
          {
            type: "text",
            text: formatGeneralGuidance(migrationData),
          },
        ],
      };
    }

    const analysis = analyzeOrdersApiCode(sourceCode, migrationData);

    if (analysisOnly) {
      return {
        content: [
          {
            type: "text",
            text: formatAnalysisReport(analysis, migrationData),
          },
        ],
      };
    }

    const refactoredCode = generateRefactoredOrdersApiCode(
      sourceCode,
      analysis,
      targetVersion,
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
}
