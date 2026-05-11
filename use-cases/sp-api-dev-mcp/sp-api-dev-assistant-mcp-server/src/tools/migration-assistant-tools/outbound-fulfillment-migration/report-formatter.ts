import { OutboundCodeAnalysis } from "./code-analyzer.js";
import { OutboundMigrationData } from "./migration-data.js";

export function formatOutboundAnalysisReport(
  analysis: OutboundCodeAnalysis,
  migrationData: OutboundMigrationData,
): string {
  let report = `# 🔍 Outbound Fulfillment Migration Analysis Report\n\n`;
  report += `## 📊 Summary\n\n`;
  report += `- **API Calls Found:** ${analysis.apiCalls.length}\n`;
  report += `- **Attributes to Update:** ${analysis.usedAttributes.length}\n`;
  report += `- **Breaking Changes:** ${analysis.breakingChanges.length}\n`;
  report += `- **Deprecated Endpoints:** ${analysis.deprecatedEndpoints.length}\n`;
  report += `- **Delivery Service Levels to Update:** ${analysis.deliveryServiceLevelsUsed.length}\n`;
  report += `- **Fulfillment Actions to Update:** ${analysis.fulfillmentActionsUsed.length}\n`;
  report += `- **Fulfillment Policies to Update:** ${analysis.fulfillmentPoliciesUsed.length}\n`;
  report += `- **Status Values to Update:** ${analysis.statusMappingsUsed.length}\n`;
  report += `- **Query Parameters to Update:** ${analysis.queryParamsUsed.length}\n`;
  report += `- **Request Body Changes:** ${analysis.requestBodyChangesDetected.length}\n`;
  report += `- **Response Structure Changes:** ${analysis.responseChangesDetected.length}\n\n`;

  if (analysis.deprecatedEndpoints.length > 0) {
    report += `## ❌ Deprecated/Moved Endpoints\n\n`;
    analysis.deprecatedEndpoints.forEach((endpoint) => {
      report += `- **${endpoint.endpoint}** → ${endpoint.replacement}\n`;
    });
    report += `\n`;
  }

  if (analysis.breakingChanges.length > 0) {
    report += `## ⚠️ Breaking Changes\n\n`;
    analysis.breakingChanges.forEach((change, index) => {
      report += `${index + 1}. **${change.change}**\n`;
      report += `   ${change.explanation}\n\n`;
    });
  }

  if (analysis.usedAttributes.length > 0) {
    report += `## 🗺️ Attribute Mappings\n\n`;
    analysis.usedAttributes.forEach((attr) => {
      report += `- \`${attr.v0}\` → \`${attr.v1}\`\n`;
    });
    report += `\n`;
  }

  if (analysis.deliveryServiceLevelsUsed.length > 0) {
    report += `## 🚚 Delivery Service Level Updates\n\n`;
    analysis.deliveryServiceLevelsUsed.forEach((speed) => {
      report += `- \`"${speed.v0}"\` → \`"${speed.v1}"\`\n`;
    });
    report += `\n`;
  }

  if (analysis.fulfillmentActionsUsed.length > 0) {
    report += `## ⚙️ Fulfillment Action Updates\n\n`;
    analysis.fulfillmentActionsUsed.forEach((action) => {
      report += `- \`"${action.v0}"\` → \`"${action.v1}"\`\n`;
    });
    report += `\n`;
  }

  if (analysis.fulfillmentPoliciesUsed.length > 0) {
    report += `## 📋 Fulfillment Policy Updates\n\n`;
    analysis.fulfillmentPoliciesUsed.forEach((policy) => {
      report += `- \`"${policy.v0}"\` → \`"${policy.v1}"\`\n`;
    });
    report += `\n`;
  }

  if (analysis.statusMappingsUsed.length > 0) {
    report += `## 🔄 Status Value Updates\n\n`;
    analysis.statusMappingsUsed.forEach((status) => {
      report += `- \`"${status.v0}"\` → \`"${status.v1}"\`\n`;
    });
    report += `\n`;
  }

  if (analysis.queryParamsUsed.length > 0) {
    report += `## 🔍 Query Parameter Updates\n\n`;
    analysis.queryParamsUsed.forEach((param) => {
      if (param.v1.includes("Breaking")) {
        report += `- \`${param.v0}\` → ⚠️ ${param.v1}\n`;
      } else {
        report += `- \`${param.v0}\` → \`${param.v1}\`\n`;
      }
    });
    report += `\n`;
  }

  if (analysis.requestBodyChangesDetected.length > 0) {
    report += `## 📝 Request Body Changes\n\n`;
    analysis.requestBodyChangesDetected.forEach((change) => {
      if (change.change === "removed") {
        report += `- ❌ \`${change.field}\` (${change.api}) - Removed in v2025-09-24\n`;
      } else {
        report += `- 🔄 \`${change.field}\` (${change.api}) - ${change.change}\n`;
      }
    });
    report += `\n`;
  }

  if (analysis.responseChangesDetected.length > 0) {
    report += `## 📤 Response Structure Changes\n\n`;
    analysis.responseChangesDetected.forEach((change) => {
      report += `- ⚠️ ${change}\n`;
    });
    report += `\n`;
  }

  if (analysis.apiCalls.length > 0) {
    report += `## 🔌 API Methods Detected\n\n`;
    analysis.apiCalls.forEach((method) => {
      const mapping = migrationData.apiMappings[method];
      const status = mapping?.status || "Unknown";
      report += `- **${method}** - ${status}\n`;
      if (mapping?.notes) {
        report += `  ${mapping.notes}\n`;
      }
    });
    report += `\n`;
  }

  // Migration Benefits
  report += `## 🎯 Migration Benefits\n\n`;
  migrationData.migrationBenefits.forEach((benefit) => {
    report += `- ${benefit}\n`;
  });
  report += `\n`;

  report += `## ✅ Migration Checklist\n\n`;
  report += `- [ ] Update base path: /fba/outbound/2020-07-01 → /fulfillment/outbound/2025-09-24\n`;
  report += `- [ ] Rename API operations to new names\n`;
  report += `- [ ] Update endpoint paths (/fulfillmentOrders → /orders)\n`;
  report += `- [ ] Update enum values to SCREAMING_SNAKE_CASE\n`;
  report += `- [ ] Rename request body fields\n`;
  report += `- [ ] Remove payload wrapper from response parsing\n`;
  report += `- [ ] Update status field names and values\n`;
  report += `- [ ] Handle pagination changes (nextToken → pageToken)\n`;
  report += `- [ ] Replace deprecated operations with alternatives\n`;
  report += `- [ ] Add x-amzn-fulfillment-service-id header if needed\n`;
  report += `- [ ] Test with sandbox environment\n`;
  report += `- [ ] Update TypeScript types/interfaces\n\n`;

  return report;
}

