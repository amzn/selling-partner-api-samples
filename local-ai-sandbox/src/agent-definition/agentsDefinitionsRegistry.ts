import { DeleteListingsItem, GetListingsItem, PatchListingsItem, PutListingsItem, SearchListingsItems } from "./listingsAgentsDefinitions.js";
import { Request } from "express";
import { ConfirmShipment, GetOrder, SearchOrders } from "./ordersAgentsDefinitions.js";
import { BatchInventory } from "./extFulfillmentInventoryAgentsDefinitions.js";
import { ListReturns, GetReturn } from "./extFulfillmentReturnsAgentsDefinitions.js";
import {
  GetShipments,
  GetShipment,
  ProcessShipment,
  CreatePackages,
  UpdatePackage,
  UpdatePackageStatus,
  RetrieveShippingOptions,
  RetrieveInvoice,
  GenerateInvoice,
  GenerateShipLabels,
} from "./extFulfillmentShipmentsAgentsDefinitions.js";
import { GetCatalogItem, SearchCatalogItems } from "./catalogItemsAgentsDefinitions.js";
import { GetFeaturedOfferExpectedPriceBatch } from "./pricingAgentsDefinitions.js";

export const AGENTS_DEFINITIONS_REGISTRY = new Map<string, any>([
  ["getListingsItem", new GetListingsItem()],
  ["searchListingsItems", new SearchListingsItems()],
  ["putListingsItem", new PutListingsItem()],
  ["patchListingsItem", new PatchListingsItem()],
  ["deleteListingsItem", new DeleteListingsItem()],
  ["confirmShipment", new ConfirmShipment()],
  ["searchOrders", new SearchOrders()],
  ["getOrder", new GetOrder()],
  ["batchInventory", new BatchInventory()],
  ["listReturns", new ListReturns()],
  ["getReturn", new GetReturn()],
  ["getShipments", new GetShipments()],
  ["getShipment", new GetShipment()],
  ["processShipment", new ProcessShipment()],
  ["createPackages", new CreatePackages()],
  ["updatePackage", new UpdatePackage()],
  ["updatePackageStatus", new UpdatePackageStatus()],
  ["retrieveShippingOptions", new RetrieveShippingOptions()],
  ["retrieveInvoice", new RetrieveInvoice()],
  ["generateInvoice", new GenerateInvoice()],
  ["generateShipLabels", new GenerateShipLabels()],
  ["getCatalogItem", new GetCatalogItem()],
  ["searchCatalogItems", new SearchCatalogItems()],
  ["getFeaturedOfferExpectedPriceBatch", new GetFeaturedOfferExpectedPriceBatch()],
]);

export abstract class AgentDefinition {
  abstract tools: any[];
  abstract instructions: (request: Request, result: any) => string;
}
