import { MigrationData } from "./migration-data.js";

/**
 * Convert a camelCase name to snake_case (Python convention).
 */
function toSnakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/**
 * Convert a camelCase name to PascalCase (C# convention).
 */
function toPascalCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Build a regex that matches a method name in camelCase, snake_case, and PascalCase.
 */
function buildMultiCaseRegex(camelCaseName: string): RegExp {
  const snake = toSnakeCase(camelCaseName);
  const pascal = toPascalCase(camelCaseName);
  // Deduplicate (camelCase and PascalCase may be the same for single-word names)
  const variants = [...new Set([camelCaseName, snake, pascal])];
  return new RegExp(`\\b(?:${variants.join("|")})\\b`, "g");
}

export interface CodeAnalysis {
  deprecatedEndpoints: Array<{ endpoint: string; replacement: string }>;
  breakingChanges: Array<{ change: string; explanation: string }>;
  usedAttributes: Array<{ v0: string; v1: string; notes: string }>;
  apiCalls: string[];
  detectedIncludedData: string[];
  statusMappingsUsed: Array<{ v0: string; v1: string }>;
  queryParamsUsed: Array<{ v0: string; v1: string }>;
  programsDetected: string[];
}

export function analyzeOrdersApiCode(
  sourceCode: string,
  migrationData: MigrationData,
): CodeAnalysis {
  const deprecatedEndpoints: Array<{ endpoint: string; replacement: string }> =
    [];
  const breakingChanges: Array<{ change: string; explanation: string }> = [];
  const usedAttributes: Array<{ v0: string; v1: string; notes: string }> = [];
  const apiCalls: string[] = [];
  const detectedIncludedData: string[] = [];
  const statusMappingsUsed: Array<{ v0: string; v1: string }> = [];
  const queryParamsUsed: Array<{ v0: string; v1: string }> = [];
  const programsDetected: string[] = [];

  // Detect API method calls (camelCase, snake_case, PascalCase)
  const apiMethodPatterns = Object.keys(migrationData.apiMappings);
  apiMethodPatterns.forEach((method) => {
    const regex = buildMultiCaseRegex(method);
    if (regex.test(sourceCode)) {
      apiCalls.push(method);
      const mapping = migrationData.apiMappings[method];

      if (mapping.status.includes("❌")) {
        deprecatedEndpoints.push({
          endpoint: method,
          replacement: mapping.v1,
        });
        breakingChanges.push({
          change: `${method} has no v2026-01-01 counterpart`,
          explanation: mapping.notes,
        });
      }
    }
  });

  // Detect deprecated attributes (multi-case)
  migrationData.deprecated.forEach((attr) => {
    const regex = buildMultiCaseRegex(attr.replace(/\./g, "_"));
    if (regex.test(sourceCode)) {
      breakingChanges.push({
        change: `Deprecated attribute: ${attr}`,
        explanation:
          "This attribute is removed in v2026-01-01 and has no replacement",
      });
    }
  });

  // Detect not supported attributes (multi-case)
  migrationData.notSupported.forEach((attr) => {
    const regex = buildMultiCaseRegex(attr.replace(/\./g, "_"));
    if (regex.test(sourceCode)) {
      breakingChanges.push({
        change: `Not supported attribute: ${attr}`,
        explanation: "This attribute is not available in v2026-01-01",
      });
    }
  });

  // Detect attribute mappings (multi-case)
  Object.entries(migrationData.attributeMappings).forEach(([v0, v1]) => {
    const regex = buildMultiCaseRegex(v0.replace(/\./g, "_"));
    if (regex.test(sourceCode)) {
      usedAttributes.push({
        v0,
        v1,
        notes: `Mapped from ${v0} to ${v1}`,
      });

      // Detect which includedData parameters might be needed
      Object.entries(migrationData.includedDataParameters).forEach(
        ([param, info]) => {
          if (info.attributes.some((attr) => v1.startsWith(attr))) {
            if (!detectedIncludedData.includes(param)) {
              detectedIncludedData.push(param);
            }
          }
        },
      );
    }
  });

  // Detect status value mappings
  Object.entries(migrationData.statusMappings.fulfillmentStatus).forEach(
    ([v0Status, v1Status]) => {
      const regex = new RegExp(`['"\`]${v0Status}['"\`]`, "g");
      if (regex.test(sourceCode)) {
        statusMappingsUsed.push({ v0: v0Status, v1: v1Status });
      }
    },
  );

  Object.entries(migrationData.statusMappings.fulfillmentChannel).forEach(
    ([v0Channel, v1Channel]) => {
      const regex = new RegExp(`['"\`]${v0Channel}['"\`]`, "g");
      if (regex.test(sourceCode)) {
        statusMappingsUsed.push({ v0: v0Channel, v1: v1Channel });
      }
    },
  );

  // Detect query parameter usage (multi-case)
  Object.entries(migrationData.queryParameterMappings).forEach(
    ([v0Param, v1Param]) => {
      const regex = buildMultiCaseRegex(v0Param);
      if (regex.test(sourceCode)) {
        queryParamsUsed.push({ v0: v0Param, v1: v1Param });
        if (v1Param.includes("Not available") || v1Param.includes("Breaking")) {
          breakingChanges.push({
            change: `Query parameter: ${v0Param}`,
            explanation: v1Param,
          });
        }
      }
    },
  );

  // Detect program checks (boolean flags that map to programs array, multi-case)
  const programFlags = [
    "IsPrime",
    "IsBusinessOrder",
    "IsPremiumOrder",
    "IsISPU",
    "IsTransparency",
  ];
  programFlags.forEach((flag) => {
    const regex = buildMultiCaseRegex(flag);
    if (regex.test(sourceCode)) {
      const programName = migrationData.attributeMappings[flag];
      if (programName) {
        const match = programName.match(/check for ([A-Z_]+)/);
        if (match) {
          programsDetected.push(match[1]);
        }
      }
    }
  });

  return {
    deprecatedEndpoints,
    breakingChanges,
    usedAttributes,
    apiCalls,
    detectedIncludedData,
    statusMappingsUsed,
    queryParamsUsed,
    programsDetected,
  };
}
