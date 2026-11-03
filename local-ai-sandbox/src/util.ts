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

/**
 * The internal bookkeeping fields the database layer stores on every document:
 * `_key` (the unique index) and `_type` (the per-namespace discriminator).
 * Neither is part of any SP-API response schema, so both must be removed from
 * records before they are returned to a caller.
 */
const INTERNAL_RECORD_FIELDS = new Set(["_key", "_type"]);

/**
 * Returns a deep copy of a database record with the internal `_key` and `_type`
 * fields removed, recursing through nested objects and arrays so that nested
 * record shapes (for example the recursive `balances` list on a Finances
 * Balance) are sanitized too.
 *
 * `engine.find` already strips LokiJS's own `$loki`/`meta`, but deliberately
 * keeps `_key`/`_type`, so list handlers must call this before placing records
 * in a response body.
 */
export function stripInternalRecordFields<T>(value: T): T {
  if (Array.isArray(value)) {
    const mapped: unknown[] = (value as unknown[]).map((item) => stripInternalRecordFields(item));
    return mapped as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (!INTERNAL_RECORD_FIELDS.has(key)) {
        result[key] = stripInternalRecordFields(val);
      }
    }
    return result as T;
  }
  return value;
}
