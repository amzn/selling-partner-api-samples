import { AgentResult } from "@strands-agents/sdk";

/**
 * Safely serializes an object to JSON, handling circular references
 * by replacing them with "[Circular]".
 */
export function safeStringify(obj: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }
    return value;
  });
}

export function printMetricsAndTraces(agentResult: AgentResult) {
  console.debug(JSON.stringify(agentResult.traces));

  if (agentResult.metrics) {
    console.debug(`Total tokens: ${agentResult.metrics.accumulatedUsage.totalTokens}`);
    console.debug(`Total duration: ${agentResult.metrics.totalDuration}ms`);
    console.debug(`Tools used: ${Object.keys(agentResult.metrics.toolMetrics)}`);
  }
}
