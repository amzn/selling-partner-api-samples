import type {
  Finding,
  Recommendation,
  OptimizationResponse,
  Difficulty,
} from "./types.js";

export class ResponseBuilder {
  build(findings: Finding[], bestPractices: string[]): OptimizationResponse {
    const recommendations = findings.map((finding, index) =>
      this.findingToRecommendation(finding, index),
    );
    const effort = this.computeEffort(recommendations);

    const callReductionCount = findings.filter(
      (f) =>
        f.category === "batching" ||
        f.category === "reports" ||
        f.category === "notifications",
    ).length;
    const callReductionRate =
      findings.length > 0
        ? Math.round((callReductionCount / findings.length) * 100)
        : 0;

    return {
      analysis_summary: {
        optimization_opportunities: findings.length,
        implementation_effort: effort,
        call_reduction_rate: callReductionRate,
      },
      identified_issues: findings,
      recommendations,
      best_practices: bestPractices,
    };
  }

  private findingToRecommendation(
    finding: Finding,
    index: number,
  ): Recommendation {
    const id = `REC-${String(index + 1).padStart(3, "0")}`;
    const {
      title,
      description,
      optimized_code,
      documentation_link,
      difficulty,
      estimated_time,
    } = this.getRecommendationDetails(finding);

    return {
      id,
      priority: finding.severity,
      category: finding.category,
      title,
      description,
      implementation: {
        difficulty,
        estimated_time,
        breaking_changes: false,
      },
      optimized_code,
      documentation_link,
    };
  }

  private getRecommendationDetails(finding: Finding): {
    title: string;
    description: string;
    optimized_code: string;
    documentation_link: string;
    difficulty: Difficulty;
    estimated_time: string;
  } {
    switch (finding.category) {
      case "batching":
        return {
          title: "Use batch endpoint instead of individual calls",
          description: finding.impact,
          optimized_code:
            "// Use the batch/list equivalent endpoint to retrieve multiple items per call",
          documentation_link:
            "https://developer-docs.amazon.com/sp-api/docs/sp-api-best-practices",
          difficulty: "Easy",
          estimated_time: "30 minutes",
        };
      case "error_handling":
        return {
          title: "Add error handling with retry logic",
          description:
            "Wrap API calls in try/catch with exponential backoff for retryable errors (429, 500, 503)",
          optimized_code:
            "// Add try/catch with exponential backoff retry for 429/5xx errors",
          documentation_link:
            "https://developer-docs.amazon.com/sp-api/docs/sp-api-best-practices#error-handling",
          difficulty: "Easy",
          estimated_time: "30 minutes",
        };
      case "rate_limiting":
        return {
          title: "Implement rate limit handling and backoff",
          description:
            "Add 429 status code detection and exponential backoff with jitter",
          optimized_code:
            "// Check for 429 status, read x-amzn-ratelimit-limit header, implement backoff with jitter",
          documentation_link:
            "https://developer-docs.amazon.com/sp-api/docs/sp-api-best-practices#rate-limiting",
          difficulty: "Medium",
          estimated_time: "1 hour",
        };
      case "notifications":
        return {
          title: "Replace polling with push notifications",
          description: finding.impact,
          optimized_code:
            "// Subscribe to SP-API notifications via EventBridge/SQS instead of polling",
          documentation_link:
            "https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference",
          difficulty: "Medium",
          estimated_time: "2 hours",
        };
      case "call_reduction":
        return {
          title: "Reduce API call volume",
          description: "Move API calls outside of loops or use batch endpoints",
          optimized_code:
            "// Collect IDs first, then make a single batch/list call outside the loop",
          documentation_link:
            "https://developer-docs.amazon.com/sp-api/docs/sp-api-best-practices",
          difficulty: "Easy",
          estimated_time: "30 minutes",
        };
      case "caching":
        return {
          title: "Cache static or slow-changing data",
          description: finding.issue,
          optimized_code:
            "// Implement a cache layer with appropriate TTL for infrequently changing data",
          documentation_link:
            "https://developer-docs.amazon.com/sp-api/docs/sp-api-best-practices",
          difficulty: "Easy",
          estimated_time: "30 minutes",
        };
      case "pagination":
        return {
          title: "Implement proper pagination handling",
          description:
            "Process all pages using nextToken/paginationToken to avoid missing data",
          optimized_code:
            "// Loop with nextToken: do { response = await api.list(...); nextToken = response.nextToken; } while (nextToken)",
          documentation_link:
            "https://developer-docs.amazon.com/sp-api/docs/sp-api-best-practices#pagination",
          difficulty: "Easy",
          estimated_time: "30 minutes",
        };
      case "scheduling":
        return {
          title: "Increase delay between API calls to avoid throttling",
          description:
            "Distribute calls evenly over time with sufficient delays",
          optimized_code:
            "// Use longer intervals (>= 60s) and distribute calls to stay within rate limits",
          documentation_link:
            "https://developer-docs.amazon.com/sp-api/docs/sp-api-best-practices#rate-limiting",
          difficulty: "Easy",
          estimated_time: "15 minutes",
        };
      case "reports":
        return {
          title: "Use SP-API reports for bulk data retrieval",
          description: finding.impact,
          optimized_code:
            "// Request a report via createReport, poll/subscribe for completion, download via getReportDocument",
          documentation_link:
            "https://developer-docs.amazon.com/sp-api/docs/reports-api-v2021-06-30-reference",
          difficulty: "Medium",
          estimated_time: "2 hours",
        };
      default:
        return {
          title: "Optimize SP-API integration",
          description: finding.issue,
          optimized_code:
            "// Review and optimize this SP-API integration pattern",
          documentation_link:
            "https://developer-docs.amazon.com/sp-api/docs/sp-api-best-practices",
          difficulty: "Easy",
          estimated_time: "30 minutes",
        };
    }
  }

  private computeEffort(recommendations: Recommendation[]): Difficulty {
    if (recommendations.some((r) => r.implementation.difficulty === "Hard"))
      return "Hard";
    if (recommendations.some((r) => r.implementation.difficulty === "Medium"))
      return "Medium";
    return "Easy";
  }
}
