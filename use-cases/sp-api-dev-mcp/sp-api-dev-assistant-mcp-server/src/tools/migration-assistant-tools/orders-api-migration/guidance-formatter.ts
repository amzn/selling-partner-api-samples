import { MigrationData } from "./migration-data.js";

export function formatGeneralGuidance(migrationData: MigrationData): string {
  let guidance = `# 🔄 Orders API Migration Guide: V0 → v2026-01-01\n\n`;

  guidance += `## 📋 Overview\n\n`;
  guidance += `This guide helps you migrate from Orders API V0 to v2026-01-01.\n\n`;

  guidance += `**Key Changes:**\n`;
  guidance += `- New nested data structure (buyer, recipient, fulfillment, etc.)\n`;
  guidance += `- Enhanced data sets with \`includedData\` parameter\n`;
  guidance += `- New programs array replaces boolean flags\n`;
  guidance += `- Better financial breakdown with proceeds and expense tracking\n`;
  guidance += `- Higher precision timestamps (millisecond-level)\n`;
  guidance += `- New package tracking for FBM orders\n`;
  guidance += `- Query parameter naming changes (PascalCase → camelCase)\n`;
  guidance += `- Some V0 APIs have no v2026-01-01 counterpart (continue using V0)\n\n`;

  // Migration Benefits
  guidance += `## 🎯 Migration Benefits\n\n`;
  migrationData.migrationBenefits.forEach((benefit) => {
    guidance += `- ${benefit}\n`;
  });
  guidance += `\n`;

  // API Availability
  guidance += `## 🔌 API Method Mapping\n\n`;
  guidance += `### ✅ Available in v2026-01-01:\n\n`;
  Object.entries(migrationData.apiMappings).forEach(([v0Method, mapping]) => {
    if (mapping.status.includes("✅")) {
      guidance += `- **${v0Method}** → ${mapping.v1}\n`;
      guidance += `  ${mapping.notes}\n\n`;
    }
  });

  guidance += `### ❌ NOT Available in v2026-01-01 (Continue using V0):\n\n`;
  Object.entries(migrationData.apiMappings).forEach(([v0Method, mapping]) => {
    if (mapping.status.includes("❌")) {
      guidance += `- **${v0Method}**\n`;
      guidance += `  ${mapping.notes}\n\n`;
    }
  });

  // includedData Parameters
  guidance += `## 📦 includedData Parameters\n\n`;
  guidance += `Use these parameters to request additional data in v2026-01-01:\n\n`;
  Object.entries(migrationData.includedDataParameters).forEach(
    ([param, info]) => {
      guidance += `- **${param}**: ${info.description}\n`;
      guidance += `  Attributes: ${info.attributes.join(", ")}\n\n`;
    },
  );

  // Attribute Mappings
  guidance += `## 🗺️ Key Attribute Mappings\n\n`;
  guidance += `Common V0 attributes and their v2026-01-01 equivalents:\n\n`;

  const highlightedMappings = [
    "AmazonOrderId",
    "OrderStatus",
    "IsPrime",
    "IsBusinessOrder",
    "OrderTotal",
    "ShippingAddress",
    "BuyerInfo.BuyerEmail",
    "QuantityShipped",
    "FulfillmentChannel",
  ];

  highlightedMappings.forEach((v0Attr) => {
    const v1Attr = migrationData.attributeMappings[v0Attr];
    if (v1Attr) {
      guidance += `- \`${v0Attr}\` → \`${v1Attr}\`\n`;
    }
  });

  guidance += `\n[View complete mapping list for all ${Object.keys(migrationData.attributeMappings).length} attributes]\n\n`;

  // Status Mappings
  guidance += `## 🔄 Status Value Mappings\n\n`;
  guidance += `### Fulfillment Status:\n\n`;
  Object.entries(migrationData.statusMappings.fulfillmentStatus).forEach(
    ([v0, v1]) => {
      guidance += `- \`${v0}\` → \`${v1}\`\n`;
    },
  );
  guidance += `\n### Fulfillment Channel:\n\n`;
  Object.entries(migrationData.statusMappings.fulfillmentChannel).forEach(
    ([v0, v1]) => {
      guidance += `- \`${v0}\` → \`${v1}\`\n`;
    },
  );
  guidance += `\n`;

  // Query Parameter Mappings
  guidance += `## 🔍 Query Parameter Mappings\n\n`;
  guidance += `Query parameters have changed from PascalCase to camelCase:\n\n`;
  Object.entries(migrationData.queryParameterMappings).forEach(
    ([v0Param, v1Param]) => {
      if (v1Param.includes("Not available")) {
        guidance += `- \`${v0Param}\` → ❌ ${v1Param}\n`;
      } else if (v1Param.includes("Breaking")) {
        guidance += `- \`${v0Param}\` → ⚠️ ${v1Param}\n`;
      } else {
        guidance += `- \`${v0Param}\` → \`${v1Param}\`\n`;
      }
    },
  );
  guidance += `\n`;

  // Package Tracking (New Feature)
  guidance += `## 📦 Package Tracking (New in v2026-01-01)\n\n`;
  guidance += `${migrationData.packageTracking.description}\n\n`;
  guidance += `Available attributes:\n\n`;
  Object.entries(migrationData.packageTracking.attributes).forEach(
    ([name, path]) => {
      guidance += `- \`${name}\`: ${path}\n`;
    },
  );
  guidance += `\n`;

  // Programs List
  guidance += `## 🏷️ Programs List\n\n`;
  guidance += `Programs replace boolean flags like IsPrime, IsBusinessOrder, etc.\n\n`;
  guidance += `### Order-Level Programs:\n\n`;
  migrationData.programsList.orderLevel.forEach((program) => {
    guidance += `- \`${program}\`\n`;
  });
  guidance += `\n### Order Item-Level Programs:\n\n`;
  migrationData.programsList.orderItemLevel.forEach((program) => {
    guidance += `- \`${program}\`\n`;
  });
  guidance += `\n`;

  // Breaking Changes
  guidance += `## ⚠️ Breaking Changes\n\n`;
  guidance += `### Deprecated Attributes (${migrationData.deprecated.length})\n\n`;
  guidance += `These attributes are removed in v2026-01-01 with no replacement:\n\n`;
  migrationData.deprecated.slice(0, 5).forEach((attr) => {
    guidance += `- ${attr}\n`;
  });
  if (migrationData.deprecated.length > 5) {
    guidance += `- ... and ${migrationData.deprecated.length - 5} more\n`;
  }
  guidance += `\n`;

  guidance += `### Not Supported Attributes (${migrationData.notSupported.length})\n\n`;
  guidance += `These attributes are not available in v2026-01-01:\n\n`;
  migrationData.notSupported.slice(0, 5).forEach((attr) => {
    guidance += `- ${attr}\n`;
  });
  if (migrationData.notSupported.length > 5) {
    guidance += `- ... and ${migrationData.notSupported.length - 5} more\n`;
  }
  guidance += `\n`;

  // New Features
  guidance += `## 🆕 New Features in v2026-01-01\n\n`;
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
  guidance += `**v2026-01-01:**\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `if (order.programs?.includes('PRIME')) {\n`;
  guidance += `  // handle prime order\n`;
  guidance += `}\n`;
  guidance += `\`\`\`\n\n`;

  guidance += `### Getting Order Status\n\n`;
  guidance += `**V0:**\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `const status = order.OrderStatus; // e.g., "Shipped"\n`;
  guidance += `\`\`\`\n\n`;
  guidance += `**v2026-01-01:**\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `const status = order.fulfillment.fulfillmentStatus; // e.g., "SHIPPED"\n`;
  guidance += `\`\`\`\n\n`;

  guidance += `### Checking Fulfillment Channel\n\n`;
  guidance += `**V0:**\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `if (order.FulfillmentChannel === 'AFN') {\n`;
  guidance += `  // Amazon fulfilled\n`;
  guidance += `}\n`;
  guidance += `\`\`\`\n\n`;
  guidance += `**v2026-01-01:**\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `if (order.fulfillment.fulfilledBy === 'AMAZON') {\n`;
  guidance += `  // Amazon fulfilled\n`;
  guidance += `}\n`;
  guidance += `\`\`\`\n\n`;

  guidance += `### Search Orders with includedData (v2026-01-01)\n\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `const response = await fetch(\n`;
  guidance += `  'https://sellingpartnerapi-na.amazon.com/orders/2026-01-01/orders?' +\n`;
  guidance += `  new URLSearchParams({\n`;
  guidance += `    createdAfter: '2025-12-01T00:00:00.000Z',\n`;
  guidance += `    marketplaceIds: 'ATVPDKIKX0DER',\n`;
  guidance += `    includedData: 'BUYER,RECIPIENT,FULFILLMENT,PACKAGES'\n`;
  guidance += `  }),\n`;
  guidance += `  {\n`;
  guidance += `    headers: { 'x-amz-access-token': accessToken }\n`;
  guidance += `  }\n`;
  guidance += `);\n`;
  guidance += `\`\`\`\n\n`;

  guidance += `### Accessing Package Tracking (v2026-01-01 New Feature)\n\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `// Request packages data\n`;
  guidance += `const order = await getOrder(orderId, { includedData: ['PACKAGES'] });\n\n`;
  guidance += `// Access package tracking info\n`;
  guidance += `order.packages?.forEach(pkg => {\n`;
  guidance += `  console.log('Carrier:', pkg.carrier);\n`;
  guidance += `  console.log('Tracking:', pkg.trackingNumber);\n`;
  guidance += `  console.log('Status:', pkg.packageStatus.status);\n`;
  guidance += `});\n`;
  guidance += `\`\`\`\n\n`;

  // Migration Checklist
  guidance += `## ✅ Migration Checklist\n\n`;
  guidance += `- [ ] Review API method availability (some require V0)\n`;
  guidance += `- [ ] Update attribute references to new nested structure\n`;
  guidance += `- [ ] Replace boolean flags with programs array checks\n`;
  guidance += `- [ ] Update status value comparisons (e.g., "Shipped" → "SHIPPED")\n`;
  guidance += `- [ ] Update fulfillment channel values (MFN → MERCHANT, AFN → AMAZON)\n`;
  guidance += `- [ ] Update query parameters to camelCase format\n`;
  guidance += `- [ ] Handle pagination token changes (NextToken → paginationToken, 24h expiry)\n`;
  guidance += `- [ ] Add \`includedData\` parameter for additional data\n`;
  guidance += `- [ ] Update endpoint URLs from \`/orders/v0/\` to \`/orders/2026-01-01/\`\n`;
  guidance += `- [ ] Update timestamp parsing for millisecond precision\n`;
  guidance += `- [ ] Implement package tracking for FBM orders if needed\n`;
  guidance += `- [ ] Update error handling for new response formats\n`;
  guidance += `- [ ] Test with sandbox environment\n`;
  guidance += `- [ ] Update TypeScript types/interfaces\n`;
  guidance += `- [ ] Plan V0 fallback for unsupported operations\n\n`;

  // Resources
  guidance += `## 📚 Resources\n\n`;
  guidance += `- [SP-API Orders v2026-01-01 Documentation](https://developer-docs.amazon.com/sp-api/docs/orders-api-v1-reference)\n`;
  guidance += `- [Migration Guide](https://developer-docs.amazon.com/sp-api/docs/orders-api-v0-to-v1-migration-guide)\n`;
  guidance += `- [SP-API Developer Guide](https://developer-docs.amazon.com/sp-api/)\n\n`;

  guidance += `## 🔍 Need More Help?\n\n`;
  guidance += `- **Code Analysis:** Provide your source code for detailed analysis and automated refactoring\n`;
  guidance += `- **Specific Attributes:** Ask about specific V0 attributes for detailed mapping\n`;
  guidance += `- **API Methods:** Ask about specific V0 API methods for migration guidance\n`;

  return guidance;
}
