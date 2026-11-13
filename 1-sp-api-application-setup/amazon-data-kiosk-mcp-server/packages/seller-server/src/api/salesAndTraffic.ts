// src/api/salesAndTraffic.ts
import { makeApiRequest } from 'common';
import { API_VERSION, SCHEMA_NAMES } from 'common';

// Sales and Traffic Query Types
export type DateGranularity = 'DAY' | 'WEEK' | 'MONTH';
export type AsinGranularity = 'PARENT' | 'CHILD' | 'SKU';
export type AggregationType = 'byDate' | 'byAsin';

/**
 * Create a GraphQL query for Sales and Traffic
 * @param query The GraphQL query string
 * @returns Promise that resolves to the query result
 */
export async function createSalesAndTrafficQuery(query: string): Promise<any> {
  const body = { query };
  return makeApiRequest(`/dataKiosk/${API_VERSION}/queries`, "POST", body);
}

/**
 * Build a GraphQL query for Sales and Traffic based on parameters
 * @param aggregationType Whether to aggregate by date or ASIN
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format
 * @param granularity How to aggregate the data (day, week, month for date; parent, child, SKU for ASIN)
 * @param marketplaceIds Array of marketplace IDs
 * @param includeB2B Whether to include B2B metrics
 * @returns A GraphQL query string
 */
export function buildSalesAndTrafficQuery(
  aggregationType: AggregationType,
  startDate: string,
  endDate: string,
  granularity: DateGranularity | AsinGranularity,
  marketplaceIds: string[],
  includeB2B: boolean = false
): string {
  // Determine which schema to use (default to latest)
  const schemaName = SCHEMA_NAMES.SALES_AND_TRAFFIC;
  
  // Determine the query type and fields based on aggregation type
  const queryType = aggregationType === 'byDate' ? 'salesAndTrafficByDate' : 'salesAndTrafficByAsin';
  const granularityType = aggregationType === 'byDate' ? 'aggregateBy' : 'aggregateBy';
  
  // Build sales metrics based on aggregation type
  let salesMetrics = '';
  if (aggregationType === 'byDate') {
    salesMetrics = `
        orderedProductSales {
          amount
          currencyCode
        }
        ${includeB2B ? `
        orderedProductSalesB2B {
          amount
          currencyCode
        }` : ''}
        averageSalesPerOrderItem {
          amount
          currencyCode
        }
        ${includeB2B ? `
        averageSalesPerOrderItemB2B {
          amount
          currencyCode
        }` : ''}
        averageSellingPrice {
          amount
          currencyCode
        }
        ${includeB2B ? `
        averageSellingPriceB2B {
          amount
          currencyCode
        }` : ''}
        unitsOrdered
        ${includeB2B ? 'unitsOrderedB2B' : ''}
        totalOrderItems
        ${includeB2B ? 'totalOrderItemsB2B' : ''}
        unitsRefunded
        unitsShipped
        ordersShipped`;
  } else {
    salesMetrics = `
        orderedProductSales {
          amount
          currencyCode
        }
        ${includeB2B ? `
        orderedProductSalesB2B {
          amount
          currencyCode
        }` : ''}
        unitsOrdered
        ${includeB2B ? 'unitsOrderedB2B' : ''}
        totalOrderItems
        ${includeB2B ? 'totalOrderItemsB2B' : ''}`;
  }
  
  // Build traffic metrics based on aggregation type
  let trafficMetrics = '';
  if (aggregationType === 'byDate') {
    trafficMetrics = `
        browserPageViews
        ${includeB2B ? 'browserPageViewsB2B' : ''}
        browserSessions
        ${includeB2B ? 'browserSessionsB2B' : ''}
        mobileAppPageViews
        ${includeB2B ? 'mobileAppPageViewsB2B' : ''}
        mobileAppSessions
        ${includeB2B ? 'mobileAppSessionsB2B' : ''}
        pageViews
        ${includeB2B ? 'pageViewsB2B' : ''}
        sessions
        ${includeB2B ? 'sessionsB2B' : ''}
        buyBoxPercentage
        ${includeB2B ? 'buyBoxPercentageB2B' : ''}
        unitSessionPercentage
        ${includeB2B ? 'unitSessionPercentageB2B' : ''}`;
  } else {
    trafficMetrics = `
        browserPageViews
        ${includeB2B ? 'browserPageViewsB2B' : ''}
        browserSessions
        ${includeB2B ? 'browserSessionsB2B' : ''}
        mobileAppPageViews
        ${includeB2B ? 'mobileAppPageViewsB2B' : ''}
        mobileAppSessions
        ${includeB2B ? 'mobileAppSessionsB2B' : ''}
        pageViews
        ${includeB2B ? 'pageViewsB2B' : ''}
        sessions
        ${includeB2B ? 'sessionsB2B' : ''}
        browserPageViewsPercentage
        ${includeB2B ? 'browserPageViewsPercentageB2B' : ''}
        pageViewsPercentage
        ${includeB2B ? 'pageViewsPercentageB2B' : ''}
        buyBoxPercentage
        ${includeB2B ? 'buyBoxPercentageB2B' : ''}
        unitSessionPercentage
        ${includeB2B ? 'unitSessionPercentageB2B' : ''}`;
  }
  
  // Create the marketplace array string
  const marketplaceString = marketplaceIds.map(id => `"${id}"`).join(', ');
  
  // Build the complete query
  return `query SalesAndTrafficQuery {
  ${schemaName} {
    ${queryType}(
      ${granularityType}: ${granularity}
      startDate: "${startDate}"
      endDate: "${endDate}"
      marketplaceIds: [${marketplaceString}]
    ) {
      startDate
      endDate
      marketplaceId
      ${aggregationType === 'byAsin' ? `
      parentAsin
      ${granularity === 'CHILD' || granularity === 'SKU' ? 'childAsin' : ''}
      ${granularity === 'SKU' ? 'sku' : ''}` : ''}
      sales {${salesMetrics}
      }
      traffic {${trafficMetrics}
      }
    }
  }
}`;
}