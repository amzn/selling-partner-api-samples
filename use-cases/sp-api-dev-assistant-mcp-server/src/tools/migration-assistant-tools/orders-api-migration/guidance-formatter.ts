import { MigrationData } from "./migration-data.js";

export function formatGeneralGuidance(migrationData: MigrationData): string {
  let guidance = `# 🔄 Orders API Migration Guide: V0 → V1 (2026-01-01)\n\n`;

  guidance += `## 📋 Overview\n\n`;
  guidance += `This guide helps you migrate from Orders API V0 to V1 (2026-01-01).\n\n`;

  guidance += `**Key Changes:**\n`;
  guidance += `- New nested data structure (buyer, recipient, fulfillment, etc.)\n`;
  guidance += `- Enhanced data sets with \`includedData\` parameter\n`;
  guidance += `- New programs array replaces boolean flags\n`;
  guidance += `- Better financial breakdown with proceeds and expense tracking\n`;
  guidance += `- Some V0 APIs have no V1 counterpart (continue using V0)\n\n`;

  // API Availability
  guidance += `## 🔌 API Method Mapping\n\n`;
  guidance += `### ✅ Available in V1:\n\n`;
  Object.entries(migrationData.apiMapping).forEach(([v0Method, mapping]) => {
    if (mapping.status.includes("✅")) {
      guidance += `- **${v0Method}** → ${mapping.v1}\n`;
      guidance += `  ${mapping.notes}\n\n`;
    }
  });

  guidance += `### ❌ NOT Available in V1 (Continue using V0):\n\n`;
  Object.entries(migrationData.apiMapping).forEach(([v0Method, mapping]) => {
    if (mapping.status.includes("❌")) {
      guidance += `- **${v0Method}**\n`;
      guidance += `  ${mapping.notes}\n\n`;
    }
  });

  // Attribute Mappings
  guidance += `## 🗺️ Key Attribute Mappings\n\n`;
  guidance += `Common V0 attributes and their V1 equivalents:\n\n`;

  const highlightedMappings = [
    "AmazonOrderId",
    "OrderStatus",
    "IsPrime",
    "IsBusinessOrder",
    "OrderTotal",
    "ShippingAddress",
    "BuyerInfo.BuyerEmail",
    "QuantityShipped",
  ];

  highlightedMappings.forEach((v0Attr) => {
    const v1Attr = migrationData.mappingExamples[v0Attr];
    if (v1Attr) {
      guidance += `- \`${v0Attr}\` → \`${v1Attr}\`\n`;
    }
  });

  guidance += `\n[View complete mapping list for all ${Object.keys(migrationData.mappingExamples).length} attributes]\n\n`;

  // Breaking Changes
  guidance += `## ⚠️ Breaking Changes\n\n`;
  guidance += `### Deprecated Attributes (${migrationData.deprecated.length})\n\n`;
  guidance += `These attributes are removed in V1 with no replacement:\n\n`;
  migrationData.deprecated.slice(0, 5).forEach((attr) => {
    guidance += `- ${attr}\n`;
  });
  if (migrationData.deprecated.length > 5) {
    guidance += `- ... and ${migrationData.deprecated.length - 5} more\n`;
  }
  guidance += `\n`;

  guidance += `### Not Supported Attributes (${migrationData.notSupported.length})\n\n`;
  guidance += `These attributes are not available in current V1 release:\n\n`;
  migrationData.notSupported.slice(0, 5).forEach((attr) => {
    guidance += `- ${attr}\n`;
  });
  if (migrationData.notSupported.length > 5) {
    guidance += `- ... and ${migrationData.notSupported.length - 5} more\n`;
  }
  guidance += `\n`;

  // New Features
  guidance += `## 🆕 New Features in V1\n\n`;
  migrationData.newFeatures.forEach((feature) => {
    guidance += `- ${feature}\n`;
  });
  guidance += `\n`;

  // Code Examples
  guidance += `## 💻 Code Examples\n\n`;
  guidance += `### Checking Prime Orders\n\n`;
  guidance += `**V0:**\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `if (order.IsPrime) {\n`;
  guidance += `  // handle prime order\n`;
  guidance += `}\n`;
  guidance += `\`\`\`\n\n`;
  guidance += `**V1:**\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `if (order.programs?.includes('PRIME')) {\n`;
  guidance += `  // handle prime order\n`;
  guidance += `}\n`;
  guidance += `\`\`\`\n\n`;

  guidance += `### Getting Order Status\n\n`;
  guidance += `**V0:**\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `const status = order.OrderStatus;\n`;
  guidance += `\`\`\`\n\n`;
  guidance += `**V1:**\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `const status = order.fulfillment.fulfillmentStatus;\n`;
  guidance += `\`\`\`\n\n`;

  guidance += `### Search Orders (V1)\n\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `const response = await fetch(\n`;
  guidance += `  'https://sellingpartnerapi-na.amazon.com/orders/2026-01-01/orders?' +\n`;
  guidance += `  new URLSearchParams({\n`;
  guidance += `    createdAfter: '2025-12-01T00:00:00Z',\n`;
  guidance += `    marketplaceIds: 'ATVPDKIKX0DER',\n`;
  guidance += `    includedData: 'BUYER,RECIPIENT,FULFILLMENT'\n`;
  guidance += `  }),\n`;
  guidance += `  {\n`;
  guidance += `    headers: {\n`;
  guidance += `      'x-amz-access-token': accessToken\n`;
  guidance += `    }\n`;
  guidance += `  }\n`;
  guidance += `);\n`;
  guidance += `\`\`\`\n\n`;

  // Migration Checklist
  guidance += `## ✅ Migration Checklist\n\n`;
  guidance += `- [ ] Review API method availability (some require V0)\n`;
  guidance += `- [ ] Update attribute references to new nested structure\n`;
  guidance += `- [ ] Replace boolean flags with programs array checks\n`;
  guidance += `- [ ] Add \`includedData\` parameter for additional data\n`;
  guidance += `- [ ] Update endpoint URLs from \`/orders/v0/\` to \`/orders/2026-01-01/\`\n`;
  guidance += `- [ ] Update error handling for new response formats\n`;
  guidance += `- [ ] Test with sandbox environment\n`;
  guidance += `- [ ] Update TypeScript types/interfaces\n`;
  guidance += `- [ ] Plan V0 fallback for unsupported operations\n\n`;

  // Resources
  guidance += `## 📚 Resources\n\n`;
  guidance += `- [SP-API Orders V1 Documentation](https://developer-docs.amazon.com/sp-api/docs/orders-api-v1-reference)\n`;
  guidance += `- [Migration Guide](https://developer-docs.amazon.com/sp-api/docs/orders-api-v0-to-v1-migration-guide)\n`;
  guidance += `- [SP-API Developer Guide](https://developer-docs.amazon.com/sp-api/)\n\n`;

  guidance += `## 🔍 Need More Help?\n\n`;
  guidance += `- **Code Analysis:** Provide your source code for detailed analysis and automated refactoring\n`;
  guidance += `- **Specific Attributes:** Ask about specific V0 attributes for detailed mapping\n`;
  guidance += `- **API Methods:** Ask about specific V0 API methods for migration guidance\n`;

  return guidance;
}
