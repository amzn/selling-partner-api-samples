import { MigrationData } from "./migration-data.js";

export interface CodeAnalysis {
  deprecatedEndpoints: Array<{ endpoint: string; replacement: string }>;
  breakingChanges: Array<{ change: string; explanation: string }>;
  usedAttributes: Array<{ v0: string; v1: string; notes: string }>;
  apiCalls: string[];
}

export function analyzeOrdersApiCode(
  sourceCode: string,
  migrationData: MigrationData,
): CodeAnalysis {
  const deprecatedEndpoints: Array<{
    endpoint: string;
    replacement: string;
  }> = [];
  const breakingChanges: Array<{ change: string; explanation: string }> = [];
  const usedAttributes: Array<{ v0: string; v1: string; notes: string }> = [];
  const apiCalls: string[] = [];

  // Detect API method calls
  const apiMethodPatterns = Object.keys(migrationData.apiMapping);
  apiMethodPatterns.forEach((method) => {
    const regex = new RegExp(`\\b${method}\\b`, "g");
    if (regex.test(sourceCode)) {
      apiCalls.push(method);
      const mapping = migrationData.apiMapping[method];

      if (mapping.status.includes("❌")) {
        deprecatedEndpoints.push({
          endpoint: method,
          replacement: mapping.v1,
        });
        breakingChanges.push({
          change: `${method} has no V1 counterpart`,
          explanation: mapping.notes,
        });
      }
    }
  });

  // Detect deprecated attributes
  migrationData.deprecated.forEach((attr) => {
    const regex = new RegExp(`\\b${attr.replace(/\./g, "\\.")}\\b`, "g");
    if (regex.test(sourceCode)) {
      breakingChanges.push({
        change: `Deprecated attribute: ${attr}`,
        explanation: "This attribute is removed in V1 and has no replacement",
      });
    }
  });

  // Detect attribute mappings
  Object.entries(migrationData.mappingExamples).forEach(([v0, v1]) => {
    const regex = new RegExp(`\\b${v0.replace(/\./g, "\\.")}\\b`, "g");
    if (regex.test(sourceCode)) {
      usedAttributes.push({
        v0,
        v1,
        notes: `Mapped from ${v0} to ${v1}`,
      });
    }
  });

  return {
    deprecatedEndpoints,
    breakingChanges,
    usedAttributes,
    apiCalls,
  };
}
