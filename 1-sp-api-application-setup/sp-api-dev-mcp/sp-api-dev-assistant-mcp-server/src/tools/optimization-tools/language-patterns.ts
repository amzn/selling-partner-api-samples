import type { PatternDefinition } from "./types.js";

/** SP-API endpoint URL patterns by language */
export const apiCallPatterns: Record<string, PatternDefinition[]> = {
  agnostic: [
    {
      pattern: /sellingpartnerapi[\w-]*\.amazon\.com/i,
      description: "SP-API base URL",
    },
    {
      pattern:
        /\/(?:orders|catalog|listings|feeds|reports|notifications|fba|pricing|inventory)\//i,
      description: "SP-API path segment",
    },
  ],
  javascript: [
    {
      pattern:
        /(?:axios|fetch|got|request)\s*(?:\.\s*(?:get|post|put|delete|patch))?\s*\(/i,
      description: "HTTP client call",
    },
    {
      pattern:
        /new\s+(?:OrdersV0Api|OrdersSpApi|SellersSpApi|CatalogItemsApi)/i,
      description: "SP-API SDK class",
    },
  ],
  typescript: [
    {
      pattern:
        /(?:axios|fetch|got)\s*(?:\.\s*(?:get|post|put|delete|patch))?\s*\(/i,
      description: "HTTP client call",
    },
    {
      pattern:
        /new\s+(?:OrdersV0Api|OrdersSpApi|SellersSpApi|CatalogItemsApi)/i,
      description: "SP-API SDK class",
    },
  ],
  python: [
    {
      pattern: /requests\s*\.\s*(?:get|post|put|delete|patch)\s*\(/i,
      description: "requests library call",
    },
    {
      pattern: /(?:urllib|httpx|aiohttp)/i,
      description: "Python HTTP library",
    },
  ],
  java: [
    {
      pattern: /HttpClient|HttpRequest|HttpResponse/i,
      description: "Java HTTP client",
    },
    { pattern: /new\s+ApiClient\s*\(/i, description: "SP-API Java SDK" },
  ],
};

/** Polling patterns — used by notification and scheduling strategies */
export const pollingPatterns: PatternDefinition[] = [
  { pattern: /setInterval\s*\(/i, description: "setInterval polling (JS/PHP)" },
  { pattern: /setTimeout\s*\(/i, description: "setTimeout polling (JS/PHP)" },
  {
    pattern: /while\s*\(\s*true\s*\)/i,
    description: "infinite while loop (JS/Java/C#/PHP)",
  },
  { pattern: /while\s+True\s*:/i, description: "infinite while loop (Python)" },
  {
    pattern: /schedule\s*\.\s*(?:every|cron|interval)/i,
    description: "scheduler pattern",
  },
  { pattern: /time\s*\.\s*sleep\s*\(/i, description: "time.sleep (Python)" },
  {
    pattern: /asyncio\s*\.\s*sleep\s*\(/i,
    description: "asyncio.sleep (Python)",
  },
  { pattern: /Thread\s*\.\s*sleep\s*\(/i, description: "Thread.sleep (Java)" },
  { pattern: /Thread\s*\.\s*Sleep\s*\(/i, description: "Thread.Sleep (C#)" },
  { pattern: /Task\s*\.\s*Delay\s*\(/i, description: "Task.Delay (C#)" },
  {
    pattern: /scheduleAtFixedRate\s*\(/i,
    description: "ScheduledExecutorService (Java)",
  },
  { pattern: /Timer\s*\(\s*\)/i, description: "Timer (Java/C#)" },
];

/** Error handling patterns */
export const errorHandlingPatterns: PatternDefinition[] = [
  { pattern: /try\s*\{/i, description: "try block (JS/Java/C#/PHP)" },
  { pattern: /try\s*:/i, description: "try block (Python)" },
  { pattern: /\.catch\s*\(/i, description: ".catch() handler (JS)" },
  { pattern: /catch\s*\(/i, description: "catch clause (JS/Java/C#/PHP)" },
  { pattern: /except\s+/i, description: "except clause (Python)" },
  {
    pattern: /\.on\s*\(\s*['"]error['"]/i,
    description: "error event handler (JS)",
  },
];

/** Retry / backoff patterns */
export const retryPatterns: PatternDefinition[] = [
  { pattern: /retry/i, description: "retry keyword" },
  { pattern: /backoff/i, description: "backoff keyword" },
  { pattern: /exponential/i, description: "exponential backoff" },
  {
    pattern: /maxRetries|max_retries|retryCount|retry_count/i,
    description: "retry config",
  },
];

/** Rate limit detection patterns */
export const rateLimitPatterns: PatternDefinition[] = [
  { pattern: /429/i, description: "429 status code check" },
  { pattern: /too\s*many\s*requests/i, description: "Too Many Requests text" },
  { pattern: /rate[\s_-]*limit/i, description: "rate limit keyword" },
  { pattern: /throttl/i, description: "throttle keyword" },
  { pattern: /x-amzn-ratelimit/i, description: "SP-API rate limit header" },
];

/** Batch mapping: individual operation → batch equivalent */
export const batchMappings: Array<{
  individual: string;
  batch: string;
  apiSection: string;
}> = [
  {
    individual: "getCatalogItem",
    batch: "searchCatalogItems",
    apiSection: "Catalog",
  },
  {
    individual: "getListingsItem",
    batch: "searchListingsItems",
    apiSection: "Listings",
  },
  {
    individual: "getInboundPlan",
    batch: "listInboundPlans",
    apiSection: "FBA Inbound",
  },
  {
    individual: "getListingsRestrictions",
    batch: "getListingsRestrictions with multiple marketplaceIds",
    apiSection: "Listings Restrictions",
  },
];

/** Report alternatives: GET operations replaceable by reports */
export const reportAlternatives: Array<{
  reportType: string;
  replacesOperations: string[];
  apiSection: string;
  description: string;
}> = [
  {
    reportType: "GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL",
    replacesOperations: ["getOrders", "getOrder", "getOrderItems"],
    apiSection: "Orders",
    description:
      "Use the All Orders report for bulk order data retrieval instead of individual API calls",
  },
  {
    reportType: "GET_MERCHANT_LISTINGS_ALL_DATA",
    replacesOperations: ["getListingsItem", "getCatalogItem"],
    apiSection: "Listings",
    description: "Use the Merchant Listings report for bulk listing data",
  },
  {
    reportType: "GET_FBA_MYI_ALL_INVENTORY_DATA",
    replacesOperations: ["getInventorySummaries"],
    apiSection: "Inventory",
    description: "Use the FBA Inventory report for bulk inventory data",
  },
  {
    reportType: "GET_FBA_FULFILLMENT_INBOUND_NONCOMPLIANCE_DATA",
    replacesOperations: ["listInboundPlans", "getInboundPlan"],
    apiSection: "FBA Inbound",
    description:
      "Use FBA Inbound reports for bulk shipment compliance data instead of individual API calls",
  },
];

/** Notification types available for push-based architecture */
export const notificationTypes: Array<{
  type: string;
  apiSection: string;
  description: string;
}> = [
  {
    type: "ORDER_CHANGE",
    apiSection: "Orders",
    description:
      "Subscribe to ORDER_CHANGE notifications instead of polling for order status",
  },
  {
    type: "LISTINGS_ITEM_STATUS_CHANGE",
    apiSection: "Listings",
    description: "Subscribe to listing status change notifications",
  },
  {
    type: "PRICING_HEALTH",
    apiSection: "Pricing",
    description: "Subscribe to pricing health notifications",
  },
  {
    type: "FBA_INVENTORY_AVAILABILITY_CHANGES",
    apiSection: "Inventory",
    description: "Subscribe to FBA inventory change notifications",
  },
  {
    type: "FEED_PROCESSING_FINISHED",
    apiSection: "Feeds",
    description: "Subscribe to feed processing completion notifications",
  },
  {
    type: "REPORT_PROCESSING_FINISHED",
    apiSection: "Reports",
    description: "Subscribe to report processing completion notifications",
  },
  {
    type: "TRANSACTION_UPDATE",
    apiSection: "Finances",
    description:
      "Subscribe to TRANSACTION_UPDATE notifications instead of polling for new transactions",
  },
];

/** Deprecated API patterns for API Modernness detection */
export interface DeprecatedApiPattern {
  pattern: RegExp;
  apiName: string;
  apiSection: string;
  deprecatedVersion: string;
  modernVersion: string;
  deprecationDate: string;
  removalDate: string;
  migrationGuide: string;
  description: string;
}

export const deprecatedApiPatterns: DeprecatedApiPattern[] = [
  // Orders API v0 - deprecated, migrate to v2026-01-01
  {
    pattern: /\bOrdersV0Api\b/gi,
    apiName: "Orders API v0 SDK Class",
    apiSection: "Orders",
    deprecatedVersion: "v0",
    modernVersion: "v2026-01-01",
    deprecationDate: "2026-01-28",
    removalDate: "2027-03-27",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/orders-api-migration-guide",
    description:
      "Orders API v0 is deprecated. Migrate to v2026-01-01 for consolidated endpoints and simplified PII access.",
  },
  {
    pattern: /\/orders\/v0\//gi,
    apiName: "Orders API v0 Endpoint",
    apiSection: "Orders",
    deprecatedVersion: "v0",
    modernVersion: "v2026-01-01",
    deprecationDate: "2026-01-28",
    removalDate: "2027-03-27",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/orders-api-migration-guide",
    description:
      "Orders API v0 endpoints are deprecated. Use /orders/2026-01-01/ endpoints instead.",
  },
  {
    pattern: /\bgetOrderBuyerInfo\b/gi,
    apiName: "getOrderBuyerInfo",
    apiSection: "Orders",
    deprecatedVersion: "v0",
    modernVersion: "v2026-01-01",
    deprecationDate: "2026-01-28",
    removalDate: "2027-03-27",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/orders-api-migration-guide",
    description:
      "Use getOrder with includedData=['BUYER'] instead of separate getOrderBuyerInfo call.",
  },
  {
    pattern: /\bgetOrderAddress\b/gi,
    apiName: "getOrderAddress",
    apiSection: "Orders",
    deprecatedVersion: "v0",
    modernVersion: "v2026-01-01",
    deprecationDate: "2026-01-28",
    removalDate: "2027-03-27",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/orders-api-migration-guide",
    description:
      "Use getOrder with includedData=['RECIPIENT'] instead of separate getOrderAddress call.",
  },
  {
    pattern: /\bgetOrderItemsBuyerInfo\b/gi,
    apiName: "getOrderItemsBuyerInfo",
    apiSection: "Orders",
    deprecatedVersion: "v0",
    modernVersion: "v2026-01-01",
    deprecationDate: "2026-01-28",
    removalDate: "2027-03-27",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/orders-api-migration-guide",
    description:
      "Use getOrder with includedData=['BUYER'] which returns buyer info and order items together in a single request.",
  },
  {
    pattern: /\bgetOrders\b/gi,
    apiName: "getOrders (v0)",
    apiSection: "Orders",
    deprecatedVersion: "v0",
    modernVersion: "v2026-01-01",
    deprecationDate: "2026-01-28",
    removalDate: "2027-03-27",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/orders-api-migration-guide",
    description:
      "Use searchOrders from Orders API v2026-01-01 instead of getOrders.",
  },
  {
    pattern: /\bgetOrder\b(?!\w)/gi,
    apiName: "getOrder (v0)",
    apiSection: "Orders",
    deprecatedVersion: "v0",
    modernVersion: "v2026-01-01",
    deprecationDate: "2026-01-28",
    removalDate: "2027-03-27",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/orders-api-migration-guide",
    description:
      "Use getOrder from Orders API v2026-01-01 which returns complete order and item information in a single request.",
  },
  {
    pattern: /\bgetOrderItems\b/gi,
    apiName: "getOrderItems (v0)",
    apiSection: "Orders",
    deprecatedVersion: "v0",
    modernVersion: "v2026-01-01",
    deprecationDate: "2026-01-28",
    removalDate: "2027-03-27",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/orders-api-migration-guide",
    description:
      "Use getOrder from Orders API v2026-01-01 which includes order items by default.",
  },
  // Catalog Items API v0 - deprecated, removed April 2025
  {
    pattern: /\bCatalogItemsV0Api\b/gi,
    apiName: "Catalog Items API v0 SDK Class",
    apiSection: "Catalog",
    deprecatedVersion: "v0",
    modernVersion: "v2022-04-01",
    deprecationDate: "2022-09-30",
    removalDate: "2025-04-24",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/catalog-items-api-v2022-04-01-migration-guide",
    description:
      "Catalog Items API v0 is deprecated. Migrate to v2022-04-01 before April 24, 2025.",
  },
  {
    pattern: /\/catalog\/v0\//gi,
    apiName: "Catalog Items API v0 Endpoint",
    apiSection: "Catalog",
    deprecatedVersion: "v0",
    modernVersion: "v2022-04-01",
    deprecationDate: "2022-09-30",
    removalDate: "2025-04-24",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/catalog-items-api-v2022-04-01-migration-guide",
    description:
      "Catalog Items API v0 endpoints are deprecated. Use /catalog/2022-04-01/ endpoints.",
  },
  {
    pattern: /\blistCatalogItems\b/gi,
    apiName: "listCatalogItems (v0)",
    apiSection: "Catalog",
    deprecatedVersion: "v0",
    modernVersion: "v2022-04-01",
    deprecationDate: "2022-09-30",
    removalDate: "2025-04-24",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/catalog-items-api-v2022-04-01-migration-guide",
    description:
      "Use searchCatalogItems from Catalog Items API v2022-04-01 instead.",
  },
  {
    pattern: /\blistCatalogCategories\b/gi,
    apiName: "listCatalogCategories (v0)",
    apiSection: "Catalog",
    deprecatedVersion: "v0",
    modernVersion: "v2022-04-01",
    deprecationDate: "2025-05-21",
    removalDate: "2026-03-31",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/catalog-items-api-v2022-04-01-migration-guide",
    description:
      "listCatalogCategories is deprecated. Use getCatalogItem with includedData=classifications from Catalog Items API v2022-04-01.",
  },
  // Fulfillment Inbound API v0 - deprecated, removed January 2025
  {
    pattern: /\bFulfillmentInboundV0Api\b/gi,
    apiName: "Fulfillment Inbound API v0 SDK Class",
    apiSection: "FBA Inbound",
    deprecatedVersion: "v0",
    modernVersion: "v2024-03-20",
    deprecationDate: "2024-04-01",
    removalDate: "2025-01-21",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide",
    description:
      "Fulfillment Inbound API v0 has been removed. Migrate to v2024-03-20 immediately.",
  },
  {
    pattern: /\/fba\/inbound\/v0\//gi,
    apiName: "Fulfillment Inbound API v0 Endpoint",
    apiSection: "FBA Inbound",
    deprecatedVersion: "v0",
    modernVersion: "v2024-03-20",
    deprecationDate: "2024-04-01",
    removalDate: "2025-01-21",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide",
    description:
      "Fulfillment Inbound API v0 endpoints have been removed. Use /inbound/fba/2024-03-20/ endpoints.",
  },
  {
    pattern: /\bcreateInboundShipmentPlan\b/gi,
    apiName: "createInboundShipmentPlan (v0)",
    apiSection: "FBA Inbound",
    deprecatedVersion: "v0",
    modernVersion: "v2024-03-20",
    deprecationDate: "2024-04-01",
    removalDate: "2025-01-21",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide",
    description:
      "Use createInboundPlan from Fulfillment Inbound API v2024-03-20 instead.",
  },
  {
    pattern: /\bcreateInboundShipment\b/gi,
    apiName: "createInboundShipment (v0)",
    apiSection: "FBA Inbound",
    deprecatedVersion: "v0",
    modernVersion: "v2024-03-20",
    deprecationDate: "2024-04-01",
    removalDate: "2025-01-21",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide",
    description:
      "Use the new inbound plan workflow from Fulfillment Inbound API v2024-03-20.",
  },
  {
    pattern: /\bupdateInboundShipment\b/gi,
    apiName: "updateInboundShipment (v0)",
    apiSection: "FBA Inbound",
    deprecatedVersion: "v0",
    modernVersion: "v2024-03-20",
    deprecationDate: "2024-04-01",
    removalDate: "2025-01-21",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide",
    description:
      "Use the new inbound plan workflow from Fulfillment Inbound API v2024-03-20.",
  },
  {
    pattern: /\bgetTransportDetails\b/gi,
    apiName: "getTransportDetails (v0)",
    apiSection: "FBA Inbound",
    deprecatedVersion: "v0",
    modernVersion: "v2024-03-20",
    deprecationDate: "2024-04-01",
    removalDate: "2025-01-21",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide",
    description:
      "Use getTransportationOptions from Fulfillment Inbound API v2024-03-20.",
  },
  {
    pattern: /\bputTransportDetails\b/gi,
    apiName: "putTransportDetails (v0)",
    apiSection: "FBA Inbound",
    deprecatedVersion: "v0",
    modernVersion: "v2024-03-20",
    deprecationDate: "2024-04-01",
    removalDate: "2025-01-21",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide",
    description:
      "Use generateTransportationOptions from Fulfillment Inbound API v2024-03-20.",
  },
  {
    pattern: /\bconfirmPreorder\b/gi,
    apiName: "confirmPreorder (v0)",
    apiSection: "FBA Inbound",
    deprecatedVersion: "v0",
    modernVersion: "v2024-03-20",
    deprecationDate: "2024-04-01",
    removalDate: "2025-01-21",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide",
    description:
      "Use the new inbound plan workflow from Fulfillment Inbound API v2024-03-20.",
  },
  {
    pattern: /\bconfirmTransport\b/gi,
    apiName: "confirmTransport (v0)",
    apiSection: "FBA Inbound",
    deprecatedVersion: "v0",
    modernVersion: "v2024-03-20",
    deprecationDate: "2024-04-01",
    removalDate: "2025-01-21",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide",
    description:
      "Use confirmTransportationOptions from Fulfillment Inbound API v2024-03-20.",
  },
  {
    pattern: /\bestimateTransport\b/gi,
    apiName: "estimateTransport (v0)",
    apiSection: "FBA Inbound",
    deprecatedVersion: "v0",
    modernVersion: "v2024-03-20",
    deprecationDate: "2024-04-01",
    removalDate: "2025-01-21",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide",
    description:
      "Use generateTransportationOptions from Fulfillment Inbound API v2024-03-20.",
  },
  {
    pattern: /\bgetPreorderInfo\b/gi,
    apiName: "getPreorderInfo (v0)",
    apiSection: "FBA Inbound",
    deprecatedVersion: "v0",
    modernVersion: "v2024-03-20",
    deprecationDate: "2024-04-01",
    removalDate: "2025-01-21",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide",
    description:
      "Use the new inbound plan workflow from Fulfillment Inbound API v2024-03-20.",
  },
  {
    pattern: /\bvoidTransport\b/gi,
    apiName: "voidTransport (v0)",
    apiSection: "FBA Inbound",
    deprecatedVersion: "v0",
    modernVersion: "v2024-03-20",
    deprecationDate: "2024-04-01",
    removalDate: "2025-01-21",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide",
    description:
      "Use cancelSelfShipAppointment from Fulfillment Inbound API v2024-03-20.",
  },
  // Deprecated Feed Types - migrate to Listings Items API or JSON_LISTINGS_FEED
  {
    pattern: /\b_?POST_PRODUCT_DATA_?\b/gi,
    apiName: "POST_PRODUCT_DATA Feed",
    apiSection: "Feeds",
    deprecatedVersion: "Legacy Feed",
    modernVersion: "Listings Items API / JSON_LISTINGS_FEED",
    deprecationDate: "2024-03-18",
    removalDate: "2025-12-03",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide",
    description:
      "Use Listings Items API or JSON_LISTINGS_FEED instead of POST_PRODUCT_DATA.",
  },
  {
    pattern: /\b_?POST_INVENTORY_AVAILABILITY_DATA_?\b/gi,
    apiName: "POST_INVENTORY_AVAILABILITY_DATA Feed",
    apiSection: "Feeds",
    deprecatedVersion: "Legacy Feed",
    modernVersion: "Listings Items API / JSON_LISTINGS_FEED",
    deprecationDate: "2024-03-18",
    removalDate: "2025-12-03",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide",
    description:
      "Use Listings Items API or JSON_LISTINGS_FEED instead of POST_INVENTORY_AVAILABILITY_DATA.",
  },
  {
    pattern: /\b_?POST_PRODUCT_PRICING_DATA_?\b/gi,
    apiName: "POST_PRODUCT_PRICING_DATA Feed",
    apiSection: "Feeds",
    deprecatedVersion: "Legacy Feed",
    modernVersion: "Listings Items API / JSON_LISTINGS_FEED",
    deprecationDate: "2024-03-18",
    removalDate: "2025-12-03",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide",
    description:
      "Use Listings Items API or JSON_LISTINGS_FEED instead of POST_PRODUCT_PRICING_DATA.",
  },
  {
    pattern: /\b_?POST_PRODUCT_IMAGE_DATA_?\b/gi,
    apiName: "POST_PRODUCT_IMAGE_DATA Feed",
    apiSection: "Feeds",
    deprecatedVersion: "Legacy Feed",
    modernVersion: "Listings Items API / JSON_LISTINGS_FEED",
    deprecationDate: "2024-03-18",
    removalDate: "2025-12-03",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide",
    description:
      "Use Listings Items API or JSON_LISTINGS_FEED instead of POST_PRODUCT_IMAGE_DATA.",
  },
  {
    pattern: /\b_?POST_PRODUCT_RELATIONSHIP_DATA_?\b/gi,
    apiName: "POST_PRODUCT_RELATIONSHIP_DATA Feed",
    apiSection: "Feeds",
    deprecatedVersion: "Legacy Feed",
    modernVersion: "Listings Items API / JSON_LISTINGS_FEED",
    deprecationDate: "2024-03-18",
    removalDate: "2025-12-03",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide",
    description:
      "Use Listings Items API or JSON_LISTINGS_FEED instead of POST_PRODUCT_RELATIONSHIP_DATA.",
  },
  {
    pattern: /\b_?POST_FLAT_FILE_INVLOADER_DATA_?\b/gi,
    apiName: "POST_FLAT_FILE_INVLOADER_DATA Feed",
    apiSection: "Feeds",
    deprecatedVersion: "Legacy Feed",
    modernVersion: "Listings Items API / JSON_LISTINGS_FEED",
    deprecationDate: "2024-03-18",
    removalDate: "2025-12-03",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide",
    description:
      "Use Listings Items API or JSON_LISTINGS_FEED instead of POST_FLAT_FILE_INVLOADER_DATA.",
  },
  {
    pattern: /\b_?POST_FLAT_FILE_LISTINGS_DATA_?\b/gi,
    apiName: "POST_FLAT_FILE_LISTINGS_DATA Feed",
    apiSection: "Feeds",
    deprecatedVersion: "Legacy Feed",
    modernVersion: "Listings Items API / JSON_LISTINGS_FEED",
    deprecationDate: "2024-03-18",
    removalDate: "2025-12-03",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide",
    description:
      "Use Listings Items API or JSON_LISTINGS_FEED instead of POST_FLAT_FILE_LISTINGS_DATA.",
  },
  {
    pattern: /\b_?POST_FLAT_FILE_PRICEANDQUANTITYONLY_UPDATE_DATA_?\b/gi,
    apiName: "POST_FLAT_FILE_PRICEANDQUANTITYONLY_UPDATE_DATA Feed",
    apiSection: "Feeds",
    deprecatedVersion: "Legacy Feed",
    modernVersion: "Listings Items API / JSON_LISTINGS_FEED",
    deprecationDate: "2024-03-18",
    removalDate: "2025-12-03",
    migrationGuide:
      "https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide",
    description:
      "Use Listings Items API or JSON_LISTINGS_FEED instead of POST_FLAT_FILE_PRICEANDQUANTITYONLY_UPDATE_DATA.",
  },
];

/**
 * Modern SDK class indicators by API section.
 * When these patterns are found in source code, the code has already migrated
 * to the modern API version — operation-level deprecated patterns should be skipped.
 */
export const modernClassIndicators: Record<string, RegExp> = {
  Orders:
    /\b(?:GetOrderApi|SearchOrdersApi|get_order_api|search_orders_api|orders_v2026_01_01|orders\.v2026_01_01)\b/i,
  Catalog:
    /\b(?:CatalogItemsApi|catalog_items_api|catalogitems_v2022_04_01|catalogitems\.v2022_04_01)\b/i,
  "FBA Inbound":
    /\b(?:FbaInboundApi|fba_inbound_api|fulfillmentinbound_v2024_03_20|fulfillmentinbound\.v2024_03_20)\b/i,
};

/**
 * V0 SDK class/endpoint pattern names that should always be flagged as deprecated,
 * even when modern SDK classes are present in the same code.
 * These indicate the v0 SDK is still being imported or referenced.
 */
export const v0ClassPatternNames = new Set([
  "OrdersV0Api",
  "Orders API v0 Endpoint",
  "Orders API v0 SDK Class",
  "CatalogItemsV0Api",
  "Catalog Items API v0 SDK Class",
  "Catalog Items API v0 Endpoint",
  "FulfillmentInboundV0Api",
  "Fulfillment Inbound API v0 SDK Class",
  "Fulfillment Inbound API v0 Endpoint",
]);
