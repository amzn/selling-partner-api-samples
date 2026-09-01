import type { OperationHandler } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";
import { Paginator } from "../service/Paginator.js";

const inventoryPaginator = new Paginator({ defaultPageSize: 50, maxPageSize: 50 });

/**
 * Handler for FBA Inventory v1 getInventorySummaries.
 * Queries the INVENTORY namespace with SKU/date filtering, pagination, and detail toggle.
 */
export const getInventorySummariesHandler: OperationHandler = async (validationResult) => {
  const qp = validationResult.queryParams;

  // Extract query params
  const sellerSkus = qp.sellerSkus as string | string[] | undefined;
  const sellerSku = qp.sellerSku as string | undefined;
  const startDateTime = qp.startDateTime as string | undefined;
  const granularityType = qp.granularityType as string;
  const granularityId = qp.granularityId as string;
  const details = qp.details as string | undefined;
  const nextToken = qp.nextToken as string | undefined;

  // Query all items from the INVENTORY namespace
  const allItems = Context.instance.engine.find(Api.INVENTORY, {});

  // Determine filter strategy by priority: startDateTime > sellerSkus > sellerSku > all
  let filterPredicate: (item: Record<string, unknown>) => boolean;

  if (startDateTime) {
    // Filter by lastUpdatedTime strictly after startDateTime
    const startTime = new Date(startDateTime).getTime();
    filterPredicate = (item) => {
      const lastUpdated = item.lastUpdatedTime as string | undefined;
      if (!lastUpdated) return false;
      return new Date(lastUpdated).getTime() > startTime;
    };
  } else if (sellerSkus) {
    // Parse sellerSkus (may be array or comma-separated string)
    const skuList = Array.isArray(sellerSkus) ? sellerSkus : sellerSkus.split(",").filter((s) => s !== "");
    filterPredicate = (item) => {
      const sku = item.sellerSku as string | undefined;
      return sku !== undefined && skuList.includes(sku);
    };
  } else if (sellerSku) {
    filterPredicate = (item) => item.sellerSku === sellerSku;
  } else {
    // No filter — return all items
    filterPredicate = () => true;
  }

  // Apply filter
  const filteredItems = allItems.filter(filterPredicate);

  // Apply details toggle: strip inventoryDetails when details is not "true"
  const items = filteredItems.map((item) => {
    const copy = { ...item };
    if (details !== "true") {
      delete copy.inventoryDetails;
    }
    return copy;
  });

  // Apply pagination
  const paginationResult = inventoryPaginator.paginate(items, { pageToken: nextToken });

  // Build response body
  const responseBody: Record<string, unknown> = {
    payload: {
      granularity: {
        granularityType,
        granularityId,
      },
      inventorySummaries: paginationResult.page,
    },
  };

  // Include pagination.nextToken when more pages exist
  if (paginationResult.nextToken) {
    responseBody.pagination = {
      nextToken: paginationResult.nextToken,
    };
  }

  return {
    statusCode: 200,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: responseBody },
  };
};
