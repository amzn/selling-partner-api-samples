/**
 * Report type metadata: marketplace availability, scheduling support, and reportOptions validation.
 */

// NA: US, CA, MX, BR  |  EU: UK, DE, FR, IT, ES, NL, SE, PL, TR, SA, AE, IN, EG  |  FE: JP, AU, SG
const NA = ["ATVPDKIKX0DER", "A2EUQ1WTGCTBG2", "A1AM78C64UM0Y8", "A2Q3Y263D00KWC"];
const EU = [
  "A1F83G8C2ARO7P",
  "A1PA6795UKMFR9",
  "A13V1IB3VIYZZH",
  "APJ6JRA9NG5V4",
  "A1RKKUPIHCS9HS",
  "A1805IZSGTT6HS",
  "A2NODRKZP88ZB9",
  "A21TJRUUN4KGV",
  "A17E79C6D8DWNP",
  "ARBP9OOSHTCHU",
  "A2VIGQ35RCS4UG",
  "A33AVAJ2PDY3EV",
];
const FE = ["A1VC38T7YXB528", "A39IBJ37TRP1C6", "A19VAU5U5O7RUS"];
const ALL = [...NA, ...EU, ...FE];

interface ReportOptionRule {
  allowed?: string[];
  default?: string;
  required?: boolean;
}

interface ReportMeta {
  marketplaces: string[];
  schedulable: boolean;
  reportOptions?: Record<string, ReportOptionRule>;
  requiresDateRange?: boolean;
}

export const REPORT_META: Record<string, ReportMeta> = {
  GET_AFN_INVENTORY_DATA: {
    marketplaces: ALL,
    schedulable: false,
  },
  GET_AFN_INVENTORY_DATA_BY_COUNTRY: {
    marketplaces: EU,
    schedulable: false,
  },
  GET_LEDGER_SUMMARY_VIEW_DATA: {
    marketplaces: ALL,
    schedulable: false,
    requiresDateRange: true,
    reportOptions: {
      aggregateByLocation: { allowed: ["COUNTRY", "FC"], default: "COUNTRY" },
      aggregatedByTimePeriod: { allowed: ["DAILY", "WEEKLY", "MONTHLY"], default: "MONTHLY" },
      FNSKU: {},
      MSKU: {},
      ASIN: {},
    },
  },
  GET_LEDGER_DETAIL_VIEW_DATA: {
    marketplaces: ALL,
    schedulable: false,
    requiresDateRange: true,
    reportOptions: {
      eventType: { allowed: ["", "Adjustments", "CustomerReturns", "Receipts", "Shipments", "VendorReturns", "WhseTransfers"], default: "" },
      FNSKU: {},
      MSKU: {},
      ASIN: {},
    },
  },
  GET_RESERVED_INVENTORY_DATA: {
    marketplaces: ALL,
    schedulable: false,
  },
  GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA: {
    marketplaces: ALL,
    schedulable: false,
  },
  GET_FBA_MYI_ALL_INVENTORY_DATA: {
    marketplaces: ALL,
    schedulable: false,
  },
  GET_RESTOCK_INVENTORY_RECOMMENDATIONS_REPORT: {
    marketplaces: ALL,
    schedulable: false,
  },
  GET_FBA_FULFILLMENT_INBOUND_NONCOMPLIANCE_DATA: {
    marketplaces: ALL,
    schedulable: false,
  },
  GET_STRANDED_INVENTORY_UI_DATA: {
    marketplaces: ALL,
    schedulable: false,
  },
  GET_STRANDED_INVENTORY_LOADER_DATA: {
    marketplaces: ALL,
    schedulable: false,
  },
  GET_FBA_STORAGE_FEE_CHARGES_DATA: {
    marketplaces: ALL,
    schedulable: true,
  },
  GET_FBA_INVENTORY_PLANNING_DATA: {
    marketplaces: ALL,
    schedulable: false,
  },
  GET_FBA_OVERAGE_FEE_CHARGES_DATA: {
    marketplaces: ALL,
    schedulable: false,
  },
};

export function validateReport(
  reportType: string,
  marketplaceIds: string[],
  reportOptions?: Record<string, string>,
  dataStartTime?: string,
  dataEndTime?: string,
): string | null {
  const meta = REPORT_META[reportType];
  if (!meta) return null; // no metadata = skip validation

  // Marketplace validation
  if (marketplaceIds?.length) {
    const invalid = marketplaceIds.filter((m) => !meta.marketplaces.includes(m));
    if (invalid.length) {
      return `reportType ${reportType} is not available in marketplace(s): ${invalid.join(", ")}`;
    }
  }

  // Date range validation
  if (meta.requiresDateRange) {
    if (!dataStartTime || !dataEndTime) {
      return `reportType ${reportType} requires both dataStartTime and dataEndTime`;
    }
  }

  // reportOptions validation
  if (reportOptions && meta.reportOptions) {
    for (const [key, value] of Object.entries(reportOptions)) {
      const rule = meta.reportOptions[key];
      if (!rule) {
        return `Invalid reportOption '${key}' for ${reportType}. Valid options: ${Object.keys(meta.reportOptions).join(", ")}`;
      }
      if (rule.allowed && !rule.allowed.includes(value)) {
        return `Invalid value '${value}' for reportOption '${key}'. Allowed: ${rule.allowed.join(", ")}`;
      }
    }
  }

  return null;
}
