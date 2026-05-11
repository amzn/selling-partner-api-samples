import { OutboundCodeAnalysis } from "./code-analyzer.js";
import { OutboundMigrationData } from "./migration-data.js";

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

export function generateRefactoredOutboundCode(
  sourceCode: string,
  analysis: OutboundCodeAnalysis,
  targetVersion: string,
  _migrationData: OutboundMigrationData,
): string {
  let refactoredCode = sourceCode;

  // Replace delivery service level values (shipping speed)
  analysis.deliveryServiceLevelsUsed.forEach((speed) => {
    const v0Pattern = new RegExp(`(['"\`])${speed.v0}\\1`, "g");
    refactoredCode = refactoredCode.replace(v0Pattern, `$1${speed.v1}$1`);
  });

  // Replace fulfillment action values
  analysis.fulfillmentActionsUsed.forEach((action) => {
    const v0Pattern = new RegExp(`(['"\`])${action.v0}\\1`, "g");
    refactoredCode = refactoredCode.replace(v0Pattern, `$1${action.v1}$1`);
  });

  // Replace fulfillment policy values
  analysis.fulfillmentPoliciesUsed.forEach((policy) => {
    const v0Pattern = new RegExp(`(['"\`])${policy.v0}\\1`, "g");
    refactoredCode = refactoredCode.replace(v0Pattern, `$1${policy.v1}$1`);
  });

  // Replace status values
  analysis.statusMappingsUsed.forEach((status) => {
    const v0Pattern = new RegExp(`(['"\`])${status.v0}\\1`, "g");
    refactoredCode = refactoredCode.replace(v0Pattern, `$1${status.v1}$1`);
  });

  // Replace query parameters (handles camelCase, snake_case, PascalCase)
  analysis.queryParamsUsed.forEach((param) => {
    if (!param.v1.includes("Breaking")) {
      const v1ParamName = param.v1.split(" ")[0];
      const v0Pattern = buildMultiCaseRegex(param.v0);
      refactoredCode = refactoredCode.replace(v0Pattern, v1ParamName);
    }
  });

  // Replace API method calls with new names
  const apiReplacements: Record<string, string> = {
    createFulfillmentOrder: "createOrder",
    getFulfillmentOrder: "getOrder",
    updateFulfillmentOrder: "updateOrder",
    cancelFulfillmentOrder: "cancelOrder",
    listAllFulfillmentOrders: "listOrders",
    getFulfillmentPreview: "getOrderPreview",
    submitFulfillmentOrderStatusUpdate: "updateOrderStatus",
    deliveryOffers: "getOffers",
  };

  Object.entries(apiReplacements).forEach(([v0Method, v1Method]) => {
    const regex = buildMultiCaseRegex(v0Method);
    refactoredCode = refactoredCode.replace(regex, v1Method);
  });

  // Replace key attribute names from request bodies
  const attributeReplacements: Record<string, string> = {
    sellerFulfillmentOrderId: "orderId",
    shippingSpeedCategory: "deliveryServiceLevel",
    destinationAddress: "destination",
    fulfillmentOrderStatus: "status",
    statusUpdatedDate: "statusUpdateTime",
    receivedDate: "receiveTime",
    fulfillmentShipments: "shipments",
    fulfillmentShipmentPackage: "shipmentPackages",
    fulfillmentCenterId: "fulfillmentCenter",
    shippingSpeedCategories: "deliveryServiceLevels",
    queryStartDate: "updatedAfter",
    fulfillmentPreviews: "plannedShipments",
    fulfillmentPreviewShipments: "offers",
    earliestArrivalDate: "deliveryInterval.startTime",
    latestArrivalDate: "deliveryInterval.endTime",
  };

  Object.entries(attributeReplacements).forEach(([v0Attr, v1Attr]) => {
    const regex = buildMultiCaseRegex(v0Attr);
    const simpleName = v1Attr.includes(".") ? v1Attr : v1Attr;
    refactoredCode = refactoredCode.replace(regex, simpleName);
  });

  // Add comments for deprecated endpoints (multi-case)
  analysis.deprecatedEndpoints.forEach((endpoint) => {
    const regex = buildMultiCaseRegex(endpoint.endpoint);
    refactoredCode = refactoredCode.replace(
      regex,
      (match) =>
        `${match} /* ⚠️ ${endpoint.replacement} - not available in v2025-09-24 */`,
    );
  });

  // Update base path
  refactoredCode = refactoredCode.replace(
    /\/fba\/outbound\/2020-07-01/g,
    "/fulfillment/outbound/2025-09-24",
  );
  refactoredCode = refactoredCode.replace(
    /\/fba\/outbound\/v2020-07-01/g,
    "/fulfillment/outbound/2025-09-24",
  );

  // Update endpoint paths
  refactoredCode = refactoredCode.replace(
    /\/fulfillmentOrders\/preview/g,
    "/previews",
  );
  refactoredCode = refactoredCode.replace(/\/fulfillmentOrders/g, "/orders");
  refactoredCode = refactoredCode.replace(/\/deliveryOffers/g, "/offers");

  // Build summary notes
  const deliveryServiceLevelNotes =
    analysis.deliveryServiceLevelsUsed.length > 0
      ? `\n * Delivery service levels updated: ${analysis.deliveryServiceLevelsUsed.map((s) => `${s.v0} → ${s.v1}`).join(", ")}`
      : "";

  const fulfillmentActionNotes =
    analysis.fulfillmentActionsUsed.length > 0
      ? `\n * Fulfillment actions updated: ${analysis.fulfillmentActionsUsed.map((a) => `${a.v0} → ${a.v1}`).join(", ")}`
      : "";

  const fulfillmentPolicyNotes =
    analysis.fulfillmentPoliciesUsed.length > 0
      ? `\n * Fulfillment policies updated: ${analysis.fulfillmentPoliciesUsed.map((p) => `${p.v0} → ${p.v1}`).join(", ")}`
      : "";

  const statusNotes =
    analysis.statusMappingsUsed.length > 0
      ? `\n * Status values updated: ${analysis.statusMappingsUsed.map((s) => `${s.v0} → ${s.v1}`).join(", ")}`
      : "";

  const queryParamNotes =
    analysis.queryParamsUsed.length > 0
      ? `\n * Query parameters updated: ${analysis.queryParamsUsed.map((p) => `${p.v0} → ${p.v1.split(" ")[0]}`).join(", ")}`
      : "";

  const responseNotes =
    analysis.responseChangesDetected.length > 0
      ? `\n * Response changes: ${analysis.responseChangesDetected.join(", ")}`
      : "";

  // Add migration header comment
  const header = `/**
 * 🔄 Migrated from Fulfillment Outbound API v2020-07-01 to ${targetVersion}
 * Base path: /fba/outbound/2020-07-01 → /fulfillment/outbound/2025-09-24
 * 
 * Migration Summary:
 * - ${analysis.usedAttributes.length} attributes updated
 * - ${analysis.apiCalls.length} API methods analyzed
 * - ${analysis.breakingChanges.length} breaking changes identified
 * - ${analysis.requestBodyChangesDetected.length} request body changes detected${deliveryServiceLevelNotes}${fulfillmentActionNotes}${fulfillmentPolicyNotes}${statusNotes}${queryParamNotes}${responseNotes}
 * 
 * ⚠️ Notes:
 * - getPackageTrackingDetails moved to Amazon Tracking API
 * - getFeatures/getFeatureSKU/getFeatureInventory deprecated (use getOrderPreview)
 * - createFulfillmentReturn/listReturnReasonCodes deprecated
 * - Response objects no longer wrapped in payload
 * - All enum values now use SCREAMING_SNAKE_CASE
 */

`;

  return header + refactoredCode;
}
