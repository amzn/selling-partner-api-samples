import type {
  DetectionStrategy,
  Finding,
  OptimizationGoal,
  SupportedLanguage,
  AnalysisResult,
} from "./types.js";
import {
  BatchingStrategy,
  NotificationStrategy,
  CachingStrategy,
  PaginationStrategy,
  SchedulingStrategy,
  ReportsStrategy,
  ErrorHandlingStrategy,
  RateLimitingStrategy,
  ApiModernnessStrategy,
} from "./detection-strategies.js";

export interface SourceFile {
  fileName: string;
  code: string;
}

export interface AnalyzeOptions {
  sourceCode: string;
  language: SupportedLanguage | "agnostic";
  optimizationGoals?: OptimizationGoal[];
  apiSection?: string;
}

export interface AnalyzeFilesOptions {
  sourceFiles: SourceFile[];
  language: SupportedLanguage | "agnostic";
  optimizationGoals?: OptimizationGoal[];
  apiSection?: string;
}

export class CodeAnalyzer {
  private strategies: Map<OptimizationGoal, DetectionStrategy>;

  constructor() {
    this.strategies = new Map<OptimizationGoal, DetectionStrategy>([
      ["batching", new BatchingStrategy()],
      ["notifications", new NotificationStrategy()],
      ["caching", new CachingStrategy()],
      ["pagination", new PaginationStrategy()],
      ["scheduling", new SchedulingStrategy()],
      ["reports", new ReportsStrategy()],
      ["error_handling", new ErrorHandlingStrategy()],
      ["rate_limiting", new RateLimitingStrategy()],
      ["api_modernness", new ApiModernnessStrategy()],
    ]);
  }

  /**
   * Analyze a single source code string (backward-compatible).
   */
  analyze(options: AnalyzeOptions): AnalysisResult {
    const findings = this.runStrategies(
      options.sourceCode,
      options.language,
      options.optimizationGoals,
      options.apiSection,
    );
    return { findings: this.deduplicateFindings(findings) };
  }

  /**
   * Analyze multiple source files independently, tagging each finding
   * with the originating file name and file-relative line numbers.
   */
  analyzeFiles(options: AnalyzeFilesOptions): AnalysisResult {
    const allFindings: Finding[] = [];

    for (const file of options.sourceFiles) {
      const code = file.code?.trim();
      if (!code) continue;

      const findings = this.runStrategies(
        code,
        options.language,
        options.optimizationGoals,
        options.apiSection,
      );

      // Tag each finding with the file name
      for (const finding of findings) {
        finding.location.file = file.fileName;
        allFindings.push(finding);
      }
    }

    return { findings: this.deduplicateFindings(allFindings) };
  }

  /**
   * Composite goals that map to multiple underlying strategies.
   * When a user requests 'call_reduction', we activate batching,
   * reports, and notifications — the strategies that actually reduce call volume.
   */
  private static readonly compositeGoals: Partial<
    Record<OptimizationGoal, OptimizationGoal[]>
  > = {
    call_reduction: ["batching", "reports", "notifications"],
  };

  private runStrategies(
    sourceCode: string,
    language: SupportedLanguage | "agnostic",
    optimizationGoals?: OptimizationGoal[],
    apiSection?: string,
  ): Finding[] {
    const findings: Finding[] = [];

    // Expand composite goals into their underlying strategies
    const expandedGoals = optimizationGoals
      ? [
          ...new Set(
            optimizationGoals.flatMap(
              (g) => CodeAnalyzer.compositeGoals[g] ?? [g],
            ),
          ),
        ]
      : undefined;

    const activeStrategies = expandedGoals
      ? [...this.strategies.entries()].filter(([goal]) =>
          expandedGoals.includes(goal),
        )
      : [...this.strategies.entries()];

    for (const [, strategy] of activeStrategies) {
      try {
        const strategyFindings = strategy.detect(
          sourceCode,
          language,
          apiSection,
        );
        findings.push(...strategyFindings);
      } catch {
        // Fail open: skip this strategy, continue with remaining
      }
    }

    return findings;
  }

  /**
   * Deduplicate findings that share the same category, issue text, and file.
   * When duplicates exist, keep the one with the higher severity.
   */
  private deduplicateFindings(findings: Finding[]): Finding[] {
    const seen = new Map<string, Finding>();

    for (const finding of findings) {
      const fileKey = finding.location.file ?? "";
      const key = `${fileKey}::${finding.category}::${finding.issue}`;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, finding);
      } else {
        const severityOrder: Record<string, number> = {
          CRITICAL: 0,
          HIGH: 1,
          MEDIUM: 2,
          LOW: 3,
        };
        const existingSev = severityOrder[existing.severity] ?? 4;
        const newSev = severityOrder[finding.severity] ?? 4;

        if (newSev < existingSev) {
          seen.set(key, finding);
        }
      }
    }

    return [...seen.values()];
  }
}
