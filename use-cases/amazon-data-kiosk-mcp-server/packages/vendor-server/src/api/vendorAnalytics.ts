// src/api/vendorAnalytics.ts
import { makeApiRequest } from 'common';
import { API_VERSION } from 'common';

// Vendor Analytics Query Types
export type ViewType = 'sourcing' | 'manufacturing';
export type AggregateBy = 'DAY' | 'WEEK' | 'MONTH';
export type MetricGroup = 
  'shippedOrders' | 
  'customerSatisfaction' | 
  'costs' | 
  'productAvailability' | 
  'sourcing' | 
  'orders' | 
  'traffic' | 
  'forecasting';

/**
 * Create a GraphQL query for Vendor Analytics
 * @param query The GraphQL query string
 * @returns Promise that resolves to the query result
 */
export async function createVendorAnalyticsQuery(query: string): Promise<any> {
  const body = { query };
  return makeApiRequest(`/dataKiosk/${API_VERSION}/queries`, "POST", body);
}

/**
 * Build a GraphQL query for vendor analytics based on parameters
 * @param viewType Which view to query (sourcing or manufacturing)
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format
 * @param aggregateBy How to aggregate the data
 * @param metricGroups Metric groups to include in the query
 * @param groupByAttributes Attributes to group by
 * @returns A GraphQL query string
 */
export function buildVendorAnalyticsQuery(
  viewType: ViewType,
  startDate: string,
  endDate: string,
  aggregateBy: AggregateBy,
  metricGroups: MetricGroup[],
  groupByAttributes: string[]
): string {
  // Validate that we're not using metrics that don't exist in the selected view
  if (viewType === "sourcing" && 
      (metricGroups.includes("orders") || 
       metricGroups.includes("traffic") || 
       metricGroups.includes("forecasting"))) {
    throw new Error("The 'orders', 'traffic', and 'forecasting' metric groups are only available in the manufacturingView, not in sourcingView.");
  }

  // Define helper to build the appropriate metric structure for each group
  const buildMetricStructure = (group: MetricGroup): string => {
    switch(group) {
      case "shippedOrders":
        return `
          shippedUnitsWithRevenue {
            units
            value {
              amount
              currencyCode
            }
          }
          averageSellingPrice {
            amount
            currencyCode
          }`;
      
      case "customerSatisfaction":
        return `
          customerReturns`;
      
      case "costs":
        return `
          shippedCogs {
            amount
            currencyCode
          }
          contraCogs {
            amount
            currencyCode
          }
          salesDiscount {
            amount
            currencyCode
          }
          netPPM`;
      
      case "productAvailability":
        return `
          sellableOnHandInventory {
            units
            value {
              amount
              currencyCode
            }
          }
          unsellableOnHandInventory {
            units
            value {
              amount
              currencyCode
            }
          }
          sellThroughRate
          ultraFastTrack`;
      
      case "sourcing":
        return `
          netReceived {
            units
            value {
              amount
              currencyCode
            }
          }
          confirmedUnits
          openPurchaseOrderQuantity
          receivedFillRate
          vendorConfirmationRate`;
      
      case "orders":
        return `
          netOrderedGMS {
            amount
            currencyCode
          }
          orderedUnitsWithRevenue {
            units
            value {
              amount
              currencyCode
            }
          }
          unfilledOrderedUnits`;
      
      case "traffic":
        return `
          glanceViews`;
      
      case "forecasting":
        return `{
            startDate
            endDate
            weekNumber
            demand {
              mean
              p70
              p80
              p90
            }
          }`;
      
      default:
        return "";
    }
  };

  // Generate content for each metric group
  const metricSelections: Record<string, string> = {};
  metricGroups.forEach(group => {
    if (group === "forecasting") {
      // Special case for forecasting as it's an array
      metricSelections[group] = buildMetricStructure(group);
    } else {
      metricSelections[group] = `${group} {${buildMetricStructure(group)}
        }`;
    }
  });

  // Build the groupByAttributes section
  const groupBySection = groupByAttributes.join("\n          ");

  // Create the final GraphQL query
  const viewMethod = viewType === "sourcing" ? "sourcingView" : "manufacturingView";
  
  // Build the totals section
  const totalsSection = metricGroups
    .map(group => {
      if (group === "forecasting") {
        return `forecasting ${metricSelections[group]}`;
      }
      return metricSelections[group];
    })
    .join("\n        ");
    
  // Build the metrics section with the same metric groups
  const metricsSection = metricGroups
    .map(group => {
      if (group === "forecasting") {
        return `forecasting ${metricSelections[group]}`;
      }
      return metricSelections[group];
    })
    .join("\n          ");

  return `query VendorAnalyticsQuery {
  analytics_vendorAnalytics_2024_09_30 {
    ${viewMethod}(
      startDate: "${startDate}"
      endDate: "${endDate}"
      aggregateBy: ${aggregateBy}
      currencyCode: "USD"
    ) {
      startDate
      endDate
      marketplaceId
      # Overall totals across all products
      totals {
        ${totalsSection}
      }
      # Metrics grouped by product attributes
      metrics {
        groupByKey {
          ${groupBySection}
        }
        metrics {
          ${metricsSection}
        }
      }
    }
  }
}`;
}