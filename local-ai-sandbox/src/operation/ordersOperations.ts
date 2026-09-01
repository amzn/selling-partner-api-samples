import { OperationHandler } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";

// --- includedData filtering logic for getOrder ---

const ORDER_BASE_KEYS = ["orderId", "orderAliases", "createdTime", "lastUpdatedTime", "programs", "associatedOrders", "salesChannel", "orderItems"];

const ORDER_ITEM_BASE_KEYS = ["orderItemId", "quantityOrdered", "measurement", "associatedOrderItems", "programs", "product"];

interface IncludedDataMapping {
  orderKeys: string[];
  orderItemKeys: string[];
}

const INCLUDED_DATA_MAP: Record<string, IncludedDataMapping> = {
  BUYER: { orderKeys: ["buyer"], orderItemKeys: [] },
  RECIPIENT: { orderKeys: ["recipient"], orderItemKeys: [] },
  FULFILLMENT: { orderKeys: ["fulfillment"], orderItemKeys: ["fulfillment"] },
  PROCEEDS: { orderKeys: ["proceeds"], orderItemKeys: ["proceeds"] },
  EXPENSE: { orderKeys: [], orderItemKeys: ["expense"] },
  PROMOTION: { orderKeys: [], orderItemKeys: ["promotion"] },
  CANCELLATION: { orderKeys: [], orderItemKeys: ["cancellation"] },
  PACKAGES: { orderKeys: ["packages"], orderItemKeys: [] },
  TAX: { orderKeys: ["tax"], orderItemKeys: ["tax"] },
  PAYMENT: { orderKeys: ["payment"], orderItemKeys: [] },
};

function pickKeys(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

function filterOrder(order: Record<string, unknown>, includedData: string[]): Record<string, unknown> {
  // Determine allowed keys at order and order-item levels
  const allowedOrderKeys = new Set<string>(ORDER_BASE_KEYS);
  const allowedItemKeys = new Set<string>(ORDER_ITEM_BASE_KEYS);

  for (const attr of includedData) {
    const mapping = INCLUDED_DATA_MAP[attr.toUpperCase()];
    if (mapping) {
      for (const k of mapping.orderKeys) allowedOrderKeys.add(k);
      for (const k of mapping.orderItemKeys) allowedItemKeys.add(k);
    }
  }

  // Filter order-level keys
  const filtered = pickKeys(order, [...allowedOrderKeys]);

  // Filter each order item if present
  if (Array.isArray(filtered.orderItems)) {
    filtered.orderItems = (filtered.orderItems as Record<string, unknown>[]).map((item) => pickKeys(item, [...allowedItemKeys]));
  }

  return filtered;
}

// --- Handlers ---

export const getOrderHandler: OperationHandler = async (validationResult) => {
  const orderId = validationResult.pathParams.orderId;
  const order = Context.instance.engine.get(Api.ORDERS, orderId);

  if (!order) {
    return {
      statusCode: 404,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body: undefined,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "NotFound", message: `Order ${orderId} not found.` }] } },
    };
  }

  const includedDataParam = validationResult.queryParams.includedData;
  let resultOrder: Record<string, unknown>;

  if (includedDataParam) {
    const includedData = Array.isArray(includedDataParam) ? includedDataParam : [includedDataParam];
    resultOrder = filterOrder(order, includedData);
  } else {
    // No includedData specified — return only base keys
    resultOrder = filterOrder(order, []);
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
    data: { body: { order: resultOrder } },
  };
};

// --- searchOrders handler ---

function buildQuery(queryParams: Record<string, unknown>): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [];

  const createdAfter = queryParams.createdAfter as string | undefined;
  const createdBefore = queryParams.createdBefore as string | undefined;
  const lastUpdatedAfter = queryParams.lastUpdatedAfter as string | undefined;
  const lastUpdatedBefore = queryParams.lastUpdatedBefore as string | undefined;
  const fulfillmentStatus = queryParams.fulfillmentStatus as string | string[] | undefined;
  const marketplaceIds = queryParams.marketplaceIds as string | string[] | undefined;
  const fulfilledBy = queryParams.fulfilledBy as string | string[] | undefined;

  // createdTime range filter
  if (createdAfter || createdBefore) {
    const dateCondition: Record<string, unknown> = {};
    if (createdAfter) dateCondition["$gte"] = createdAfter;
    if (createdBefore) dateCondition["$lte"] = createdBefore;
    conditions.push({ createdTime: dateCondition });
  }

  // lastUpdatedTime range filter
  if (lastUpdatedAfter || lastUpdatedBefore) {
    const dateCondition: Record<string, unknown> = {};
    if (lastUpdatedAfter) dateCondition["$gte"] = lastUpdatedAfter;
    if (lastUpdatedBefore) dateCondition["$lte"] = lastUpdatedBefore;
    conditions.push({ lastUpdatedTime: dateCondition });
  }

  // fulfillment.fulfillmentStatus filter
  if (fulfillmentStatus) {
    const statuses = Array.isArray(fulfillmentStatus) ? fulfillmentStatus : [fulfillmentStatus];
    conditions.push({ "fulfillment.fulfillmentStatus": { $in: statuses } });
  }

  // salesChannel.marketplaceId filter
  if (marketplaceIds) {
    const ids = Array.isArray(marketplaceIds) ? marketplaceIds : [marketplaceIds];
    conditions.push({ "salesChannel.marketplaceId": { $in: ids } });
  }

  // fulfillment.fulfilledBy filter
  if (fulfilledBy) {
    const values = Array.isArray(fulfilledBy) ? fulfilledBy : [fulfilledBy];
    conditions.push({ "fulfillment.fulfilledBy": { $in: values } });
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}

