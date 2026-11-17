// src/tools/vendorTools.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildVendorAnalyticsQuery } from "../api/vendorAnalytics.js";
import { formatErrorMessage } from "common";


/**
 * Register vendor analytics tools with the MCP server
 * @param server The MCP server instance
 */
export function registerVendorTools(server: McpServer): void {
  // Tool to explore the vendor analytics schema
  server.tool(
    "explore-vendor-analytics-schema",
    "Explore the Vendor Analytics GraphQL schema structure to help build queries",
    {
      entityType: z.enum([
        "overview", 
        "sourcingView", 
        "manufacturingView", 
        "metrics", 
        "groupByAttributes"
      ]).describe("Type of schema entity to explore")
    },
    async ({ entityType }) => {
      let schemaInfo = "";
      
      switch (entityType) {
        case "overview":
          schemaInfo = `
# Amazon Vendor Analytics GraphQL Schema Overview

The analytics_vendorAnalytics_2024_09_30 schema provides access to vendor analytics data through two main views:

1. \`sourcingView\`: For products sourced directly from the vendor to Amazon (when the vendor is a distributor)
2. \`manufacturingView\`: For products manufactured by the vendor

Both views accept these parameters:
- \`startDate\`: The start date (format: "YYYY-MM-DD") - must be no more than 2 years ago
- \`endDate\`: The end date (format: "YYYY-MM-DD")
- \`aggregateBy\`: How to aggregate data (DAY, WEEK, or MONTH)
- \`currencyCode\`: Currency for monetary values (e.g., "USD")

Each view returns:
- \`startDate\` and \`endDate\`: The time period
- \`marketplaceId\`: The marketplace identifier
- \`totals\`: Aggregated metrics across all products
- \`metrics\`: Metrics grouped by product attributes (ASIN, brand, etc.)

To build effective queries:
1. Choose the appropriate view (sourcing or manufacturing)
2. Select the date range and aggregation level
3. Specify which metrics you need from the available metric groups
4. Define how to group the data using groupByKey attributes`;
          break;
          
        case "sourcingView":
          schemaInfo = `
# Vendor Analytics - sourcingView

The \`sourcingView\` provides metrics about products that are sourced directly from the vendor to Amazon (when the vendor is a distributor).

## Query Structure

\`\`\`graphql
sourcingView(
  startDate: "YYYY-MM-DD",
  endDate: "YYYY-MM-DD",
  aggregateBy: DAY|WEEK|MONTH,
  currencyCode: "USD"
) {
  startDate
  endDate
  marketplaceId
  totals {
    # Metric groups available in totals
    shippedOrders { ... }
    customerSatisfaction { ... }
    costs { ... }
    productAvailability { ... }
    sourcing { ... }
  }
  metrics {
    groupByKey {
      # Available grouping attributes
      asin
      brand
      brandCode
      # and many others
    }
    metrics {
      # Same metric groups as in totals
      shippedOrders { ... }
      customerSatisfaction { ... }
      # etc.
    }
  }
}
\`\`\`

## Important Notes

- The \`sourcingView\` focuses on distribution metrics
- It does not include traffic and forecasting metrics (these are in manufacturingView)
- The metric groups \`shippedOrders\`, \`customerSatisfaction\`, \`costs\`, \`productAvailability\`, and \`sourcing\` are available
- Common use cases include analyzing inventory health, purchase order fulfillment, and shipped revenue`;
          break;
          
        case "manufacturingView":
          schemaInfo = `
# Vendor Analytics - manufacturingView

The \`manufacturingView\` provides metrics about products manufactured by the vendor, including additional metrics not available in sourcingView.

## Query Structure

\`\`\`graphql
manufacturingView(
  startDate: "YYYY-MM-DD",
  endDate: "YYYY-MM-DD",
  aggregateBy: DAY|WEEK|MONTH,
  currencyCode: "USD"
) {
  startDate
  endDate
  marketplaceId
  totals {
    # All metric groups available in totals
    shippedOrders { ... }
    orders { ... }
    customerSatisfaction { ... }
    costs { ... }
    productAvailability { ... }
    sourcing { ... }
    traffic { ... }
    forecasting { ... }
  }
  metrics {
    groupByKey {
      # Available grouping attributes
      asin
      brand
      # etc.
    }
    metrics {
      # Same metric groups as in totals
      shippedOrders { ... }
      orders { ... }
      # etc.
    }
  }
}
\`\`\`

## Important Notes

- The \`manufacturingView\` includes additional metrics not in sourcingView:
  - \`traffic\`: Website traffic metrics (glance views)
  - \`orders\`: Order metrics beyond just shipped items
  - \`forecasting\`: Future demand predictions by week
- This view is ideal for manufacturers who want to understand customer demand, traffic, and inventory needs`;
          break;
          
        case "metrics":
          schemaInfo = `
# Available Metric Groups

The following metric groups are available in both views (unless specified):

## 1. shippedOrders
- \`shippedUnitsWithRevenue\`: Units and revenue of shipped items
  - \`units\`: Number of units shipped
  - \`value\`: Monetary value with amount and currencyCode
- \`averageSellingPrice\`: Average price per unit

## 2. customerSatisfaction
- \`customerReturns\`: Number of items returned

## 3. costs
- \`shippedCogs\`: Cost of goods sold
- \`contraCogs\`: Contra cost of goods sold
- \`contraCogsPerUnit\`: Average contra-COGS per unit
- \`salesDiscount\`: Promotional discounts
- \`averageSalesDiscount\`: Average discount per unit
- \`netPPM\`: Net Pure Product Margin

## 4. productAvailability
- \`sellableOnHandInventory\`: Units and value of sellable inventory
- \`unsellableOnHandInventory\`: Units and value of unsellable inventory
- \`sellableInTransitInventory\`: Units in transit (sellable)
- \`unsellableInTransitInventory\`: Units in transit (unsellable)
- \`aged90DaysSellableInventory\`: Units and value of aging inventory
- \`unhealthyInventory\`: Excess units based on forecast
- \`sellThroughRate\`: Rate of inventory movement
- \`ultraFastTrack\`: Availability for Prime shipping
- \`sourceableROOS\`: Replenishment out of stock percentage

## 5. sourcing
- \`netReceived\`: Units and value received by Amazon
- \`confirmedUnits\`: Units confirmed to be shipped
- \`openPurchaseOrderQuantity\`: Units in open POs
- \`mostRecentSubmitted\`: Units in recent POs
- \`receivedFillRate\`: Received units vs confirmed units
- \`vendorConfirmationRate\`: Confirmed units vs submitted units
- \`overallVendorLeadTime\`: Time from PO to receipt
- \`procurableProductOOS\`: Out of stock rate

## 6. orders (manufacturingView only)
- \`netOrderedGMS\`: Net Gross Merchandise Sales
- \`netShipmentGMS\`: Net shipped GMS
- \`orderedUnitsWithRevenue\`: Ordered units and revenue
- \`unfilledOrderedUnits\`: Units ordered but not shipped

## 7. traffic (manufacturingView only)
- \`glanceViews\`: Product page views

## 8. forecasting (manufacturingView only)
- Weekly forecasts with:
  - \`mean\`: Expected demand
  - \`p70\`, \`p80\`, \`p90\`: Statistical confidence levels`;
          break;
          
        case "groupByAttributes":
          schemaInfo = `
# Available GroupBy Attributes

The \`groupByKey\` object allows you to segment data by various product attributes:

## Product Identifiers
- \`asin\`: Amazon Standard Identification Number
- \`parentAsin\`: Parent product ASIN
- \`upc\`: Universal Product Code
- \`ean\`: European Article Number
- \`isbn13\`: International Standard Book Number (13-digit)

## Brand Information
- \`brand\`: Brand name
- \`brandCode\`: Amazon brand code
- \`manufacturerCode\`: Manufacturer identifier

## Product Details
- \`productTitle\`: Product name
- \`productGroup\`: Business category (e.g., PC, Wireless)
- \`binding\`: Product format (e.g., Hardcover, T-Shirt)
- \`color\`: Product color
- \`modelNumber\`: Model or style number
- \`msrp\`: Manufacturer's suggested retail price
- \`releaseDate\`: Product release date

## Fulfillment Information
- \`prepInstructions\`: Required prep instructions
- \`prepInstructionsPerformedBy\`: Who performs prep (Amazon or vendor)
- \`replenishmentCategory\`: Availability status

## Shipping Information
- \`shipToCity\`: Customer city
- \`shipToStateOrProvince\`: Customer state/province
- \`shipToCountryCode\`: Customer country code
- \`shipToZipCode\`: Customer ZIP code

## Usage Tips
- Select attributes relevant to your analysis
- Commonly used combinations:
  - Product analysis: asin, productTitle
  - Brand analysis: brand, brandCode
  - Category analysis: productGroup
  - Geographic analysis: shipToCountryCode, shipToStateOrProvince
- You can combine multiple attributes to create more detailed segments`;
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

  // Tool to build vendor analytics queries
  server.tool(
    "build-vendor-analytics-query",
    "Build a GraphQL query for vendor analytics based on parameters",
    {
      viewType: z.enum(["sourcing", "manufacturing"]).describe("Which view to query (sourcing or manufacturing)"),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date in YYYY-MM-DD format"),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End date in YYYY-MM-DD format"),
      aggregateBy: z.enum(["DAY", "WEEK", "MONTH"]).describe("How to aggregate the data"),
      metricGroups: z.array(z.enum([
        "shippedOrders", 
        "customerSatisfaction", 
        "costs", 
        "productAvailability", 
        "sourcing", 
        "orders", 
        "traffic", 
        "forecasting"
      ])).describe("Metric groups to include in the query"),
      groupByAttributes: z.array(z.string()).min(1).describe("Attributes to group by (e.g., asin, brand)")
    },
    async (params) => {
      try {
        const query = buildVendorAnalyticsQuery(
          params.viewType,
          params.startDate,
          params.endDate,
          params.aggregateBy,
          params.metricGroups,
          params.groupByAttributes
        );

        return {
          content: [
            {
              type: "text",
              text: `Generated GraphQL Query:\n\n${query}\n\nYou can use this with the 'create-query' tool to submit this query to the Data Kiosk API.`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: formatErrorMessage(error, "building vendor analytics query")
            }
          ]
        };
      }
    }
  );
  
  // Tool to get example queries for vendor analytics
  server.tool(
    "get-vendor-analytics-example",
    "Get example GraphQL queries for vendor analytics",
    {
      queryType: z.enum([
        "vendorAnalyticsSourced", 
        "vendorAnalyticsManufactured"
      ]).describe("Type of example query needed")
    },
    async ({ queryType }) => {
      let exampleQuery = "";
      let schemaInfo = "";
      
      switch (queryType) {
        case "vendorAnalyticsSourced":
          exampleQuery = `query VendorAnalyticsSourcedQuery {
  analytics_vendorAnalytics_2024_09_30 {
    sourcingView(
      startDate: "2025-03-01"
      endDate: "2025-03-31"
      aggregateBy: WEEK
      currencyCode: "USD"
    ) {
      startDate
      endDate
      marketplaceId
      # Overall totals across all products
      totals {
        # Shipping metrics
        shippedOrders {
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
          }
        }
        # Inventory metrics
        productAvailability {
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
          ultraFastTrack
        }
        # Supply chain metrics
        sourcing {
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
          vendorConfirmationRate
          overallVendorLeadTime
        }
      }
      # Metrics grouped by product attributes
      metrics {
        groupByKey {
          asin
          brand
          productTitle
        }
        metrics {
          customerSatisfaction {
            customerReturns
          }
          shippedOrders {
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
            }
          }
          costs {
            shippedCogs
            contraCogs
            salesDiscount
            netPPM
          }
        }
      }
    }
  }
}`;
          schemaInfo = `
This query focuses on the sourcingView, which provides metrics about products that are sourced directly from you to Amazon (when you're acting as a distributor).

Key metrics available in sourcingView:
- shippedOrders: Units shipped and revenue
- productAvailability: Inventory levels and sell-through rates
- sourcing: Purchase order and supply chain metrics
- costs: Cost of goods sold and margin metrics
- customerSatisfaction: Return metrics

GroupByKey options include:
- asin: Amazon Standard Identification Number
- brand/brandCode: Product brand information
- productTitle: Product name
- productGroup: Business category
- color, binding, modelNumber: Product attributes
- upc, ean, isbn13: Product identifiers`;
          break;
          
        case "vendorAnalyticsManufactured":
          exampleQuery = `query VendorAnalyticsManufacturedQuery {
  analytics_vendorAnalytics_2024_09_30 {
    manufacturingView(
      startDate: "2025-03-01"
      endDate: "2025-03-31"
      aggregateBy: WEEK
      currencyCode: "USD"
    ) {
      startDate
      endDate
      marketplaceId
      # Overall totals across all products
      totals {
        # Shipping and order metrics
        shippedOrders {
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
          }
        }
        orders {
          netOrderedGMS
          orderedUnitsWithRevenue {
            units
            value {
              amount
              currencyCode
            }
          }
          unfilledOrderedUnits
        }
        # Traffic metrics
        traffic {
          glanceViews
        }
        # Forecasting for future weeks
        forecasting {
          startDate
          endDate
          weekNumber
          demand {
            mean
            p70
            p80
            p90
          }
        }
      }
      # Metrics grouped by product attributes
      metrics {
        groupByKey {
          asin
          brand
          productGroup
        }
        metrics {
          customerSatisfaction {
            customerReturns
          }
          shippedOrders {
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
            }
          }
          productAvailability {
            sellableOnHandInventory {
              units
              value {
                amount
                currencyCode
              }
            }
            sellThroughRate
            ultraFastTrack
            unhealthyInventory {
              units
              value {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
}`;
          schemaInfo = `
This query focuses on the manufacturingView, which provides metrics about products manufactured by you.

The manufacturingView includes additional metrics not available in sourcingView:
- traffic: Website traffic metrics like glanceViews
- orders: Order metrics beyond just shipped items
- forecasting: Future demand predictions by week

Key metric groups in manufacturingView:
- shippedOrders: Units shipped and revenue
- orders: Ordered units and unfilled orders
- productAvailability: Inventory health metrics
- traffic: Product page view metrics
- customerSatisfaction: Return metrics
- forecasting: Future demand predictions

The forecasting section provides:
- mean: Amazon's best estimate of weekly customer demand
- p70/p80/p90: Statistical confidence levels for demand estimation`;
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