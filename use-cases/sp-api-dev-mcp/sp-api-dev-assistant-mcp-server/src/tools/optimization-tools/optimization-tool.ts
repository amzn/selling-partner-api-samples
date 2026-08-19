import { CodeAnalyzer } from "./code-analyzer.js";
import { BestPracticesProvider } from "./best-practices-provider.js";
import { ResponseBuilder } from "./response-builder.js";
import { formatOptimizationMarkdown } from "./markdown-formatter.js";
import type {
  OptimizationGoal,
  SupportedLanguage,
  ToolResponse,
} from "./types.js";

interface SourceFileInput {
  fileName: string;
  code: string;
}

interface OptimizationArgs {
  source_code?: string;
  source_files?: SourceFileInput[];
  optimization_goals?: OptimizationGoal[];
  apiSection?: string;
  language?: SupportedLanguage;
}

export class OptimizationTool {
  private codeAnalyzer: CodeAnalyzer;
  private bestPracticesProvider: BestPracticesProvider;
  private responseBuilder: ResponseBuilder;

  constructor() {
    this.codeAnalyzer = new CodeAnalyzer();
    this.bestPracticesProvider = new BestPracticesProvider();
    this.responseBuilder = new ResponseBuilder();
  }

  async handleRequest(args: OptimizationArgs): Promise<ToolResponse> {
    try {
      const bestPractices = this.bestPracticesProvider.getBestPractices(
        args.apiSection,
      );
      const language: SupportedLanguage | "agnostic" =
        args.language ?? "agnostic";

      // Prefer source_files over source_code when both are provided
      const hasSourceFiles = args.source_files && args.source_files.length > 0;
      const sourceCode = args.source_code?.trim() || "";

      if (!hasSourceFiles && !sourceCode) {
        const response = this.responseBuilder.build([], bestPractices);
        const markdown = formatOptimizationMarkdown(response);
        return {
          content: [{ type: "text" as const, text: markdown }],
        };
      }

      const result = hasSourceFiles
        ? this.codeAnalyzer.analyzeFiles({
            sourceFiles: args.source_files!,
            language,
            optimizationGoals: args.optimization_goals,
            apiSection: args.apiSection,
          })
        : this.codeAnalyzer.analyze({
            sourceCode,
            language,
            optimizationGoals: args.optimization_goals,
            apiSection: args.apiSection,
          });

      const response = this.responseBuilder.build(
        result.findings,
        bestPractices,
      );
      const markdown = formatOptimizationMarkdown(response);
      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Optimization tool error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
}
