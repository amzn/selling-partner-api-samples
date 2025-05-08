// src/utils/constants.ts

// API Versions
export const API_VERSIONS = {
  DATA_KIOSK: "2023-11-15",
  VENDOR_ANALYTICS: "2024_09_30",
  SALES_AND_TRAFFIC: "2024_04_24",
  SALES_AND_TRAFFIC_LEGACY: "2023_11_15",
  ECONOMICS: "2024_03_15"
};

// Direct API version for convenience
export const API_VERSION = process.env.DATA_KIOSK_API_VERSION || "2023-11-15";

// GraphQL Schema Names
export const SCHEMA_NAMES = {
  VENDOR_ANALYTICS: "analytics_vendorAnalytics_2024_09_30",
  SALES_AND_TRAFFIC: "analytics_salesAndTraffic_2024_04_24",
  SALES_AND_TRAFFIC_LEGACY: "analytics_salesAndTraffic_2023_11_15",
  ECONOMICS: "analytics_economics_2024_03_15"
};

// Common marketplaces
export const MARKETPLACES = {
  US: "ATVPDKIKX0DER",
  CA: "A2EUQ1WTGCTBG2",
  MX: "A1AM78C64UM0Y8",
  UK: "A1F83G8C2ARO7P",
  DE: "A1PA6795UKMFR9",
  FR: "A13V1IB3VIYZZH",
  IT: "APJ6JRA9NG5V4",
  ES: "A1RKKUPIHCS9HS",
  JP: "A1VC38T7YXB528",
  AU: "A39IBJ37TRP1C6"
};

// Date granularity options
export const DATE_GRANULARITY = {
  DAY: "DAY",
  WEEK: "WEEK",
  MONTH: "MONTH",
  RANGE: "RANGE"
};

// Product identifier granularity options
export const PRODUCT_GRANULARITY = {
  PARENT_ASIN: "PARENT_ASIN",
  CHILD_ASIN: "CHILD_ASIN",
  SKU: "SKU",
  MSKU: "MSKU",
  FNSKU: "FNSKU"
};