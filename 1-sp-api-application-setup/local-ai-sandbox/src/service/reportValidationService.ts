/**
 * Report type metadata: marketplace availability, scheduling support, and reportOptions validation.
 */

import { MARKETPLACE_IDS_EU, MARKETPLACE_IDS_ALL } from "../marketplaceIds.js";


interface ReportOptionRule {
  allowed?: string[];
  default?: string;
  required?: boolean;
}

interface ReportMeta {
  marketplaces: readonly string[];
  schedulable: boolean;
  reportOptions?: Record<string, ReportOptionRule>;
  requiresDateRange?: boolean;
}

export const REPORT_META: Record<string, ReportMeta> = {
  GET_AFN_INVENTORY_DATA: {
    marketplaces: MARKETPLACE_IDS_ALL,
    schedulable: false,
  },
  GET_AFN_INVENTORY_DATA_BY_COUNTRY: {
    marketplaces: MARKETPLACE_IDS_EU,
    schedulable: false,
  },
  GET_LEDGER_SUMMARY_VIEW_DATA: {
    marketplaces: MARKETPLACE_IDS_ALL,
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
    marketplaces: MARKETPLACE_IDS_ALL,
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
    marketplaces: MARKETPLACE_IDS_ALL,
    schedulable: false,
  },
  GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA: {
    marketplaces: MARKETPLACE_IDS_ALL,
    schedulable: false,
  },
  GET_FBA_MYI_ALL_INVENTORY_DATA: {
    marketplaces: MARKETPLACE_IDS_ALL,
    schedulable: false,
  },
  GET_RESTOCK_INVENTORY_RECOMMENDATIONS_REPORT: {
    marketplaces: MARKETPLACE_IDS_ALL,
    schedulable: false,
  },
  GET_FBA_FULFILLMENT_INBOUND_NONCOMPLIANCE_DATA: {
    marketplaces: MARKETPLACE_IDS_ALL,
    schedulable: false,
  },
  GET_STRANDED_INVENTORY_UI_DATA: {
    marketplaces: MARKETPLACE_IDS_ALL,
    schedulable: false,
  },
  GET_STRANDED_INVENTORY_LOADER_DATA: {
    marketplaces: MARKETPLACE_IDS_ALL,
    schedulable: false,
  },
  GET_FBA_STORAGE_FEE_CHARGES_DATA: {
    marketplaces: MARKETPLACE_IDS_ALL,
    schedulable: true,
  },
  GET_FBA_INVENTORY_PLANNING_DATA: {
    marketplaces: MARKETPLACE_IDS_ALL,
    schedulable: false,
  },
  GET_FBA_OVERAGE_FEE_CHARGES_DATA: {
    marketplaces: MARKETPLACE_IDS_ALL,
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
