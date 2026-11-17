import { getOrdersApiMigrationData } from "./orders-api-migration/migration-data.js";
import { analyzeOrdersApiCode } from "./orders-api-migration/code-analyzer.js";
import { generateRefactoredOrdersApiCode } from "./orders-api-migration/code-generator.js";
import {
  formatAnalysisReport,
  formatMigrationReport,
} from "./orders-api-migration/report-formatter.js";
import { formatGeneralGuidance } from "./orders-api-migration/guidance-formatter.js";

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

export class SPAPIMigrationAssistantTool {
  private resourcePath: string;

  constructor(resourcePath: string) {
    this.resourcePath = resourcePath;
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
    const migrationData = getOrdersApiMigrationData(this.resourcePath);

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
}
