const generalBestPractices: string[] = [
  "Always use batch/list endpoints instead of individual GET calls when retrieving multiple items",
  "Implement exponential backoff with jitter for retry logic on 429 and 5xx errors",
  "Use maximum page size to minimize pagination calls",
  "Subscribe to push notifications (ORDER_CHANGE, LISTINGS_ITEM_STATUS_CHANGE) instead of polling",
  "Use SP-API reports for bulk data retrieval instead of high-volume GET patterns",
  "Cache static or slow-changing data (marketplace participations, catalog items) with appropriate TTL",
  "Monitor x-amzn-ratelimit-limit response headers to track remaining quota",
  "Distribute API calls evenly over time to avoid burst throttling",
  "Always handle 429 Too Many Requests responses with appropriate backoff",
];

const sectionBestPractices: Record<string, string[]> = {
  orders: [
    "Use searchOrders with includedData parameter to reduce follow-up calls for buyer/recipient/financial data",
    "Subscribe to ORDER_CHANGE notifications instead of polling getOrders",
    "Use the All Orders report (GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL) for bulk order data",
    "Migrate from Orders V0 to the latest Orders API version for enhanced data models",
  ],
  catalog: [
    "Use searchCatalogItems for batch lookups instead of individual getCatalogItem calls",
    "Cache catalog item data with a reasonable TTL — product data changes infrequently",
    "Use includedData parameter to request only the attributes you need",
  ],
  listings: [
    "Subscribe to LISTINGS_ITEM_STATUS_CHANGE notifications for real-time listing updates",
    "Use the Merchant Listings report for bulk listing data retrieval",
    "Use patchListingsItem for partial updates instead of full putListingsItem",
  ],
  feeds: [
    "Subscribe to FEED_PROCESSING_FINISHED notifications instead of polling feed status",
    "Use batch feeds for bulk operations instead of individual API calls",
  ],
  reports: [
    "Subscribe to REPORT_PROCESSING_FINISHED notifications instead of polling report status",
    "Schedule reports during off-peak hours to reduce processing time",
  ],
  inventory: [
    "Subscribe to FBA_INVENTORY_AVAILABILITY_CHANGES notifications for real-time inventory updates",
    "Use the FBA Inventory report for bulk inventory data instead of paginated API calls",
  ],
  pricing: [
    "Subscribe to PRICING_HEALTH notifications for competitive pricing alerts",
    "Cache competitive pricing data with a short TTL to reduce call volume",
  ],
  fba_inbound: [
    "Use listInboundPlans for batch lookups instead of individual getInboundPlan calls",
    "Key operations support 5 req/s rate limits (getShipment, listShipmentBoxes, listDeliveryWindowOptions)",
    "Support up to 1500 SKUs per inbound plan — batch items into fewer plans",
    "Use listPrepDetails to check prep requirements before creating shipments",
  ],
  finances: [
    "Use Finances API v2024-06-19 over v0 — get real-time data without waiting for statement period close",
    "Subscribe to TRANSACTION_UPDATE notifications instead of polling listTransactions",
    "Filter listTransactions by ORDER_ID or FINANCIAL_EVENT_GROUP_ID to reduce response size",
    "Use transactionStatus filter (RELEASED, DEFERRED, DEFERRED_RELEASED) to narrow results",
  ],
  fulfillment: [
    "Respect max 100 line items and 250 units per Multi-Channel Fulfillment order",
    "Use deliveryOffers operation for batch delivery option lookups",
    "Use packageNumber with getPackageTrackingDetails for tracking (not deprecated amazonFulfillmentTrackingNumber)",
    "Use the dynamic sandbox to test fulfillment workflows before production",
  ],
  shipping: [
    "Use Shipping API v2 for rate shopping across carriers",
    "Merchant Fulfillment API has updated throttling rates — check current limits for getEligibleShippingServices",
    "Cache shipping rate estimates with a short TTL for repeated lookups on the same package dimensions",
  ],
  sellers: [
    "Cache getMarketplaceParticipations response — marketplace data changes very infrequently",
    "Use getAccount for seller business info instead of multiple marketplace-level calls",
    "Store marketplace IDs locally after first retrieval to avoid repeated API calls",
  ],
  product_type_definitions: [
    "Cache product type definition schemas — they change infrequently",
    "Use the locale parameter to get localized attribute labels in a single call",
    "Retrieve definitions once per product type and reuse across listings operations",
  ],
  easyship: [
    "Check marketplace support before calling EasyShip operations — not all marketplaces support it",
    "Use batch scheduling for multiple EasyShip orders to reduce API call volume",
    "Subscribe to notifications for shipment status updates instead of polling",
  ],
  listings_restrictions: [
    "Check restrictions for multiple marketplaces in a single call to reduce API volume",
    "Combine Listings Restrictions API with Listings Items API — check restrictions first, then create listings",
    "Cache restriction results per ASIN/marketplace — restrictions change infrequently",
  ],
  data_kiosk: [
    "Use Data Kiosk for bulk analytics data instead of high-volume report polling",
    "Leverage B2B refund metrics, feedback metrics, and claim-related metrics from Analytics Sales and Traffic dataset",
    "Schedule Data Kiosk queries during off-peak hours for faster processing",
  ],
  tokens: [
    "Cache Restricted Data Tokens (RDTs) for their validity period — do not request a new token per API call",
    "Request RDTs with the minimum set of restricted resources needed",
    "Batch multiple restricted resource paths into a single createRestrictedDataToken call",
  ],
  notifications: [
    "Use createSubscription once and persist — do not recreate subscriptions on every application start",
    "Prefer EventBridge destinations over SQS for cross-region and multi-account setups",
    "Use getSubscription to check existing subscriptions before creating duplicates",
    "Subscribe to the latest payload version for each notification type",
  ],
  awd: [
    "Use listInboundShipments for batch lookups instead of individual getInboundShipment calls",
    "Use listInventory with pagination for bulk inventory views across AWD warehouses",
    "Track in-transit inventory to improve end-to-end inventory visibility",
    "Reconcile expected vs received inventory per SKU using skuQuantities parameter",
  ],
  merchant_fulfillment: [
    "Use getEligibleShippingServices for rate shopping across carriers in a single call",
    "Check updated throttling rates — limits have been recently increased",
    "Cache shipping service options for repeated lookups on the same package dimensions",
    "Use createShipment only after comparing rates from getEligibleShippingServices",
  ],
};

export class BestPracticesProvider {
  getBestPractices(apiSection?: string): string[] {
    if (!apiSection) return [...generalBestPractices];

    const normalized = apiSection.toLowerCase();
    const sectionSpecific = sectionBestPractices[normalized];
    if (sectionSpecific) {
      return [...sectionSpecific, ...generalBestPractices.slice(0, 3)];
    }
    return [...generalBestPractices];
  }
}
