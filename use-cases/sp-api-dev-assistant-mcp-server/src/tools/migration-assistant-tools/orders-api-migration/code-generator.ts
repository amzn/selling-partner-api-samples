import { CodeAnalysis } from "./code-analyzer.js";

export function generateRefactoredOrdersApiCode(
  sourceCode: string,
  analysis: CodeAnalysis,
  targetVersion: string,
): string {
  let refactoredCode = sourceCode;

  // Replace attribute mappings
  analysis.usedAttributes.forEach((attr) => {
    const v0Pattern = new RegExp(`\\b${attr.v0.replace(/\./g, "\\.")}\\b`, "g");
    refactoredCode = refactoredCode.replace(v0Pattern, attr.v1);
  });

  // Replace API method calls
  const apiReplacements: Record<string, string> = {
    getOrders: "searchOrders",
    getOrder: "getOrder",
    getOrderBuyerInfo: "getOrder", // with includedData
    getOrderAddress: "getOrder", // with includedData
    getOrderItems: "getOrder", // items included by default
    getOrderItemsBuyerInfo: "getOrder", // with includedData
    cancelOrder: "cancelOrder",
  };

  Object.entries(apiReplacements).forEach(([v0Method, v1Method]) => {
    const regex = new RegExp(`\\b${v0Method}\\b`, "g");
    refactoredCode = refactoredCode.replace(regex, v1Method);
  });

  // Add comments for V0-only APIs
  analysis.deprecatedEndpoints.forEach((endpoint) => {
    if (endpoint.replacement.includes("No V1 counterpart")) {
      const regex = new RegExp(`(\\b${endpoint.endpoint}\\b)`, "g");
      refactoredCode = refactoredCode.replace(
        regex,
        `$1 /* ⚠️ Continue using V0 API - No V1 equivalent */`,
      );
    }
  });

  // Update endpoint URLs
  refactoredCode = refactoredCode.replace(
    /\/orders\/v0\//g,
    "/orders/2026-01-01/",
  );

  // Add migration header comment
  const header = `/**
 * 🔄 Migrated from ${analysis.apiCalls.length > 0 ? "Orders API V0" : "V0"} to ${targetVersion}
 * 
 * Migration Summary:
 * - ${analysis.usedAttributes.length} attributes updated
 * - ${analysis.apiCalls.length} API methods analyzed
 * - ${analysis.breakingChanges.length} breaking changes identified
 * 
 * ⚠️ Note: Some V0 APIs have no V1 counterpart and must continue using V0
 */

`;

  return header + refactoredCode;
}
