export const identifyApiModel = (path: string): string | undefined => {
  const model = [...models.entries()].find((entry) => path.includes(entry[0]));
  return model ? model[1] : undefined;
};

const models = new Map<string, string>([
  ["/listings/2021-08-01/items", "listingsItems_2021-08-01.json"],
  ["/orders/v0", "ordersV0.json"],
  ["/orders/2026-01-01", "orders_2026-01-01.json"],
  ["/fba/inventory/v1", "fbaInventory_v1.json"],
  ["/externalFulfillment/inventory/2024-09-11", "externalFulfillmentInventory_2024-09-11.json"],
  ["/externalFulfillment/2024-09-11/returns", "externalFulfillmentReturns_2024-09-11.json"],
  ["/externalFulfillment/2024-09-11/shipments", "externalFulfillmentShipments_2024-09-11.json"],
  ["/catalog/2022-04-01/items", "catalogItems_2022-04-01.json"],
  ["/batches/products/pricing/2022-05-01", "productPricing_2022-05-01.json"],
  ["/reports/2021-06-30", "reports_2021-06-30.json"],
]);