export function formatOutboundMigrationReport(
  analysis: OutboundCodeAnalysis,
  refactoredCode: string,
  migrationData: OutboundMigrationData,
): string {
  let report = formatOutboundAnalysisReport(analysis, migrationData);

  report += `\n---\n\n`;
  report += `## 💻 Refactored Code\n\n`;
  report += `\`\`\`javascript\n${refactoredCode}\n\`\`\`\n\n`;

  report += `## 🧪 Testing Recommendations\n\n`;
  report += `1. **Unit Tests:** Update test cases to match new v2025-09-24 response structure (no payload wrapper)\n`;
  report += `2. **Integration Tests:** Test with SP-API sandbox environment\n`;
  report += `3. **Delivery Service Levels:** Verify SCREAMING_SNAKE_CASE values work correctly\n`;
  report += `4. **Fulfillment Actions/Policies:** Verify new enum values (SHIP, FILL_ALL_AVAILABLE, etc.)\n`;
  report += `5. **Status Values:** Verify status comparisons use new values (COMPLETE, PROCESSING, etc.)\n`;
  report += `6. **Request Bodies:** Verify renamed fields are accepted (orderId, lineItems, etc.)\n`;
  report += `7. **Response Parsing:** Verify direct object access without payload wrapper\n`;
  report += `8. **Pagination:** Test pageToken handling\n`;
  report += `9. **Sandbox Simulation:** Test new delivery milestones (IN_TRANSIT, DELAYED, DELIVERED)\n`;
  report += `10. **Webhook Integration:** Test notification delivery if migrating from polling\n`;
  report += `11. **Multi-site:** Test x-amzn-fulfillment-service-id header if applicable\n`;
  report += `12. **Backward Compatibility:** Ensure v2020-07-01 fallback works for deprecated operations\n\n`;

  report += `## 📚 Additional Resources\n\n`;
  report += `- [SP-API Fulfillment Outbound v2025-09-24 Documentation](https://developer-docs.amazon.com/sp-api/docs/fulfillment-outbound-api-v2025-reference)\n`;
  report += `- [MCF API Developer Guide](https://developer-docs.amazon.com/sp-api/docs/mcf-api-developer-guide)\n`;
  report += `- Use \`sp_api_migration_assistant\` tool for detailed attribute mappings\n\n`;

  return report;
}
