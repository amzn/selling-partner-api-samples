import { OutboundMigrationData } from "./migration-data.js";

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
  const variants = [...new Set([camelCaseName, snake, pascal])];
  return new RegExp(`\\b(?:${variants.join("|")})\\b`, "g");
}

export interface OutboundCodeAnalysis {
  deprecatedEndpoints: Array<{ endpoint: string; replacement: string }>;
  breakingChanges: Array<{ change: string; explanation: string }>;
  usedAttributes: Array<{ v0: string; v1: string; notes: string }>;
  apiCalls: string[];
  deliveryServiceLevelsUsed: Array<{ v0: string; v1: string }>;
  fulfillmentActionsUsed: Array<{ v0: string; v1: string }>;
  fulfillmentPoliciesUsed: Array<{ v0: string; v1: string }>;
  statusMappingsUsed: Array<{ v0: string; v1: string }>;
  queryParamsUsed: Array<{ v0: string; v1: string }>;
  requestBodyChangesDetected: Array<{
    api: string;
    field: string;
    change: string;
  }>;
  responseChangesDetected: string[];
}

export function analyzeOutboundFulfillmentCode(
  sourceCode: string,
  migrationData: OutboundMigrationData,
): OutboundCodeAnalysis {
  const deprecatedEndpoints: Array<{ endpoint: string; replacement: string }> =
    [];
  const breakingChanges: Array<{ change: string; explanation: string }> = [];
  const usedAttributes: Array<{ v0: string; v1: string; notes: string }> = [];
  const apiCalls: string[] = [];
  const deliveryServiceLevelsUsed: Array<{ v0: string; v1: string }> = [];
  const fulfillmentActionsUsed: Array<{ v0: string; v1: string }> = [];
  const fulfillmentPoliciesUsed: Array<{ v0: string; v1: string }> = [];
  const statusMappingsUsed: Array<{ v0: string; v1: string }> = [];
  const queryParamsUsed: Array<{ v0: string; v1: string }> = [];
  const requestBodyChangesDetected: Array<{
    api: string;
    field: string;
    change: string;
  }> = [];
  const responseChangesDetected: string[] = [];

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
          change: `${method} is not available in v2025-09-24`,
          explanation: mapping.notes,
        });
      }
    }
  });

  // Detect deprecated items (multi-case)
  migrationData.deprecated.forEach((attr) => {
    const regex = buildMultiCaseRegex(attr.replace(/\./g, "_"));
    if (regex.test(sourceCode)) {
      breakingChanges.push({
        change: `Deprecated: ${attr}`,
        explanation: "This is deprecated or removed in v2025-09-24",
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
    }
  });

  // Detect delivery service level values (shipping speed)
  Object.entries(migrationData.deliveryServiceLevelMappings).forEach(
    ([v0Speed, v1Speed]) => {
      const regex = new RegExp(`['"\`]${v0Speed}['"\`]`, "g");
      if (regex.test(sourceCode)) {
        deliveryServiceLevelsUsed.push({ v0: v0Speed, v1: v1Speed });
      }
    },
  );

  // Detect fulfillment action values
  Object.entries(migrationData.fulfillmentActionMappings).forEach(
    ([v0Action, v1Action]) => {
      const regex = new RegExp(`['"\`]${v0Action}['"\`]`, "g");
      if (regex.test(sourceCode)) {
        fulfillmentActionsUsed.push({ v0: v0Action, v1: v1Action });
      }
    },
  );

  // Detect fulfillment policy values
  Object.entries(migrationData.fulfillmentPolicyMappings).forEach(
    ([v0Policy, v1Policy]) => {
      const regex = new RegExp(`['"\`]${v0Policy}['"\`]`, "g");
      if (regex.test(sourceCode)) {
        fulfillmentPoliciesUsed.push({ v0: v0Policy, v1: v1Policy });
      }
    },
  );

  // Detect status value mappings
  Object.entries(migrationData.statusMappings.fulfillmentOrderStatus).forEach(
    ([v0Status, v1Status]) => {
      const regex = new RegExp(`['"\`]${v0Status}['"\`]`, "g");
      if (regex.test(sourceCode)) {
        statusMappingsUsed.push({ v0: v0Status, v1: v1Status });
      }
    },
  );

  Object.entries(migrationData.statusMappings.shipmentStatus).forEach(
    ([v0Status, v1Status]) => {
      // Skip if same value (already uppercase)
      if (v0Status !== v1Status) {
        const regex = new RegExp(`['"\`]${v0Status}['"\`]`, "g");
        if (regex.test(sourceCode)) {
          statusMappingsUsed.push({ v0: v0Status, v1: v1Status });
        }
      }
    },
  );

  // Detect query parameter usage (multi-case)
  Object.entries(migrationData.queryParameterMappings).forEach(
    ([v0Param, v1Param]) => {
      const regex = buildMultiCaseRegex(v0Param);
      if (regex.test(sourceCode)) {
        queryParamsUsed.push({ v0: v0Param, v1: v1Param });
        if (v1Param.includes("Breaking")) {
          breakingChanges.push({
            change: `Query parameter: ${v0Param}`,
            explanation: v1Param,
          });
        }
      }
    },
  );

  // Detect request body field usage for known APIs
  Object.entries(migrationData.requestBodyChanges).forEach(([api, changes]) => {
    // Check removed fields
    changes.removed.forEach((field) => {
      const regex = buildMultiCaseRegex(field.replace(/\[.*?\]/g, ""));
      if (regex.test(sourceCode)) {
        requestBodyChangesDetected.push({
          api,
          field,
          change: "removed",
        });
        breakingChanges.push({
          change: `Field removed in ${api}: ${field}`,
          explanation: `The field ${field} has been removed from the ${api} request in v2025-09-24`,
        });
      }
    });

    // Check renamed fields
    Object.entries(changes.renamed).forEach(([oldName, newName]) => {
      const cleanName =
        oldName
          .replace(/\[.*?\]/g, "")
          .split(".")
          .pop() || oldName;
      const regex = buildMultiCaseRegex(cleanName);
      if (regex.test(sourceCode)) {
        requestBodyChangesDetected.push({
          api,
          field: oldName,
          change: `renamed to ${newName}`,
        });
      }
    });
  });

  // Detect response structure usage (payload wrapper pattern)
  if (
    /\.payload\./g.test(sourceCode) ||
    /\['payload'\]/g.test(sourceCode) ||
    /\["payload"\]/g.test(sourceCode)
  ) {
    responseChangesDetected.push(
      "payload wrapper detected - v2025-09-24 removes the payload wrapper",
    );
    breakingChanges.push({
      change: "Response payload wrapper removed",
      explanation:
        "v2025-09-24 returns direct response objects without the nested payload structure. Update response parsing.",
    });
  }

  // Detect old base path usage
  if (
    /\/fba\/outbound\/2020-07-01/g.test(sourceCode) ||
    /\/fba\/outbound\/v2020-07-01/g.test(sourceCode)
  ) {
    breakingChanges.push({
      change: "Base path changed",
      explanation: `${migrationData.basePath.old} → ${migrationData.basePath.new}`,
    });
  }

  return {
    deprecatedEndpoints,
    breakingChanges,
    usedAttributes,
    apiCalls,
    deliveryServiceLevelsUsed,
    fulfillmentActionsUsed,
    fulfillmentPoliciesUsed,
    statusMappingsUsed,
    queryParamsUsed,
    requestBodyChangesDetected,
    responseChangesDetected,
  };
}
