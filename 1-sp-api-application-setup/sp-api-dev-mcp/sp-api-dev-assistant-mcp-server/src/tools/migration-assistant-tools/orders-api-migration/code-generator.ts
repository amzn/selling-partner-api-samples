import { CodeAnalysis } from "./code-analyzer.js";
import { MigrationData } from "./migration-data.js";

function toSnakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function toPascalCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Build a regex that matches a name in camelCase, snake_case, and PascalCase.
 */
function buildMultiCaseRegex(camelCaseName: string): RegExp {
  const snake = toSnakeCase(camelCaseName);
  const pascal = toPascalCase(camelCaseName);
  const variants = [...new Set([camelCaseName, snake, pascal])];
  return new RegExp(`\\b(?:${variants.join("|")})\\b`, "g");
}

export function generateRefactoredOrdersApiCode(
  sourceCode: string,
  analysis: CodeAnalysis,
  targetVersion: string,
  migrationData: MigrationData,
): string {
  let refactoredCode = sourceCode;

  // Replace attribute mappings (handles camelCase, snake_case, PascalCase)
  analysis.usedAttributes.forEach((attr) => {
    const v0Pattern = buildMultiCaseRegex(attr.v0.replace(/\./g, "_"));
    refactoredCode = refactoredCode.replace(v0Pattern, attr.v1);
  });

  // Replace status values
  analysis.statusMappingsUsed.forEach((status) => {
    const v0Pattern = new RegExp(`(['"\`])${status.v0}\\1`, "g");
    refactoredCode = refactoredCode.replace(v0Pattern, `$1${status.v1}$1`);
  });

  // Replace query parameters (handles camelCase, snake_case, PascalCase)
  analysis.queryParamsUsed.forEach((param) => {
    if (!param.v1.includes("Not available") && !param.v1.includes("Breaking")) {
      const v1ParamName = param.v1.split(" ")[0];
      const v0Pattern = buildMultiCaseRegex(param.v0);
      refactoredCode = refactoredCode.replace(v0Pattern, v1ParamName);
    }
  });

  // Replace API method calls (handles camelCase, snake_case, PascalCase)
  const apiReplacements: Record<string, string> = {
    getOrders: "searchOrders",
    getOrder: "getOrder",
    getOrderBuyerInfo: "getOrder",
    getOrderAddress: "getOrder",
    getOrderItems: "getOrder",
    getOrderItemsBuyerInfo: "getOrder",
    cancelOrder: "cancelOrder",
  };

  Object.entries(apiReplacements).forEach(([v0Method, v1Method]) => {
    const regex = buildMultiCaseRegex(v0Method);
    refactoredCode = refactoredCode.replace(regex, v1Method);
  });

  // Add comments for V0-only APIs (multi-case)
  analysis.deprecatedEndpoints.forEach((endpoint) => {
    if (endpoint.replacement.includes("No v2026-01-01 counterpart")) {
      const regex = buildMultiCaseRegex(endpoint.endpoint);
      refactoredCode = refactoredCode.replace(
        regex,
        (match) =>
          `${match} /* ⚠️ Continue using V0 API - No v2026-01-01 equivalent */`,
      );
    }
  });

  // Add comments for unavailable query parameters (multi-case)
  analysis.queryParamsUsed.forEach((param) => {
    if (param.v1.includes("Not available")) {
      const regex = buildMultiCaseRegex(param.v0);
      refactoredCode = refactoredCode.replace(
        regex,
        (match) => `${match} /* ⚠️ ${param.v1} */`,
      );
    }
  });

  // Update endpoint URLs
  refactoredCode = refactoredCode.replace(
    /\/orders\/v0\//g,
    "/orders/2026-01-01/",
  );

  // Build includedData suggestion
  const includedDataSuggestion =
    analysis.detectedIncludedData.length > 0
      ? `\n * Suggested includedData: ${analysis.detectedIncludedData.join(", ")}`
      : "";

  // Build status mapping notes
  const statusNotes =
    analysis.statusMappingsUsed.length > 0
      ? `\n * Status values updated: ${analysis.statusMappingsUsed.map((s) => `${s.v0} → ${s.v1}`).join(", ")}`
      : "";

  // Build query parameter notes
  const queryParamNotes =
    analysis.queryParamsUsed.length > 0
      ? `\n * Query parameters updated: ${analysis.queryParamsUsed.map((p) => `${p.v0} → ${p.v1.split(" ")[0]}`).join(", ")}`
      : "";

  // Build programs detected notes
  const programsNotes =
    analysis.programsDetected.length > 0
      ? `\n * Programs detected: ${analysis.programsDetected.join(", ")} (use order.programs array)`
      : "";

  // Add migration header comment
  const header = `/**
 * 🔄 Migrated from Orders API V0 to ${targetVersion}
 * 
 * Migration Summary:
 * - ${analysis.usedAttributes.length} attributes updated
 * - ${analysis.apiCalls.length} API methods analyzed
 * - ${analysis.breakingChanges.length} breaking changes identified
 * - ${analysis.queryParamsUsed.length} query parameters updated${includedDataSuggestion}${statusNotes}${queryParamNotes}${programsNotes}
 * 
 * ⚠️ Note: Some V0 APIs have no v2026-01-01 counterpart and must continue using V0
 */

`;

  return header + refactoredCode;
}
