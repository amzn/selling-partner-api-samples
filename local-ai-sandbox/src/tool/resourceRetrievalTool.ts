import { tool } from "@strands-agents/sdk";
import { Api } from "../database/Context.js";
import z from "zod";
import * as fs from "node:fs";

export const resourceRetrievalTool = tool({
  name: "resource_retrieval",
  description: "Retrieves resources for a given Api",
  inputSchema: z.object({
    api: z.enum(Api),
  }),
  callback: (input) => {
    console.warn(`Model retrieval for api ${input.api}`);
    const modelMap: Record<string, string> = {
      [Api.ORDERS]: "./res/models/orders_2026-01-01.json",
      [Api.INVENTORY]: "./res/models/fbaInventory_v1.json",
      [Api.EXT_FULFILLMENT_INVENTORY]: "./res/models/externalFulfillmentInventory_2024-09-11.json",
      [Api.EXT_FULFILLMENT_RETURNS]: "./res/models/externalFulfillmentReturns_2024-09-11.json",
      [Api.EXT_FULFILLMENT_SHIPMENTS]: "./res/models/externalFulfillmentShipments_2024-09-11.json",
      [Api.CATALOG]: "./res/models/catalogItems_2022-04-01.json",
      [Api.PRICING]: "./res/models/productPricing_2022-05-01.json",
      // Add additional resource mappings here
      // [Api.LISTINGS]: "./res/pt-definitions/PRODUCT.json",
    };
    const path = modelMap[input.api];
    return path ? fs.readFileSync(path, "utf8") : "No model found";
  },
});
