// ── Enums / Literals ──────────────────────────────────────────────

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type OptimizationGoal =
  | "error_handling"
  | "rate_limiting"
  | "batching"
  | "caching"
  | "pagination"
  | "scheduling"
  | "notifications"
  | "reports"
  | "call_reduction"
  | "api_modernness";

export type SupportedLanguage = "python" | "javascript" | "typescript" | "java";

export type Difficulty = "Easy" | "Medium" | "Hard";

// ── Finding ───────────────────────────────────────────────────────

export interface CodeLocation {
  line: number;
  file?: string;
  context: string;
}

export interface Finding {
  severity: Severity;
  category: OptimizationGoal;
  issue: string;
  current_pattern: string;
  impact: string;
  location: CodeLocation;
}

// ── Recommendation ────────────────────────────────────────────────

export interface ImplementationDetail {
  difficulty: Difficulty;
  estimated_time: string;
  breaking_changes: boolean;
}

export interface Recommendation {
  id: string;
  priority: Severity;
  category: OptimizationGoal;
  title: string;
  description: string;
  implementation: ImplementationDetail;
  optimized_code: string;
  documentation_link: string;
}

// ── Analysis Summary ──────────────────────────────────────────────

export interface AnalysisSummary {
  optimization_opportunities: number;
  implementation_effort: Difficulty;
  call_reduction_rate?: number;
}

// ── Response ──────────────────────────────────────────────────────

export interface OptimizationResponse {
  analysis_summary: AnalysisSummary;
  identified_issues: Finding[];
  recommendations: Recommendation[];
  best_practices: string[];
}

// ── Detection Strategy ────────────────────────────────────────────

export interface DetectionStrategy {
  readonly category: OptimizationGoal;
  detect(
    sourceCode: string,
    language: SupportedLanguage | "agnostic",
    apiSection?: string,
  ): Finding[];
}

// ── Internal Analysis Result ──────────────────────────────────────

export interface AnalysisResult {
  findings: Finding[];
}

// ── Language Patterns ─────────────────────────────────────────────

export interface PatternDefinition {
  pattern: RegExp;
  description: string;
  apiSection?: string;
}

export type LanguagePatterns = Record<
  SupportedLanguage | "agnostic",
  PatternDefinition[]
>;

// ── MCP Tool Response ─────────────────────────────────────────────

export interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}
