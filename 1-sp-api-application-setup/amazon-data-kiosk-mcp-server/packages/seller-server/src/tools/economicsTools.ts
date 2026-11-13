// src/tools/economicsTools.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildEconomicsQuery, buildEconomicsPreviewQuery } from "../api/economics.js";
import { formatErrorMessage } from "common";
import { MARKETPLACES } from "common";

/**
 * Register economics tools with the MCP server
 * @param server The MCP server instance
 */
export function registerEconomicsTools(server: McpServer): void {
  // Tool to explore the economics schema
  server.tool(
    "explore-economics-schema",
    "Explore the Seller Economics GraphQL schema structure to help build queries",
    {
      entityType: z.enum([
        "overview", 
        "economics", 
        "economicsPreview", 
        "feeTypes",
        "metrics"
      ]).describe("Type of schema entity to explore")
    },
    async ({ entityType }) => {
      let schemaInfo = "";
      
      switch (entityType) {
        case "overview":
          schemaInfo = `
# Amazon Seller Economics GraphQL Schema Overview

The \`analytics_economics_2024_03_15\` schema provides access to seller economics data through two main queries:

1. \`economics\`: Detailed historical economics data including sales, fees, costs, and profitability
2. \`economicsPreview\`: Preview future economics data based on fee changes or promotions

Both queries return data about:
- Product sales performance
- Amazon fees broken down by fee type
- Advertising spend
- Seller-provided costs
- Net proceeds (profitability)

Key benefits of using this schema:
- Understand your true profitability after all fees and costs
- Analyze how different fee types impact your business
- Compare performance across different products or marketplaces
- Plan for future fee changes using the preview functionality`;
          break;
          
        case "economics":
          schemaInfo = `
# Seller Economics - economics Query

The \`economics\` query provides detailed historical economics data for your products.

## Query Structure

\`\`\`graphql
economics(
  startDate: "YYYY-MM-DD",
  endDate: "YYYY-MM-DD",
  aggregateBy: {
    date: DAY|WEEK|MONTH|RANGE,
    productId: PARENT_ASIN|CHILD_ASIN|FNSKU|MSKU
  },
  marketplaceIds: ["MARKETPLACE_ID"],
  includeComponentsForFeeTypes: [FEE_TYPE]  # Optional
) {
  startDate
  endDate
  marketplaceId
  parentAsin
  childAsin            # Only present with certain aggregations
  fnsku                # Only present with certain aggregations
  msku                 # Only present with certain aggregations
  
  # Sales data
  sales {
    orderedProductSales { amount, currencyCode }
    netProductSales { amount, currencyCode }
    averageSellingPrice { amount, currencyCode }
    unitsOrdered
    unitsRefunded
    netUnitsSold
  }
  
  # Fees data
  fees {
    feeTypeName
    charges {
      aggregatedDetail {
        amount { amount, currencyCode }
        amountPerUnit { amount, currencyCode }
        totalAmount { amount, currencyCode }
        quantity
      }
      components {  # Only if includeComponentsForFeeTypes is specified
        name
        aggregatedDetail {
          amount { amount, currencyCode }
          totalAmount { amount, currencyCode }
        }
      }
    }
  }
  
  # Ads data
  ads {
    adTypeName
    charge {
      aggregatedDetail {
        amount { amount, currencyCode }
        totalAmount { amount, currencyCode }
      }
    }
  }
  
  # Cost data (if provided by seller)
  cost {
    costOfGoodsSold { amount, currencyCode }
    fbaCost {
      shippingToAmazonCost { amount, currencyCode }
    }
    mfnCost {
      fulfillmentCost { amount, currencyCode }
      storageCost { amount, currencyCode }
    }
  }
  
  # Net proceeds
  netProceeds {
    total { amount, currencyCode }
    perUnit { amount, currencyCode }
  }
}
\`\`\`

## Important Notes

- The \`aggregateBy\` parameter allows flexibility in how data is grouped:
  - \`date\`: DAY, WEEK, MONTH, or RANGE (entire date range)
  - \`productId\`: PARENT_ASIN, CHILD_ASIN, FNSKU, or MSKU
- The \`includeComponentsForFeeTypes\` parameter allows you to break down specific fee types into their components
- Cost data is only available if you've provided it in SKU Central or the Revenue Calculator
- Net proceeds are calculated as: sales - fees - ads - costs`;
          break;
          
        case "economicsPreview":
          schemaInfo = `
# Seller Economics - economicsPreview Query

The \`economicsPreview\` query allows you to preview how future fee changes will impact your business.

## Query Structure

\`\`\`graphql
economicsPreview(
  startDate: "YYYY-MM-DD",  # Must not be earlier than today
  endDate: "YYYY-MM-DD",    # Must not be more than 30 days after today
  aggregateBy: {
    date: RANGE,            # Only RANGE is supported for preview
    productId: MSKU         # Only MSKU is supported for preview
  },
  marketplaceIds: ["MARKETPLACE_ID"],
  feeTypes: [PREVIEW_FEE_TYPE]  # Required
) {
  startDate
  endDate
  marketplaceId
  parentAsin
  childAsin
  msku
  
  # Sales data (projected based on historical)
  sales {
    orderedProductSales { amount, currencyCode }
    netProductSales { amount, currencyCode }
    unitsOrdered
  }
  
  # Preview of fees based on specified fee types
  fees {
    feeTypeName
    charges {
      aggregatedDetail {
        amount { amount, currencyCode }
        amountPerUnit { amount, currencyCode }
        totalAmount { amount, currencyCode }
        quantity
      }
    }
  }
  
  # Projected net proceeds with new fees
  netProceeds {
    total { amount, currencyCode }
    perUnit { amount, currencyCode }
  }
}
\`\`\`

## Important Notes

- Preview is limited to:
  - Start date must not be earlier than today
  - End date must not be more than 30 days after today
  - Only RANGE date aggregation is supported
  - Only MSKU product aggregation is supported
- You must specify which fee types to preview
- Sales projections are based on your historical sales data
- This is useful for understanding the impact of:
  - Upcoming fee changes
  - Promotional fee discounts
  - New fee structures`;
          break;
          
        case "feeTypes":
          schemaInfo = `
# Fee Types in Seller Economics

## Fee Types for includeComponentsForFeeTypes

These fee types can be used with the \`includeComponentsForFeeTypes\` parameter in the \`economics\` query to get detailed fee components:

- \`FBA_FULFILLMENT_FEE\`: Fulfillment by Amazon (FBA) Fulfillment Fees, including base rate and surcharges
- \`FBA_STORAGE_FEE\`: Fulfillment by Amazon (FBA) Monthly Inventory Storage Fee, including base rate and surcharges

## Preview Fee Types (feeTypes parameter in economicsPreview)

These fee types can be previewed using the \`feeTypes\` parameter in the \`economicsPreview\` query:

- \`AGED_INVENTORY_SURCHARGE\`: Aged Inventory Surcharge, previously known as the Long-term Storage Fee
- \`BASE_FBA_FULFILLMENT_FEE\`: Fulfillment by Amazon (FBA) Fulfillment Fee, base fee
- \`BASE_MONTHLY_STORAGE_FEE\`: Monthly Inventory Storage Fee, base fee
- \`CLOSING_FEES\`: Closing Fees, also known as Variable Closing Fees
- \`FBA_FULFILLMENT_FEES\`: Fulfillment by Amazon (FBA) Fulfillment Fees, including base rate and surcharges
- \`HIGH_RETURN_RATE_FEE\`: High Return Rate Fee, also known as Returns Processing Fee for Non-apparel and Non-shoes
- \`LOW_INVENTORY_LEVEL_FEE\`: Fulfillment by Amazon (FBA) Fulfillment Fee Low Level Inventory Surcharge
- \`MONTHLY_INVENTORY_STORAGE_FEES\`: Monthly Inventory Storage Fees, including base rate and surcharges
- \`PAN_EU_OVERSIZE_FEE\`: Fulfillment by Amazon (FBA) Fulfillment Fee Pan-EU Oversize Surcharge
- \`PER_ITEM_SELLING_FEES\`: Per-item Selling Fees, also known as Fixed Closing Fee
- \`REFERRAL_FEES\`: Referral Fees
- \`RETURN_PROCESSING_FEE\`: Return Processing Fee, also known as Returns Processing Fee for apparel and shoes
- \`SPONSORED_PRODUCTS_CHARGES\`: Sponsored Products Charges
- \`STORAGE_UTILIZATION_SURCHARGE\`: Monthly Inventory Storage Fee Storage Utilization Surcharge`;
          break;
          
        case "metrics":
          schemaInfo = `
# Key Metrics in Seller Economics

## Sales Metrics
- \`orderedProductSales\`: Amount of ordered product sales (amount, currencyCode)
- \`netProductSales\`: Net product sales after refunds (amount, currencyCode)
- \`averageSellingPrice\`: Average selling price (amount, currencyCode)
- \`unitsOrdered\`: Number of units ordered
- \`unitsRefunded\`: Number of units refunded
- \`netUnitsSold\`: Net units sold (unitsOrdered - unitsRefunded)

## Fee Metrics
For each fee type:
- \`amount\`: Base fee amount before promotions and taxes
- \`promotionAmount\`: Promotional discount on the fee
- \`taxAmount\`: Tax amount on the fee
- \`totalAmount\`: Final fee amount (amount - promotionAmount + taxAmount)
- \`quantity\`: Units the fee applies to
- \`amountPerUnit\`: Fee amount per unit (totalAmount / quantity)
- \`amountPerUnitDelta\`: Change in the per-unit fee when Amazon fee changes occur

## Advertisement Metrics
For each ad type:
- \`amount\`: Base ad spend amount
- \`totalAmount\`: Final ad spend amount after adjustments

## Cost Metrics (if provided by seller)
- \`costOfGoodsSold\`: Cost to manufacture or acquire the product
- \`fbaCost.shippingToAmazonCost\`: Cost of shipping to Amazon fulfillment centers
- \`mfnCost.fulfillmentCost\`: Cost of fulfilling orders (labor, packing, shipping to customer)
- \`mfnCost.storageCost\`: Cost to store inventory

## Profitability Metrics
- \`netProceeds.total\`: Total net profit (sales - fees - ads - costs)
- \`netProceeds.perUnit\`: Net profit per unit sold

## Important Notes
- All monetary values include both amount and currencyCode
- Cost metrics are only available if you've provided them in SKU Central or the Revenue Calculator
- Net proceeds calculation varies based on whether you're using FBA or MFN
- Component breakdowns for certain fees provide visibility into fee structures`;
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

  // Tool to build economics queries
  server.tool(
    "build-economics-query",
    "Build a GraphQL query for seller economics data based on parameters",
    {
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date in YYYY-MM-DD format"),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End date in YYYY-MM-DD format"),
      dateGranularity: z.enum(["DAY", "WEEK", "MONTH", "RANGE"]).describe("How to aggregate by date"),
      productIdGranularity: z.enum(["PARENT_ASIN", "CHILD_ASIN", "FNSKU", "MSKU"]).describe("How to aggregate by product"),
      marketplace: z.enum(["US", "CA", "MX", "UK", "DE", "FR", "IT", "ES", "JP", "AU"]).describe("Marketplace to get data for"),
      includeFeeComponents: z.boolean().default(false).describe("Whether to include fee component breakdowns"),
      feeTypesForComponents: z.array(z.enum(["FBA_FULFILLMENT_FEE", "FBA_STORAGE_FEE"])).optional().describe("Fee types to include components for (if includeFeeComponents is true)")
    },
    async (params) => {
      try {
        // Get the marketplace ID
        const marketplaceId = MARKETPLACES[params.marketplace];
        
        // Validate fee components parameter
        const feeTypes = params.includeFeeComponents && params.feeTypesForComponents ? 
                        params.feeTypesForComponents : [];
        
        const query = buildEconomicsQuery(
          params.startDate,
          params.endDate,
          params.dateGranularity,
          params.productIdGranularity,
          [marketplaceId],
          params.includeFeeComponents,
          feeTypes
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
              text: formatErrorMessage(error, "building economics query")
            }
          ]
        };
      }
    }
  );
  
  // Tool to build economics preview queries
  server.tool(
    "build-economics-preview-query",
    "Build a GraphQL query to preview future seller economics based on fee changes",
    {
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date in YYYY-MM-DD format (must not be earlier than today)"),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End date in YYYY-MM-DD format (must not be more than 30 days after today)"),
      marketplace: z.enum(["US", "CA", "MX", "UK", "DE", "FR", "IT", "ES", "JP", "AU"]).describe("Marketplace to get data for"),
      feeTypes: z.array(z.enum([
        "AGED_INVENTORY_SURCHARGE",
        "BASE_FBA_FULFILLMENT_FEE",
        "BASE_MONTHLY_STORAGE_FEE",
        "CLOSING_FEES",
        "FBA_FULFILLMENT_FEES",
        "HIGH_RETURN_RATE_FEE",
        "LOW_INVENTORY_LEVEL_FEE",
        "MONTHLY_INVENTORY_STORAGE_FEES",
        "PAN_EU_OVERSIZE_FEE",
        "PER_ITEM_SELLING_FEES",
        "REFERRAL_FEES",
        "RETURN_PROCESSING_FEE",
        "SPONSORED_PRODUCTS_CHARGES",
        "STORAGE_UTILIZATION_SURCHARGE"
      ])).min(1).describe("Fee types to include in the preview")
    },
    async (params) => {
      try {
        // Get the marketplace ID
        const marketplaceId = MARKETPLACES[params.marketplace];
        
        const query = buildEconomicsPreviewQuery(
          params.startDate,
          params.endDate,
          [marketplaceId],
          params.feeTypes
        );

        return {
          content: [
            {
              type: "text",
              text: `Generated GraphQL Query for ${params.marketplace} marketplace fee preview:\n\n${query}\n\nYou can use this with the 'create-query' tool to submit this query to the Data Kiosk API.`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: formatErrorMessage(error, "building economics preview query")
            }
          ]
        };
      }
    }
  );
  
  // Tool to get example queries for economics
  server.tool(
    "get-economics-example",
    "Get example GraphQL queries for seller economics data",
    {
      queryType: z.enum([
        "profitabilityAnalysis", 
        "feeBreakdown",
        "feeChangeImpact",
        "costAnalysis",
        "futureImpact"
      ]).describe("Type of example query needed")
    },
    async ({ queryType }) => {
      let exampleQuery = "";
      let schemaInfo = "";
      
      switch (queryType) {
        case "profitabilityAnalysis":
          exampleQuery = `query ProfitabilityAnalysisQuery {
  analytics_economics_2024_03_15 {
    economics(
      startDate: "2025-01-01"
      endDate: "2025-03-31"
      aggregateBy: {
        date: MONTH
        productId: MSKU
      }
      marketplaceIds: ["ATVPDKIKX0DER"]  # US marketplace
    ) {
      startDate
      endDate
      marketplaceId
      parentAsin
      childAsin
      msku
      
      # Sales data
      sales {
        orderedProductSales {
          amount
          currencyCode
        }
        netProductSales {
          amount
          currencyCode
        }
        netUnitsSold
        averageSellingPrice {
          amount
          currencyCode
        }
      }
      
      # Fees summary (total by fee type)
      fees {
        feeTypeName
        charges {
          aggregatedDetail {
            totalAmount {
              amount
              currencyCode
            }
          }
        }
      }
      
      # Ads summary
      ads {
        adTypeName
        charge {
          aggregatedDetail {
            totalAmount {
              amount
              currencyCode
            }
          }
        }
      }
      
      # Cost data (if provided)
      cost {
        costOfGoodsSold {
          amount
          currencyCode
        }
      }
      
      # Net proceeds (profitability)
      netProceeds {
        total {
          amount
          currencyCode
        }
        perUnit {
          amount
          currencyCode
        }
      }
    }
  }
}`;
          schemaInfo = `
This query provides a comprehensive profitability analysis by MSKU (Merchant SKU) and month for Q1 2025. It returns:

- **Sales data**: ordered sales, net sales after refunds, net units sold, average selling price
- **Fee summary**: total amount for each fee type
- **Advertising costs**: total amount for each ad type
- **Product costs**: cost of goods sold (if provided by the seller)
- **Net proceeds**: total profitability and profit per unit

This query is particularly useful for:
- Analyzing profitability trends over time
- Identifying your most and least profitable products
- Understanding the impact of fees and advertising on your bottom line
- Making data-driven decisions about product pricing and optimization`;
          break;
          
        case "feeBreakdown":
          exampleQuery = `query FeeBreakdownQuery {
  analytics_economics_2024_03_15 {
    economics(
      startDate: "2025-03-01"
      endDate: "2025-03-31"
      aggregateBy: {
        date: RANGE
        productId: MSKU
      }
      marketplaceIds: ["ATVPDKIKX0DER"]  # US marketplace
      includeComponentsForFeeTypes: [FBA_FULFILLMENT_FEE, FBA_STORAGE_FEE]
    ) {
      startDate
      endDate
      marketplaceId
      parentAsin
      childAsin
      msku
      
      # Sales data
      sales {
        netUnitsSold
      }
      
      # Detailed fee breakdown
      fees {
        feeTypeName
        charges {
          aggregatedDetail {
            amount {
              amount
              currencyCode
            }
            amountPerUnit {
              amount
              currencyCode
            }
            promotionAmount {
              amount
              currencyCode
            }
            taxAmount {
              amount
              currencyCode
            }
            totalAmount {
              amount
              currencyCode
            }
            quantity
          }
          
          # Component breakdown
          components {
            name
            aggregatedDetail {
              amount {
                amount
                currencyCode
              }
              totalAmount {
                amount
                currencyCode
              }
            }
          }
          
          # Properties used in fee calculation
          properties {
            propertyName
            propertyValue
          }
        }
      }
    }
  }
}`;
          schemaInfo = `
This query provides a detailed breakdown of FBA Fulfillment Fees and FBA Storage Fees for March 2025. It returns:

- **Fee calculation details**: base amount, per-unit amount, promotions, taxes, and final total
- **Fee components**: breakdown of each fee into its component parts
- **Fee properties**: the attributes used to calculate the fees (e.g., product size tier)

Key components you'll see for FBA Fulfillment Fees include:
- Base fulfillment fee
- Weight handling surcharges
- Size tier adjustments
- Peak season surcharges (if applicable)

For FBA Storage Fees:
- Base storage fee
- Long-term storage components
- Size tier adjustments
- Dangerous goods surcharges (if applicable)

This query is valuable for:
- Understanding exactly what you're paying for in each fee
- Identifying opportunities to optimize your products to reduce fees
- Verifying that the correct fee structure is being applied to your products
- Planning for fee changes and their impact on specific fee components`;
          break;
          
        case "feeChangeImpact":
          exampleQuery = `query FeeChangeImpactQuery {
  analytics_economics_2024_03_15 {
    economics(
      startDate: "2025-03-01"
      endDate: "2025-03-31"
      aggregateBy: {
        date: RANGE
        productId: MSKU
      }
      marketplaceIds: ["ATVPDKIKX0DER"]  # US marketplace
    ) {
      startDate
      endDate
      marketplaceId
      parentAsin
      childAsin
      msku
      
      # Sales data
      sales {
        netUnitsSold
        averageSellingPrice {
          amount
          currencyCode
        }
      }
      
      # Fees with change tracking
      fees {
        feeTypeName
        charges {
          # Start and end dates show if a fee changed during the period
          startDate
          endDate
          
          aggregatedDetail {
            amount {
              amount
              currencyCode
            }
            amountPerUnit {
              amount
              currencyCode
            }
            # Delta shows the change in the per-unit fee
            amountPerUnitDelta {
              amount
              currencyCode
            }
            totalAmount {
              amount
              currencyCode
            }
          }
          
          # Properties affecting the fee
          properties {
            propertyName
            propertyValue
          }
        }
      }
      
      # Net proceeds
      netProceeds {
        perUnit {
          amount
          currencyCode
        }
      }
    }
  }
}`;
          schemaInfo = `
This query is specifically designed to analyze the impact of fee changes during March 2025. It returns:

- **Fee periods**: start and end dates for each fee, which will differ if fees changed mid-period
- **Per-unit fee changes**: the amountPerUnitDelta shows the exact change in fees on a per-unit basis
- **Properties affecting fees**: the attributes that determine fee calculations
- **Profitability impact**: per-unit net proceeds to see the bottom-line impact

Key fields to focus on:
- \`startDate\` and \`endDate\` within the charges block show exactly when a fee changed
- \`amountPerUnitDelta\` shows the specific change in the per-unit fee amount
- \`properties\` reveal which product attributes are affecting the fee calculation

This query is valuable for:
- Identifying exactly when fee changes occurred
- Quantifying the exact impact of fee changes on a per-unit basis
- Understanding which products were most affected by fee changes
- Planning price adjustments to maintain margin after fee changes`;
          break;
          
        case "costAnalysis":
          exampleQuery = `query CostAnalysisQuery {
  analytics_economics_2024_03_15 {
    economics(
      startDate: "2025-01-01"
      endDate: "2025-03-31"
      aggregateBy: {
        date: MONTH
        productId: MSKU
      }
      marketplaceIds: ["ATVPDKIKX0DER"]  # US marketplace
    ) {
      startDate
      endDate
      marketplaceId
      parentAsin
      childAsin
      msku
      
      # Sales data
      sales {
        netUnitsSold
        averageSellingPrice {
          amount
          currencyCode
        }
      }
      
      # Detailed cost breakdown
      cost {
        # Cost of manufacturing or acquiring the product
        costOfGoodsSold {
          amount
          currencyCode
        }
        
        # FBA-specific costs
        fbaCost {
          shippingToAmazonCost {
            amount
            currencyCode
          }
        }
        
        # Self-fulfilled costs
        mfnCost {
          fulfillmentCost {
            amount
            currencyCode
          }
          storageCost {
            amount
            currencyCode
          }
        }
        
        # Other costs
        miscellaneousCost {
          amount
          currencyCode
        }
      }
      
      # Fee summary by fee type
      fees {
        feeTypeName
        charges {
          aggregatedDetail {
            totalAmount {
              amount
              currencyCode
            }
          }
        }
      }
      
      # Net proceeds
      netProceeds {
        total {
          amount
          currencyCode
        }
        perUnit {
          amount
          currencyCode
        }
      }
    }
  }
}`;
          schemaInfo = `
This query focuses on analyzing all cost elements affecting your products for Q1 2025, broken down by month and MSKU. It returns:

- **Product costs**: Cost of Goods Sold (COGS) for each product
- **Fulfillment costs**: Both FBA and self-fulfilled cost structures
  - FBA: Costs to ship inventory to Amazon
  - Self-fulfilled: Fulfillment costs and storage costs
- **Other costs**: Miscellaneous costs not directly tied to specific products
- **Amazon fees**: Summary of all fee types charged
- **Profitability**: Net proceeds total and per unit after all costs

Note that cost data is only available if you've provided it in:
- SKU Central (https://sellercentral.amazon.com/skucentral)
- Revenue Calculator (https://sellercentral.amazon.com/revcal)

This query is valuable for:
- Identifying your true Cost of Goods Sold with all fulfillment factors
- Comparing profitability between FBA and self-fulfilled products
- Tracking cost trends over time
- Finding opportunities to optimize your cost structure
- Making informed decisions about pricing and fulfillment methods`;
          break;
          
        case "futureImpact":
          exampleQuery = `query FutureImpactPreviewQuery {
  analytics_economics_2024_03_15 {
    economicsPreview(
      startDate: "2025-04-01"
      endDate: "2025-04-30"
      aggregateBy: {
        date: RANGE
        productId: MSKU
      }
      marketplaceIds: ["ATVPDKIKX0DER"]  # US marketplace
      feeTypes: [
        BASE_FBA_FULFILLMENT_FEE,
        MONTHLY_INVENTORY_STORAGE_FEES,
        REFERRAL_FEES
      ]
    ) {
      startDate
      endDate
      marketplaceId
      parentAsin
      childAsin
      msku
      
      # Projected sales
      sales {
        orderedProductSales {
          amount
          currencyCode
        }
        netProductSales {
          amount
          currencyCode
        }
        unitsOrdered
      }
      
      # Preview of future fees
      fees {
        feeTypeName
        charges {
          aggregatedDetail {
            amount {
              amount
              currencyCode
            }
            amountPerUnit {
              amount
              currencyCode
            }
            totalAmount {
              amount
              currencyCode
            }
            quantity
          }
        }
      }
      
      # Projected profitability
      netProceeds {
        total {
          amount
          currencyCode
        }
        perUnit {
          amount
          currencyCode
        }
      }
    }
  }
}`;
          schemaInfo = `
This query previews the impact of potential fee changes for April 2025, focusing on three key fee types: FBA Fulfillment Fees, Monthly Storage Fees, and Referral Fees. It returns:

- **Projected sales**: Expected sales and units based on historical patterns
- **Future fee preview**: How the selected fee types will apply in the future period
- **Projected profitability**: Estimated net proceeds with the new fee structure

Important limitations of economicsPreview:
- The start date must not be earlier than today
- The end date must not be more than 30 days after today
- Only RANGE date aggregation is supported
- Only MSKU product aggregation is supported
- You must specifically select which fee types to preview

This query is valuable for:
- Planning for upcoming fee changes
- Assessing the impact of fee promotions
- Evaluating pricing strategies to maintain margins
- Making inventory decisions based on storage fee projections
- Preparing for seasonal fee variations

To use this most effectively, compare the preview results with your current period to see the projected change in your business economics.`;
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