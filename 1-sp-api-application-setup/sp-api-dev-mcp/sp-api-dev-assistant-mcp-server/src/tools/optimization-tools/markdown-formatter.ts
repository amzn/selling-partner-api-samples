import type { OptimizationResponse, Finding, Recommendation } from "./types.js";

export function formatOptimizationMarkdown(
  response: OptimizationResponse,
): string {
  let md = `# 🔧 SP-API Optimization Report\n\n`;

  // Summary
  md += `## 📊 Analysis Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Optimization Opportunities | ${response.analysis_summary.optimization_opportunities} |\n`;
  md += `| Implementation Effort | ${response.analysis_summary.implementation_effort} |\n`;
  md += `| Call Reduction Rate | ${response.analysis_summary.call_reduction_rate}% |\n\n`;

  // Identified Issues (sorted by severity: CRITICAL > HIGH > MEDIUM > LOW)
  if (response.identified_issues.length > 0) {
    md += `## ⚠️ Identified Issues\n\n`;
    const sortedIssues = [...response.identified_issues].sort((a, b) => {
      const sevDiff =
        getSeverityOrder(a.severity) - getSeverityOrder(b.severity);
      if (sevDiff !== 0) return sevDiff;
      // Within the same severity, rank deprecated API (api_modernness) first
      const aIsDeprecated = a.category === "api_modernness" ? 0 : 1;
      const bIsDeprecated = b.category === "api_modernness" ? 0 : 1;
      return aIsDeprecated - bIsDeprecated;
    });
    sortedIssues.forEach((issue: Finding, index: number) => {
      const severityIcon = getSeverityIcon(issue.severity);
      md += `### ${index + 1}. ${severityIcon} ${issue.issue}\n\n`;
      md += `- **Category:** ${formatCategory(issue.category)}\n`;
      md += `- **Severity:** ${issue.severity}\n`;
      md += `- **Impact:** ${issue.impact}\n`;
      if (issue.location) {
        const locationStr = formatLocation(issue.location);
        if (locationStr) {
          md += `- **Location:** ${locationStr}\n`;
        }
      }
      md += `\n`;
    });
  }

  // Recommendations (sorted by priority: CRITICAL > HIGH > MEDIUM > LOW)
  if (response.recommendations.length > 0) {
    md += `## 💡 Recommendations\n\n`;
    const sortedRecs = [...response.recommendations].sort((a, b) => {
      const sevDiff =
        getSeverityOrder(a.priority) - getSeverityOrder(b.priority);
      if (sevDiff !== 0) return sevDiff;
      const aIsDeprecated = a.category === "api_modernness" ? 0 : 1;
      const bIsDeprecated = b.category === "api_modernness" ? 0 : 1;
      return aIsDeprecated - bIsDeprecated;
    });
    sortedRecs.forEach((rec: Recommendation) => {
      const priorityIcon = getSeverityIcon(rec.priority);
      md += `### ${rec.id}: ${rec.title} ${priorityIcon}\n\n`;
      md += `**Category:** ${formatCategory(rec.category)} | **Priority:** ${rec.priority}\n\n`;
      md += `${rec.description}\n\n`;
      md += `**Implementation:**\n`;
      md += `- Difficulty: ${rec.implementation.difficulty}\n`;
      md += `- Estimated Time: ${rec.implementation.estimated_time}\n`;
      md += `- Breaking Changes: ${rec.implementation.breaking_changes ? "Yes" : "No"}\n\n`;
      if (rec.optimized_code) {
        md += `**Example:**\n\`\`\`javascript\n${rec.optimized_code}\n\`\`\`\n\n`;
      }
      md += `📚 [Documentation](${rec.documentation_link})\n\n`;
      md += `---\n\n`;
    });
  }

  // Best Practices
  if (response.best_practices.length > 0) {
    md += `## ✅ Best Practices\n\n`;
    response.best_practices.forEach((practice: string) => {
      md += `- ${practice}\n`;
    });
    md += `\n`;
  }

  // Action Checklist
  md += `## 📋 Action Checklist\n\n`;
  response.recommendations.forEach((rec: Recommendation) => {
    md += `- [ ] ${rec.id}: ${rec.title} (${rec.implementation.estimated_time})\n`;
  });
  md += `\n`;

  return md;
}

function getSeverityIcon(severity: string): string {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "🔴";
    case "HIGH":
      return "🟠";
    case "MEDIUM":
      return "🟡";
    case "LOW":
      return "🟢";
    default:
      return "⚪";
  }
}

function getSeverityOrder(severity: string): number {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return 0;
    case "HIGH":
      return 1;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 3;
    default:
      return 4;
  }
}

function formatCategory(category: string): string {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatLocation(location: {
  line: number;
  file?: string;
  context: string;
}): string {
  if (!location) return "";

  const parts: string[] = [];
  if (location.file) {
    parts.push(location.file);
  }
  if (location.line > 0) {
    parts.push(`Line ${location.line}`);
  }
  if (location.context && location.context.trim()) {
    // Truncate long context and escape backticks
    const ctx = location.context.trim().replace(/`/g, "'");
    const truncated = ctx.length > 80 ? ctx.substring(0, 77) + "..." : ctx;
    parts.push(`\`${truncated}\``);
  }

  return parts.join(": ");
}
