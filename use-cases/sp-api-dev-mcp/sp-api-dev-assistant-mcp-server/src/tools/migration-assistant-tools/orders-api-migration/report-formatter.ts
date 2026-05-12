import { CodeAnalysis } from "./code-analyzer.js";
import { MigrationData } from "./migration-data.js";

export function formatAnalysisReport(
  analysis: CodeAnalysis,
  migrationData: MigrationData,
): string {
  let report = `# 🔍 Migration Analysis Report\n\n`;
  report += `## 📊 Summary\n\n`;
  report += `- **API Calls Found:** ${analysis.apiCalls.length}\n`;
  report += `- **Attributes to Update:** ${analysis.usedAttributes.length}\n`;
  report += `- **Breaking Changes:** ${analysis.breakingChanges.length}\n`;
  report += `- **Deprecated Endpoints:** ${analysis.deprecatedEndpoints.length}\n`;
  report += `- **Status Values to Update:** ${analysis.statusMappingsUsed.length}\n`;
  report += `- **Query Parameters to Update:** ${analysis.queryParamsUsed.length}\n`;
  report += `- **Programs Detected:** ${analysis.programsDetected.length}\n\n`;

  if (analysis.detectedIncludedData.length > 0) {
    report += `## 📦 Suggested includedData Parameters\n\n`;
    report += `Based on the attributes used in your code, include these parameters:\n\n`;
    report += `\`includedData: '${analysis.detectedIncludedData.join(",")}'\`\n\n`;
    analysis.detectedIncludedData.forEach((param) => {
      const info = migrationData.includedDataParameters[param];
      if (info) {
        report += `- **${param}**: ${info.description}`;
        if (info.notes) {
          report += ` (${info.notes})`;
        }
        report += `\n`;
      }
    });
    report += `\n`;
  }

  if (analysis.deprecatedEndpoints.length > 0) {
    report += `## ❌ Deprecated Endpoints\n\n`;
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
      if (param.v1.includes("Not available")) {
        report += `- \`${param.v0}\` → ❌ ${param.v1}\n`;
      } else if (param.v1.includes("Breaking")) {
        report += `- \`${param.v0}\` → ⚠️ ${param.v1}\n`;
      } else {
        report += `- \`${param.v0}\` → \`${param.v1}\`\n`;
      }
    });
    report += `\n`;
  }

  if (analysis.programsDetected.length > 0) {
    report += `## 🏷️ Programs Detected\n\n`;
    report += `Your code uses boolean flags that map to the programs array in v2026-01-01:\n\n`;
    analysis.programsDetected.forEach((program) => {
      report += `- \`${program}\` - Check with \`order.programs?.includes('${program}')\`\n`;
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
  report += `- [ ] Review all deprecated endpoints and plan V0 fallback strategy\n`;
  report += `- [ ] Update attribute references to new v2026-01-01 structure\n`;
  report += `- [ ] Update status value comparisons to uppercase format\n`;
  report += `- [ ] Update query parameters to camelCase format\n`;
  report += `- [ ] Handle pagination token changes (NextToken → paginationToken, 24h expiry)\n`;
  report += `- [ ] Replace boolean flags with programs array checks\n`;
  report += `- [ ] Add \`includedData\` parameter where needed\n`;
  report += `- [ ] Update timestamp parsing for millisecond precision\n`;
  report += `- [ ] Update error handling for new response formats\n`;
  report += `- [ ] Test with sandbox environment before production\n`;
  report += `- [ ] Update TypeScript types/interfaces\n`;
  report += `- [ ] Monitor for V0 API deprecation announcements\n\n`;

  return report;
}

export function formatMigrationReport(
  analysis: CodeAnalysis,
  refactoredCode: string,
  migrationData: MigrationData,
): string {
  let report = formatAnalysisReport(analysis, migrationData);

  report += `\n---\n\n`;
  report += `## 💻 Refactored Code\n\n`;
  report += `\`\`\`javascript\n${refactoredCode}\n\`\`\`\n\n`;

  report += `## 🧪 Testing Recommendations\n\n`;
  report += `1. **Unit Tests:** Update test cases to match new v2026-01-01 response structure\n`;
  report += `2. **Integration Tests:** Test with SP-API sandbox environment\n`;
  report += `3. **Status Values:** Verify status comparisons use uppercase values\n`;
  report += `4. **Query Parameters:** Verify camelCase parameter names work correctly\n`;
  report += `5. **Pagination:** Test pagination token handling with 24-hour expiry\n`;
  report += `6. **Programs Array:** Verify boolean flag replacements work correctly\n`;
  report += `7. **Timestamps:** Verify millisecond precision handling\n`;
  report += `8. **Error Handling:** Verify error responses match v2026-01-01 format\n`;
  report += `9. **Performance:** Monitor API response times and adjust \`includedData\` usage\n`;
  report += `10. **Backward Compatibility:** Ensure V0 fallback works for unsupported operations\n\n`;

  if (analysis.detectedIncludedData.length > 0) {
    report += `## 📦 includedData Usage\n\n`;
    report += `Your code uses attributes that require these includedData parameters:\n\n`;
    report += `\`\`\`javascript\n`;
    report += `const response = await getOrder(orderId, {\n`;
    report += `  includedData: ['${analysis.detectedIncludedData.join("', '")}']\n`;
    report += `});\n`;
    report += `\`\`\`\n\n`;
  }

  if (analysis.programsDetected.length > 0) {
    report += `## 🏷️ Programs Array Usage\n\n`;
    report += `Replace boolean flag checks with programs array:\n\n`;
    report += `\`\`\`javascript\n`;
    analysis.programsDetected.forEach((program) => {
      report += `// Check for ${program}\n`;
      report += `if (order.programs?.includes('${program}')) {\n`;
      report += `  // Handle ${program} order\n`;
      report += `}\n\n`;
    });
    report += `\`\`\`\n\n`;
  }

  report += `## 📚 Additional Resources\n\n`;
  report += `- [SP-API Orders v2026-01-01 Documentation](https://developer-docs.amazon.com/sp-api/docs/orders-api-v1-reference)\n`;
  report += `- [Migration Guide](https://developer-docs.amazon.com/sp-api/docs/orders-api-v0-to-v1-migration-guide)\n`;
  report += `- Use \`sp_api_migration_assistant\` tool for detailed attribute mappings\n\n`;

  return report;
}
