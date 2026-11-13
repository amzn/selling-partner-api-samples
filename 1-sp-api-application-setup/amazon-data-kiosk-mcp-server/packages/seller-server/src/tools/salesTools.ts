// src/tools/salesTools.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildSalesAndTrafficQuery } from "../api/salesAndTraffic.js";
import { formatErrorMessage } from "common";
import { MARKETPLACES } from "common";

/**
 * Register sales and traffic tools with the MCP server
 * @param server The MCP server instance
 */
export function registerSalesTools(server: McpServer): void {
  // Tool to explore the sales and traffic schema
  server.tool(
    "explore-sales-and-traffic-schema",
    "Explore the Sales and Traffic GraphQL schema structure to help build queries",
    {
      entityType: z.enum([
        "overview", 
        "byDate", 
        "byAsin", 
        "metrics"
      ]).describe("Type of schema entity to explore")
    },
    async ({ entityType }) => {
      let schemaInfo = "";
      
      switch (entityType) {
        case "overview":
          schemaInfo = `
# Amazon Sales and Traffic GraphQL Schema Overview

The \`analytics_salesAndTraffic_2024_04_24\` schema provides access to seller sales and traffic data through two main aggregation methods:

1. \`salesAndTrafficByDate\`: Sales and traffic data aggregated by date
2. \`salesAndTrafficByAsin\`: Sales and traffic data aggregated by ASIN

Both methods accept these parameters:
- \`startDate\`: The start date (format: "YYYY-MM-DD") - must be no more than 2 years ago
- \`endDate\`: The end date (format: "YYYY-MM-DD")
- \`aggregateBy\`: How to aggregate data
  - For \`salesAndTrafficByDate\`: DAY, WEEK, or MONTH
  - For \`salesAndTrafficByAsin\`: PARENT, CHILD, or SKU
- \`marketplaceIds\`: Array of marketplace identifiers

Each method returns:
- \`startDate\` and \`endDate\`: The time period
- \`marketplaceId\`: The marketplace identifier
- \`sales\`: Sales metrics
- \`traffic\`: Traffic metrics
- Additional fields specific to the aggregation method

To build effective queries:
1. Choose the appropriate aggregation method (by date or by ASIN)
2. Select the date range and aggregation level
3. Specify which marketplaces to include
4. Select the sales and traffic metrics you need`;
          break;
          
        case "byDate":
          schemaInfo = `
# Sales and Traffic - Aggregation by Date

The \`salesAndTrafficByDate\` query provides sales and traffic data aggregated by date.

## Query Structure

\`\`\`graphql
salesAndTrafficByDate(
  aggregateBy: DAY|WEEK|MONTH
  startDate: "YYYY-MM-DD"
  endDate: "YYYY-MM-DD"
  marketplaceIds: ["MARKETPLACE_ID"]
) {
  startDate
  endDate
  marketplaceId
  sales {
    # Sales metrics aggregated by date
    orderedProductSales { amount, currencyCode }
    orderedProductSalesB2B { amount, currencyCode }
    averageSalesPerOrderItem { amount, currencyCode }
    averageSellingPrice { amount, currencyCode }
    unitsOrdered
    totalOrderItems
    # and many more...
  }
  traffic {
    # Traffic metrics aggregated by date
    browserPageViews
    browserSessions
    mobileAppPageViews
    mobileAppSessions
    pageViews
    sessions
    buyBoxPercentage
    unitSessionPercentage
    # and many more...
  }
}
\`\`\`

## Important Notes

- Use \`aggregateBy: DAY\` for daily data, \`WEEK\` for weekly, or \`MONTH\` for monthly
- Date aggregation follows these rules:
  - For \`WEEK\`, weeks start on Sunday and end on Saturday
  - For \`MONTH\`, data is aggregated by calendar month
- If start or end dates fall mid-week or mid-month, they're adjusted to the nearest boundary
- B2B metrics (e.g., orderedProductSalesB2B) are only available if you're enrolled in Amazon Business`;
          break;
          
        case "byAsin":
          schemaInfo = `
# Sales and Traffic - Aggregation by ASIN

The \`salesAndTrafficByAsin\` query provides sales and traffic data aggregated by ASIN.

## Query Structure

\`\`\`graphql
salesAndTrafficByAsin(
  aggregateBy: PARENT|CHILD|SKU
  startDate: "YYYY-MM-DD"
  endDate: "YYYY-MM-DD"
  marketplaceIds: ["MARKETPLACE_ID"]
) {
  startDate
  endDate
  marketplaceId
  parentAsin
  childAsin   # Only present when aggregateBy is CHILD or SKU
  sku         # Only present when aggregateBy is SKU
  sales {
    # Sales metrics aggregated by ASIN
    orderedProductSales { amount, currencyCode }
    orderedProductSalesB2B { amount, currencyCode }
    totalOrderItems
    totalOrderItemsB2B
    unitsOrdered
    unitsOrderedB2B
  }
  traffic {
    # Traffic metrics aggregated by ASIN
    browserPageViews
    browserSessions
    mobileAppPageViews
    mobileAppSessions
    pageViews
    sessions
    browserPageViewsPercentage
    pageViewsPercentage
    buyBoxPercentage
    unitSessionPercentage
    # and many more...
  }
}
\`\`\`

## Important Notes

- Use \`aggregateBy: PARENT\` for parent ASIN level data, \`CHILD\` for child ASIN level, or \`SKU\` for SKU level
- ASIN aggregation levels:
  - Parent ASINs represent product families (e.g., a shirt available in multiple colors/sizes)
  - Child ASINs represent specific variations (e.g., a specific color/size combination)
  - SKUs are seller-specific identifiers
- Different fields are available depending on the aggregation level
- The \`childAsin\` field is only present when \`aggregateBy\` is CHILD or SKU
- The \`sku\` field is only present when \`aggregateBy\` is SKU`;
          break;
          
        case "metrics":
          schemaInfo = `
# Available Metrics in Sales and Traffic

## Sales Metrics (By Date)
- \`orderedProductSales\`: Amount of ordered product sales (amount, currencyCode)
- \`orderedProductSalesB2B\`: B2B ordered product sales (amount, currencyCode)
- \`averageSalesPerOrderItem\`: Average sales per order item (amount, currencyCode)
- \`averageSalesPerOrderItemB2B\`: B2B average sales per order item (amount, currencyCode)
- \`averageSellingPrice\`: Average selling price (amount, currencyCode)
- \`averageSellingPriceB2B\`: B2B average selling price (amount, currencyCode)
- \`unitsOrdered\`: Number of units ordered
- \`unitsOrderedB2B\`: Number of B2B units ordered
- \`totalOrderItems\`: Number of order items
- \`totalOrderItemsB2B\`: Number of B2B order items
- \`unitsRefunded\`: Number of units refunded
- \`unitsShipped\`: Number of units shipped
- \`ordersShipped\`: Number of orders shipped
- \`shippedProductSales\`: Amount of shipped product sales (amount, currencyCode)
- \`claimsAmount\`: Amount of filed A-to-z guarantee claims (amount, currencyCode)
- \`claimsGranted\`: Number of A-to-z guarantee claims granted
- \`refundRate\`: Percentage of units refunded

## Traffic Metrics (By Date)
- \`browserPageViews\`: Number of browser page views
- \`browserPageViewsB2B\`: Number of B2B browser page views
- \`browserSessions\`: Number of browser sessions
- \`browserSessionsB2B\`: Number of B2B browser sessions
- \`mobileAppPageViews\`: Number of mobile app page views
- \`mobileAppPageViewsB2B\`: Number of B2B mobile app page views
- \`mobileAppSessions\`: Number of mobile app sessions
- \`mobileAppSessionsB2B\`: Number of B2B mobile app sessions
- \`pageViews\`: Total page views (browser + mobile app)
- \`pageViewsB2B\`: Total B2B page views
- \`sessions\`: Total sessions (browser + mobile app)
- \`sessionsB2B\`: Total B2B sessions
- \`buyBoxPercentage\`: Percentage of page views with the buy box
- \`buyBoxPercentageB2B\`: Percentage of B2B page views with the buy box
- \`unitSessionPercentage\`: Conversion rate (units ordered / sessions)
- \`unitSessionPercentageB2B\`: B2B conversion rate
- \`averageOfferCount\`: Average number of offers listed
- \`averageParentItems\`: Average number of parent items listed
- \`feedbackReceived\`: Number of customer feedback received
- \`negativeFeedbackReceived\`: Number of negative feedback received
- \`receivedNegativeFeedbackRate\`: Rate of negative feedback

## Sales Metrics (By ASIN)
- \`orderedProductSales\`: Amount of ordered product sales (amount, currencyCode)
- \`orderedProductSalesB2B\`: B2B ordered product sales (amount, currencyCode)
- \`totalOrderItems\`: Number of order items
- \`totalOrderItemsB2B\`: Number of B2B order items
- \`unitsOrdered\`: Number of units ordered
- \`unitsOrderedB2B\`: Number of B2B units ordered

## Traffic Metrics (By ASIN)
- \`browserPageViews\`, \`browserPageViewsB2B\`: Browser page views
- \`browserSessions\`, \`browserSessionsB2B\`: Browser sessions
- \`mobileAppPageViews\`, \`mobileAppPageViewsB2B\`: Mobile app page views
- \`mobileAppSessions\`, \`mobileAppSessionsB2B\`: Mobile app sessions
- \`pageViews\`, \`pageViewsB2B\`: Total page views
- \`sessions\`, \`sessionsB2B\`: Total sessions
- \`browserPageViewsPercentage\`: Percentage of total browser page views
- \`browserPageViewsPercentageB2B\`: Percentage of total B2B browser page views
- \`pageViewsPercentage\`: Percentage of total page views
- \`pageViewsPercentageB2B\`: Percentage of total B2B page views
- \`buyBoxPercentage\`: Percentage of page views with the buy box
- \`buyBoxPercentageB2B\`: Percentage of B2B page views with the buy box
- \`unitSessionPercentage\`: Conversion rate
- \`unitSessionPercentageB2B\`: B2B conversion rate`;
          break;
      }
      
      return {
        content: [
          {
            type: "text",
            text: schemaInfo
          }
        ]
      };
    }
  );

  // Tool to build sales and traffic queries
  server.tool(
    "build-sales-and-traffic-query",
    "Build a GraphQL query for sales and traffic based on parameters",
    {
      aggregationType: z.enum(["byDate", "byAsin"]).describe("Whether to aggregate by date or ASIN"),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date in YYYY-MM-DD format"),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End date in YYYY-MM-DD format"),
      granularity: z.enum(["DAY", "WEEK", "MONTH", "PARENT", "CHILD", "SKU"]).describe("Aggregation granularity (DAY/WEEK/MONTH for byDate, PARENT/CHILD/SKU for byAsin)"),
      marketplace: z.enum(["US", "CA", "MX", "UK", "DE", "FR", "IT", "ES", "JP", "AU"]).describe("Marketplace to get data for"),
      includeB2B: z.boolean().default(false).describe("Include B2B (Business-to-Business) metrics")
    },
    async (params) => {
      try {
        // Validate granularity based on aggregation type
        const dateGranularities = ["DAY", "WEEK", "MONTH"];
        const asinGranularities = ["PARENT", "CHILD", "SKU"];
        
        if (params.aggregationType === "byDate" && !dateGranularities.includes(params.granularity)) {
          throw new Error(`For aggregation by date, granularity must be one of: ${dateGranularities.join(", ")}`);
        }
        
        if (params.aggregationType === "byAsin" && !asinGranularities.includes(params.granularity)) {
          throw new Error(`For aggregation by ASIN, granularity must be one of: ${asinGranularities.join(", ")}`);
        }
        
        // Get the marketplace ID
        const marketplaceId = MARKETPLACES[params.marketplace];
        
        const query = buildSalesAndTrafficQuery(
          params.aggregationType,
          params.startDate,
          params.endDate,
          params.granularity as any, // Type casting to satisfy TypeScript
          [marketplaceId],
          params.includeB2B
        );

        return {
          content: [
            {
              type: "text",
              text: `Generated GraphQL Query for ${params.marketplace} marketplace:\n\n${query}\n\nYou can use this with the 'create-query' tool to submit this query to the Data Kiosk API.`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: formatErrorMessage(error, "building sales and traffic query")
            }
          ]
        };
      }
    }
  );
  
  // Tool to get example queries for sales and traffic
  server.tool(
    "get-sales-and-traffic-example",
    "Get example GraphQL queries for sales and traffic data",
    {
      queryType: z.enum([
        "salesByDate", 
        "salesByAsin",
        "trafficAndConversion",
        "businessAnalytics"
      ]).describe("Type of example query needed")
    },
    async ({ queryType }) => {
      let exampleQuery = "";
      let schemaInfo = "";
      
      switch (queryType) {
        case "salesByDate":
          exampleQuery = `query SalesAndTrafficByDateQuery {
  analytics_salesAndTraffic_2024_04_24 {
    salesAndTrafficByDate(
      startDate: "2025-03-01"
      endDate: "2025-03-31"
      aggregateBy: DAY
      marketplaceIds: ["ATVPDKIKX0DER"]  # US marketplace
    ) {
      startDate
      endDate
      marketplaceId
      sales {
        # Sales metrics
        orderedProductSales {
          amount
          currencyCode
        }
        averageSellingPrice {
          amount
          currencyCode
        }
        unitsOrdered
        totalOrderItems
        unitsRefunded
        unitsShipped
        ordersShipped
        refundRate
      }
      traffic {
        # Basic traffic metrics
        pageViews
        sessions
        buyBoxPercentage
        unitSessionPercentage
      }
    }
  }
}`;
          schemaInfo = `
This query provides daily sales and traffic data for the US marketplace for March 2025. It returns:

- **Sales metrics**: ordered sales, average price, units ordered/refunded/shipped
- **Traffic metrics**: page views, sessions, buy box percentage, and conversion rate

You can adjust the aggregation level using:
- \`aggregateBy: DAY\` for daily data
- \`aggregateBy: WEEK\` for weekly data
- \`aggregateBy: MONTH\` for monthly data

This query is useful for analyzing:
- Daily/weekly/monthly sales trends
- Return rates
- Shipping performance
- Basic conversion metrics`;
          break;
          
        case "salesByAsin":
          exampleQuery = `query SalesAndTrafficByAsinQuery {
  analytics_salesAndTraffic_2024_04_24 {
    salesAndTrafficByAsin(
      startDate: "2025-03-01"
      endDate: "2025-03-31"
      aggregateBy: CHILD
      marketplaceIds: ["ATVPDKIKX0DER"]  # US marketplace
    ) {
      startDate
      endDate
      marketplaceId
      parentAsin
      childAsin
      sales {
        orderedProductSales {
          amount
          currencyCode
        }
        unitsOrdered
        totalOrderItems
      }
      traffic {
        pageViews
        sessions
        buyBoxPercentage
        unitSessionPercentage
        browserPageViewsPercentage
        pageViewsPercentage
      }
    }
  }
}`;
          schemaInfo = `
This query provides sales and traffic data broken down by child ASIN (individual product variations) for the US marketplace for March 2025. It returns:

- **Product identifiers**: parent ASIN and child ASIN
- **Sales metrics**: ordered sales, units ordered, order items
- **Traffic metrics**: page views, sessions, buy box percentage, conversion rate, and share of total page views

You can change the level of product detail using:
- \`aggregateBy: PARENT\` for parent ASIN level (product families)
- \`aggregateBy: CHILD\` for child ASIN level (specific variations)
- \`aggregateBy: SKU\` for SKU level (seller-specific identifiers)

This query is useful for:
- Identifying your best and worst selling products
- Analyzing product-level conversion rates
- Understanding buy box win rates by product
- Comparing performance across different product variations`;
          break;
          
        case "trafficAndConversion":
          exampleQuery = `query TrafficAndConversionQuery {
  analytics_salesAndTraffic_2024_04_24 {
    salesAndTrafficByDate(
      startDate: "2025-03-01"
      endDate: "2025-03-31"
      aggregateBy: DAY
      marketplaceIds: ["ATVPDKIKX0DER"]  # US marketplace
    ) {
      startDate
      endDate
      marketplaceId
      traffic {
        # Traffic breakdown
        browserPageViews
        browserSessions
        mobileAppPageViews
        mobileAppSessions
        pageViews
        sessions
        
        # Conversion metrics
        buyBoxPercentage
        unitSessionPercentage
        orderItemSessionPercentage
        
        # Customer feedback
        feedbackReceived
        negativeFeedbackReceived
        receivedNegativeFeedbackRate
      }
      sales {
        # Conversion outcomes
        unitsOrdered
        totalOrderItems
        orderedProductSales {
          amount
          currencyCode
        }
      }
    }
  }
}`;
          schemaInfo = `
This query focuses on traffic sources and conversion metrics for the US marketplace for March 2025. It returns:

- **Traffic breakdown**: browser vs. mobile app page views and sessions
- **Conversion metrics**: buy box percentage, unit and order conversion rates
- **Customer feedback**: total feedback, negative feedback, and negative feedback rate
- **Conversion outcomes**: units ordered, order items, and sales amount

This query is particularly useful for:
- Analyzing traffic sources (browser vs. mobile app)
- Tracking conversion performance over time
- Monitoring customer satisfaction through feedback
- Identifying days with unusual traffic or conversion patterns`;
          break;
          
        case "businessAnalytics":
          exampleQuery = `query BusinessAnalyticsQuery {
  analytics_salesAndTraffic_2024_04_24 {
    salesAndTrafficByDate(
      startDate: "2025-01-01"
      endDate: "2025-03-31"
      aggregateBy: MONTH
      marketplaceIds: ["ATVPDKIKX0DER", "A2EUQ1WTGCTBG2"]  # US and Canada marketplaces
    ) {
      startDate
      endDate
      marketplaceId
      sales {
        # Sales performance
        orderedProductSales {
          amount
          currencyCode
        }
        orderedProductSalesB2B {
          amount
          currencyCode
        }
        unitsOrdered
        unitsOrderedB2B
        
        # Order efficiency
        averageSalesPerOrderItem {
          amount
          currencyCode
        }
        averageUnitsPerOrderItem
        
        # Pricing
        averageSellingPrice {
          amount
          currencyCode
        }
        
        # Returns and claims
        unitsRefunded
        refundRate
        claimsAmount {
          amount
          currencyCode
        }
        claimsGranted
      }
      traffic {
        # Traffic and conversion
        pageViews
        sessions
        buyBoxPercentage
        unitSessionPercentage
      }
    }
  }
}`;
          schemaInfo = `
This comprehensive business analytics query provides monthly data for both US and Canadian marketplaces for Q1 2025. It returns:

- **Sales performance**: regular and B2B sales, units ordered
- **Order efficiency**: average sales and units per order item
- **Pricing**: average selling price
- **Returns and claims**: refund rate, claims amount and count
- **Traffic and conversion**: page views, sessions, buy box percentage, conversion rate

This query is designed for quarterly business reviews and includes:
- Multi-marketplace comparison (US and Canada)
- B2B vs. regular business comparison
- Monthly trend analysis over a quarter
- Key business health metrics (returns, claims)

You can use this as a template for regular business performance reporting.`;
          break;
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Example ${queryType} Query:\n\n${exampleQuery}\n\n${schemaInfo}\n\nYou can use this with the 'create-query' tool to submit a query to the Data Kiosk API.`
          }
        ]
      };
    }
  );
}