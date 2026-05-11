import { OutboundMigrationData } from "./migration-data.js";

export function formatOutboundGeneralGuidance(
  migrationData: OutboundMigrationData,
): string {
  let guidance = `# 🔄 Fulfillment Outbound API Migration Guide: v2020-07-01 → v2025-09-24\n\n`;

  guidance += `## 📋 Overview\n\n`;
  guidance += `This guide helps you migrate from Fulfillment Outbound API v2020-07-01 to v2025-09-24.\n`;
  guidance += `The new version introduces a modern scalable interface with new capabilities including `;
  guidance += `partner account credentials, channel-based feature configuration, and enhanced notifications.\n\n`;

  guidance += `**Key Changes:**\n`;
  guidance += `- Base path changed: \`/fba/outbound/2020-07-01\` → \`/fulfillment/outbound/2025-09-24\`\n`;
  guidance += `- New \`x-amzn-fulfillment-service-id\` header for multi-site API scoping\n`;
  guidance += `- Operation renames (e.g., createFulfillmentOrder → createOrder)\n`;
  guidance += `- All enum values standardized to SCREAMING_SNAKE_CASE\n`;
  guidance += `- Response objects no longer wrapped in \`payload\` structure\n`;
  guidance += `- getPackageTrackingDetails moved to Amazon Tracking API\n`;
  guidance += `- getFeatures/getFeatureSKU/getFeatureInventory deprecated\n`;
  guidance += `- createFulfillmentReturn/listReturnReasonCodes deprecated\n`;
  guidance += `- New FULFILLMENT_ORDER_STATUS notification with package-level updates\n`;
  guidance += `- Webhook subscription support and CEL-based event filtering\n\n`;

  // Migration Benefits
  guidance += `## 🎯 Migration Benefits\n\n`;
  migrationData.migrationBenefits.forEach((benefit) => {
    guidance += `- ${benefit}\n`;
  });
  guidance += `\n`;

  // API Availability
  guidance += `## 🔌 API Method Mapping\n\n`;
  guidance += `### ✅ Available in v2025-09-24:\n\n`;
  Object.entries(migrationData.apiMappings).forEach(([v0Method, mapping]) => {
    if (mapping.status.includes("✅")) {
      guidance += `- **${v0Method}** → \`${mapping.v1}\`\n`;
      guidance += `  ${mapping.notes}\n\n`;
    }
  });

  guidance += `### ❌ NOT Available in v2025-09-24:\n\n`;
  Object.entries(migrationData.apiMappings).forEach(([v0Method, mapping]) => {
    if (mapping.status.includes("❌")) {
      guidance += `- **${v0Method}** → ${mapping.v1}\n`;
      guidance += `  ${mapping.notes}\n\n`;
    }
  });

  // Delivery Service Level Mappings
  guidance += `## 🚚 Delivery Service Level Mappings\n\n`;
  guidance += `\`shippingSpeedCategory\` is renamed to \`deliveryServiceLevel\` with uppercase values:\n\n`;
  Object.entries(migrationData.deliveryServiceLevelMappings).forEach(
    ([v0, v1]) => {
      guidance += `- \`"${v0}"\` → \`"${v1}"\`\n`;
    },
  );
  guidance += `\n`;

  // Fulfillment Action & Policy Mappings
  guidance += `## ⚙️ Fulfillment Action & Policy Mappings\n\n`;
  guidance += `**fulfillmentAction** (same field name, new enum values):\n\n`;
  Object.entries(migrationData.fulfillmentActionMappings).forEach(
    ([v0, v1]) => {
      guidance += `- \`"${v0}"\` → \`"${v1}"\`\n`;
    },
  );
  guidance += `\n**fulfillmentPolicy** (same field name, new enum values):\n\n`;
  Object.entries(migrationData.fulfillmentPolicyMappings).forEach(
    ([v0, v1]) => {
      guidance += `- \`"${v0}"\` → \`"${v1}"\`\n`;
    },
  );
  guidance += `\n`;

  // Status Mappings
  guidance += `## 🔄 Status Value Mappings\n\n`;
  guidance += `### Fulfillment Order Status:\n\n`;
  Object.entries(migrationData.statusMappings.fulfillmentOrderStatus).forEach(
    ([v0, v1]) => {
      guidance += `- \`"${v0}"\` → \`"${v1}"\`\n`;
    },
  );
  guidance += `\n### Shipment Status:\n\n`;
  Object.entries(migrationData.statusMappings.shipmentStatus).forEach(
    ([v0, v1]) => {
      guidance += `- \`"${v0}"\` → \`"${v1}"\`\n`;
    },
  );
  guidance += `\n### Package Status (New in v2025-09-24):\n\n`;
  Object.entries(migrationData.statusMappings.packageStatus).forEach(
    ([, v1]) => {
      guidance += `- \`"${v1}"\`\n`;
    },
  );
  guidance += `\n`;

  // Request Body Changes
  guidance += `## 📝 Request Body Changes\n\n`;
  Object.entries(migrationData.requestBodyChanges).forEach(([api, changes]) => {
    guidance += `### ${api}\n\n`;

    if (changes.removed.length > 0) {
      guidance += `**Removed fields:**\n`;
      changes.removed.forEach((field) => {
        guidance += `- ❌ \`${field}\`\n`;
      });
      guidance += `\n`;
    }

    if (Object.keys(changes.renamed).length > 0) {
      guidance += `**Renamed fields:**\n`;
      Object.entries(changes.renamed).forEach(([oldName, newName]) => {
        guidance += `- \`${oldName}\` → \`${newName}\`\n`;
      });
      guidance += `\n`;
    }

    if (changes.added.length > 0) {
      guidance += `**New fields:**\n`;
      changes.added.forEach((field) => {
        guidance += `- ✨ \`${field}\`\n`;
      });
      guidance += `\n`;
    }

    if (changes.enumChanges && Object.keys(changes.enumChanges).length > 0) {
      guidance += `**Enum value changes:**\n`;
      Object.entries(changes.enumChanges).forEach(([field, mapping]) => {
        guidance += `- \`${field}\`: ${mapping}\n`;
      });
      guidance += `\n`;
    }
  });

  // Response Changes
  guidance += `## 📤 Response Structure Changes\n\n`;
  guidance += `**Key structural change:** All responses remove the \`payload\` wrapper. Access data directly.\n\n`;
  Object.entries(migrationData.responseChanges).forEach(([api, changes]) => {
    guidance += `### ${api}\n\n`;
    if (changes.structureChanges.length > 0) {
      changes.structureChanges.forEach((change) => {
        guidance += `- ${change}\n`;
      });
      guidance += `\n`;
    }
    if (Object.keys(changes.renamed).length > 0) {
      guidance += `Field renames:\n`;
      Object.entries(changes.renamed).forEach(([oldName, newName]) => {
        guidance += `- \`${oldName}\` → \`${newName}\`\n`;
      });
      guidance += `\n`;
    }
  });

  // Authorization
  guidance += `## 🔐 Authorization\n\n`;
  guidance += `If your application uses a single authorization token for multi-site APIs, include the `;
  guidance += `\`x-amzn-fulfillment-service-id\` header in all non-tenancy API requests.\n\n`;
  guidance += `This header is **optional** if your app uses a regular authorization token scoped to a single merchant account.\n\n`;
  guidance += `\`\`\`\n`;
  guidance += `x-amzn-fulfillment-service-id: FS01-o8vlfw8b1tiu1\n`;
  guidance += `x-amz-access-token: Atza|IwEBIPmyMZBjeTaN...\n`;
  guidance += `\`\`\`\n\n`;

  // Tenancy Operations
  guidance += `## 🏢 New Tenancy Operations\n\n`;
  guidance += `${migrationData.tenancyOperations.description}\n\n`;
  Object.entries(migrationData.tenancyOperations.operations).forEach(
    ([name, op]) => {
      guidance += `- **${name}**: \`${op.endpoint}\`\n`;
      guidance += `  ${op.description}\n\n`;
    },
  );

  // Notifications
  guidance += `## 🔔 Enhanced Notifications\n\n`;
  guidance += `${migrationData.notifications.description}\n\n`;
  guidance += `**Event Types:**\n\n`;
  Object.entries(migrationData.notifications.eventTypes).forEach(
    ([eventType, info]) => {
      guidance += `- **${eventType}**: ${info.description}\n`;
      guidance += `  Statuses: ${info.statuses.join(", ")}\n\n`;
    },
  );
  guidance += `**Webhook support:** ${migrationData.notifications.webhookSupport ? "Yes" : "No"}\n`;
  guidance += `**CEL filter expressions:** ${migrationData.notifications.sbqFilterSupport ? "Yes" : "No"}\n\n`;

  // Code Examples
  guidance += `## 💻 Code Examples\n\n`;

  guidance += `### Creating a Fulfillment Order\n\n`;
  guidance += `**v2020-07-01:**\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `POST /fba/outbound/2020-07-01/fulfillmentOrders\n\n`;
  guidance += `{\n`;
  guidance += `  "sellerFulfillmentOrderId": "ABC123",\n`;
  guidance += `  "shippingSpeedCategory": "Standard",\n`;
  guidance += `  "fulfillmentAction": "Ship",\n`;
  guidance += `  "fulfillmentPolicy": "FillAllAvailable",\n`;
  guidance += `  "destinationAddress": {\n`;
  guidance += `    "name": "Recipient Name",\n`;
  guidance += `    "addressLine1": "1000 Winthrop Ave N",\n`;
  guidance += `    "city": "Seattle",\n`;
  guidance += `    "stateOrRegion": "WA",\n`;
  guidance += `    "postalCode": "98103",\n`;
  guidance += `    "countryCode": "US"\n`;
  guidance += `  },\n`;
  guidance += `  "marketplaceId": "ATVPDKIKX0DER",\n`;
  guidance += `  "items": [{\n`;
  guidance += `    "sellerFulfillmentOrderItemId": "item1",\n`;
  guidance += `    "sellerSKU": "SKU1",\n`;
  guidance += `    "quantity": 2\n`;
  guidance += `  }],\n`;
  guidance += `  "featureConstraints": [{\n`;
  guidance += `    "featureName": "BLANK_BOX",\n`;
  guidance += `    "featureFulfillmentPolicy": "Required"\n`;
  guidance += `  }]\n`;
  guidance += `}\n`;
  guidance += `\`\`\`\n\n`;

  guidance += `**v2025-09-24:**\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `POST /fulfillment/outbound/2025-09-24/orders\n\n`;
  guidance += `{\n`;
  guidance += `  "orderId": "ABC123",\n`;
  guidance += `  "deliveryServiceLevel": "STANDARD",\n`;
  guidance += `  "fulfillmentAction": "SHIP",\n`;
  guidance += `  "fulfillmentPolicy": "FILL_ALL_AVAILABLE",\n`;
  guidance += `  "destination": {\n`;
  guidance += `    "deliveryAddress": {\n`;
  guidance += `      "name": "Recipient Name",\n`;
  guidance += `      "addressLine1": "1000 Winthrop Ave N",\n`;
  guidance += `      "city": "Seattle",\n`;
  guidance += `      "stateOrRegion": "WA",\n`;
  guidance += `      "postalCode": "98103",\n`;
  guidance += `      "countryCode": "US"\n`;
  guidance += `    }\n`;
  guidance += `  },\n`;
  guidance += `  "origin": { "countryCode": "US" },\n`;
  guidance += `  "lineItems": [{\n`;
  guidance += `    "lineItemId": "item1",\n`;
  guidance += `    "product": {\n`;
  guidance += `      "productIdentifier": { "amazonSku": "SKU1" }\n`;
  guidance += `    },\n`;
  guidance += `    "amount": { "unitOfMeasure": "EACHES", "value": "2.0" }\n`;
  guidance += `  }],\n`;
  guidance += `  "services": {\n`;
  guidance += `    "packaging": { "blankBox": "REQUIRED" }\n`;
  guidance += `  }\n`;
  guidance += `}\n`;
  guidance += `\`\`\`\n\n`;

  guidance += `### Getting a Fulfillment Order\n\n`;
  guidance += `**v2020-07-01:**\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `const response = await getFulfillmentOrder(orderId);\n`;
  guidance += `const status = response.payload.fulfillmentOrder.fulfillmentOrderStatus;\n`;
  guidance += `const items = response.payload.fulfillmentOrderItems;\n`;
  guidance += `const shipments = response.payload.fulfillmentShipments;\n`;
  guidance += `\`\`\`\n\n`;
  guidance += `**v2025-09-24:**\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `const response = await getOrder(orderId);\n`;
  guidance += `const status = response.fulfillmentOrder.status; // No payload wrapper\n`;
  guidance += `const items = response.fulfillmentOrder.lineItems; // Nested in order\n`;
  guidance += `const shipments = response.fulfillmentOrder.shipments; // Nested in order\n`;
  guidance += `\`\`\`\n\n`;

  guidance += `### Webhook Subscription for Notifications\n\n`;
  guidance += `\`\`\`javascript\n`;
  guidance += `// 1. Create webhook destination\n`;
  guidance += `POST /notifications/v1/destinations\n`;
  guidance += `{\n`;
  guidance += `  "name": "mcf-tracking-webhook",\n`;
  guidance += `  "resourceSpecification": {\n`;
  guidance += `    "webhook": {\n`;
  guidance += `      "url": "https://mydomain.com/mcf-events",\n`;
  guidance += `      "signatureType": "RSA"\n`;
  guidance += `    }\n`;
  guidance += `  }\n`;
  guidance += `}\n\n`;
  guidance += `// 2. Subscribe to FULFILLMENT_ORDER_STATUS\n`;
  guidance += `POST /notifications/v1/subscriptions/FULFILLMENT_ORDER_STATUS\n`;
  guidance += `{\n`;
  guidance += `  "payloadVersion": "2025-09-24",\n`;
  guidance += `  "destinationId": "WEBHOOK_DESTINATION_ID"\n`;
  guidance += `}\n`;
  guidance += `\`\`\`\n\n`;

  // Migration Checklist
  guidance += `## ✅ Migration Checklist\n\n`;
  guidance += `- [ ] Update base path: \`/fba/outbound/2020-07-01\` → \`/fulfillment/outbound/2025-09-24\`\n`;
  guidance += `- [ ] Rename API operations (createFulfillmentOrder → createOrder, etc.)\n`;
  guidance += `- [ ] Update endpoint paths (/fulfillmentOrders → /orders, /fulfillmentOrders/preview → /previews)\n`;
  guidance += `- [ ] Update enum values to SCREAMING_SNAKE_CASE\n`;
  guidance += `- [ ] Rename request body fields (sellerFulfillmentOrderId → orderId, items → lineItems, etc.)\n`;
  guidance += `- [ ] Replace marketplaceId with origin.countryCode\n`;
  guidance += `- [ ] Update response parsing to remove payload wrapper\n`;
  guidance += `- [ ] Update status field names (fulfillmentOrderStatus → status)\n`;
  guidance += `- [ ] Handle pagination changes (nextToken → pageToken)\n`;
  guidance += `- [ ] Add x-amzn-fulfillment-service-id header if using multi-site APIs\n`;
  guidance += `- [ ] Replace getFeatureInventory with getOrderPreview for fulfillability checks\n`;
  guidance += `- [ ] Migrate getPackageTrackingDetails to Amazon Tracking API (or keep v2020-07-01)\n`;
  guidance += `- [ ] Handle deprecated return operations (keep v2020-07-01 for returns)\n`;
  guidance += `- [ ] Consider webhook notifications instead of polling\n`;
  guidance += `- [ ] Test with sandbox environment (new status simulation milestones)\n`;
  guidance += `- [ ] Update TypeScript types/interfaces\n\n`;

  // Resources
  guidance += `## 📚 Resources\n\n`;
  guidance += `- [SP-API Fulfillment Outbound v2025-09-24 Documentation](https://developer-docs.amazon.com/sp-api/docs/fulfillment-outbound-api-v2025-reference)\n`;
  guidance += `- [MCF API Developer Guide](https://developer-docs.amazon.com/sp-api/docs/mcf-api-developer-guide)\n`;
  guidance += `- [SP-API Developer Guide](https://developer-docs.amazon.com/sp-api/)\n\n`;

  guidance += `## 🔍 Need More Help?\n\n`;
  guidance += `- **Code Analysis:** Provide your source code for detailed analysis and automated refactoring\n`;
  guidance += `- **Specific Attributes:** Ask about specific v2020-07-01 attributes for detailed mapping\n`;
  guidance += `- **API Methods:** Ask about specific API methods for migration guidance\n`;

  return guidance;
}
