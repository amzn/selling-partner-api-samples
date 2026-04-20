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
  report += `- **Deprecated Endpoints:** ${analysis.deprecatedEndpoints.length}\n\n`;

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

  if (analysis.apiCalls.length > 0) {
    report += `## 🔌 API Methods Detected\n\n`;
    analysis.apiCalls.forEach((method) => {
      const mapping = migrationData.apiMapping[method];
      const status = mapping?.status || "Unknown";
      report += `- **${method}** - ${status}\n`;
    });
    report += `\n`;
  }

  report += `## ✅ Migration Checklist\n\n`;
  report += `- [ ] Review all deprecated endpoints and plan V0 fallback strategy\n`;
  report += `- [ ] Update attribute references to new V1 structure\n`;
  report += `- [ ] Add \`includedData\` parameter where needed (BUYER, RECIPIENT, etc.)\n`;
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
  report += `1. **Unit Tests:** Update test cases to match new V1 response structure\n`;
  report += `2. **Integration Tests:** Test with SP-API sandbox environment\n`;
  report += `3. **Error Handling:** Verify error responses match V1 format\n`;
  report += `4. **Performance:** Monitor API response times and adjust \`includedData\` usage\n`;
  report += `5. **Backward Compatibility:** Ensure V0 fallback works for unsupported operations\n\n`;

  report += `## 📚 Additional Resources\n\n`;
  report += `- [SP-API Orders V1 Documentation](https://developer-docs.amazon.com/sp-api/docs/orders-api-v1-reference)\n`;
  report += `- [Migration Guide](https://developer-docs.amazon.com/sp-api/docs/orders-api-v0-to-v1-migration-guide)\n`;
  report += `- Use \`getMigrationGuide\` tool for detailed attribute mappings\n\n`;

  return report;
}