export const searchOrdersHandler: OperationHandler = async (validationResult) => {
  const { queryParams } = validationResult;
  const includedDataParam = queryParams.includedData as string | string[] | undefined;

  const collection = Context.instance.engine.find(Api.ORDERS, buildQuery(queryParams));
  if (!collection) {
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
      data: { body: { orders: [] } },
    };
  }

  // Apply includedData filtering (base keys only when not specified)
  let resultOrders: Record<string, unknown>[];
  if (includedDataParam) {
    const includedData = Array.isArray(includedDataParam) ? includedDataParam : [includedDataParam];
    resultOrders = collection.map((order) => filterOrder(order, includedData));
  } else {
    resultOrders = collection.map((order) => filterOrder(order, []));
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
    data: { body: { orders: resultOrders } },
  };
};

interface PackageDetailOrderItem {
  orderItemId: string;
  quantity: number;
}

interface PackageDetail {
  packageReferenceId: string;
  carrierCode?: string;
  carrierName?: string;
  shipDate?: string;
  shippingMethod?: string;
  trackingNumber?: string;
  orderItems: PackageDetailOrderItem[];
}

interface ConfirmShipmentBody {
  packageDetail: PackageDetail;
}

interface OrderItemFulfillment {
  quantityFulfilled?: number;
  quantityUnfulfilled?: number;
  [key: string]: unknown;
}

interface OrderItem {
  orderItemId: string;
  quantityOrdered?: number;
  fulfillment?: OrderItemFulfillment;
  [key: string]: unknown;
}

interface PackageItem {
  orderItemId: string;
  quantity: number;
}

interface OrderPackage {
  packageReferenceId: string;
  createdTime: string;
  carrier: { carrierCode?: string; carrierName?: string };
  shipTime?: string;
  shippingService?: string;
  trackingNumber?: string;
  packageStatus: { status: string };
  packageItems: PackageItem[];
}

export const confirmShipmentHandler: OperationHandler = async (validationResult, request) => {
  const orderId = validationResult.pathParams.orderId;
  const existingOrder = structuredClone(validationResult.resolvedEntities.order) as Record<string, unknown>;
  const body = request.body as ConfirmShipmentBody;
  const packageDetail = body.packageDetail;
  const now = new Date().toISOString();

  // --- Update orderItems fulfillment quantities ---
  const orderItems = (existingOrder.orderItems as OrderItem[]) ?? [];
  const shippedQuantityMap = new Map<string, number>();
  for (const pkgItem of packageDetail.orderItems) {
    shippedQuantityMap.set(pkgItem.orderItemId, (shippedQuantityMap.get(pkgItem.orderItemId) ?? 0) + pkgItem.quantity);
  }

  for (const item of orderItems) {
    const shippedQty = shippedQuantityMap.get(item.orderItemId);
    if (shippedQty != null) {
      if (!item.fulfillment) {
        const quantityOrdered = (item.quantityOrdered as number) ?? 0;
        item.fulfillment = { quantityFulfilled: 0, quantityUnfulfilled: quantityOrdered };
      }
      item.fulfillment.quantityFulfilled = (item.fulfillment.quantityFulfilled ?? 0) + shippedQty;
      item.fulfillment.quantityUnfulfilled = (item.fulfillment.quantityUnfulfilled ?? 0) - shippedQty;
    }
  }
  existingOrder.orderItems = orderItems;

  // --- Build the new package entry ---
  const newPackage: OrderPackage = {
    packageReferenceId: packageDetail.packageReferenceId,
    createdTime: now,
    carrier: {
      carrierCode: packageDetail.carrierCode,
      carrierName: packageDetail.carrierName,
    },
    shipTime: packageDetail.shipDate,
    shippingService: packageDetail.shippingMethod,
    trackingNumber: packageDetail.trackingNumber,
    packageStatus: { status: "SHIPPED" },
    packageItems: packageDetail.orderItems.map((pi) => ({
      orderItemId: pi.orderItemId,
      quantity: pi.quantity,
    })),
  };

  const packages = (existingOrder.packages as OrderPackage[]) ?? [];
  packages.push(newPackage);
  existingOrder.packages = packages;

  // --- Update lastUpdatedTime ---
  existingOrder.lastUpdatedTime = now;

  // --- Determine overall fulfillment status ---
  const allFulfilled = orderItems.every((item) => item.fulfillment != null && (item.fulfillment.quantityUnfulfilled ?? 0) <= 0);
  const fulfillment = (existingOrder.fulfillment as Record<string, unknown>) ?? {};
  fulfillment.fulfillmentStatus = allFulfilled ? "SHIPPED" : "PARTIALLY_SHIPPED";
  existingOrder.fulfillment = fulfillment;

  // Write updated order to database
  Context.instance.engine.put(Api.ORDERS, orderId, existingOrder);

  return {
    statusCode: 204,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: request.body as Record<string, unknown>,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: {},
    writes: [{ type: "update", api: Api.ORDERS, id: orderId, entity: existingOrder }],
  };
};