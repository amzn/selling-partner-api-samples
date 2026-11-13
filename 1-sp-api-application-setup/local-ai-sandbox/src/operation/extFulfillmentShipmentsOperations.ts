import type { OperationHandler } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";
import { Paginator } from "../service/Paginator.js";

const shipmentsPaginator = new Paginator({ defaultPageSize: 10, maxPageSize: 100 });

/**
 * Handler for External Fulfillment Shipments v2024-09-11 processShipment.
 * Reads the resolved entity, applies CONFIRM or REJECT status transition,
 * processes lineItem cancellations for REJECT, updates timestamp, and persists.
 */
export const processShipmentHandler: OperationHandler = async (validationResult) => {
  const entity = validationResult.resolvedEntities["shipment"];

  if (entity === undefined) {
    return {
      statusCode: 500,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body: undefined,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "InternalError", message: "Resolved entity 'shipment' is not available" }] } },
    };
  }

  const operation = validationResult.queryParams.operation as string;

  if (operation === "CONFIRM") {
    entity.status = "CONFIRMED";
  } else if (operation === "REJECT") {
    entity.status = "CANCELLED";

    const body = validationResult.body as Record<string, unknown> | undefined;
    const lineItems = body?.lineItems as Array<{ lineItem: { id: string; quantity: number }; reason: string }> | undefined;

    if (lineItems && Array.isArray(lineItems)) {
      const entityLineItems = entity.lineItems as Array<Record<string, unknown>> | undefined;

      if (entityLineItems && Array.isArray(entityLineItems)) {
        for (const entry of lineItems) {
          const matchingLineItem = entityLineItems.find((li) => li.id === entry.lineItem.id);
          if (matchingLineItem) {
            if (!Array.isArray(matchingLineItem.cancellations)) {
              matchingLineItem.cancellations = [];
            }
            (matchingLineItem.cancellations as Array<Record<string, unknown>>).push({
              reason: entry.reason,
              cancelledQuantity: entry.lineItem.quantity,
              cancelledAt: new Date().toISOString(),
            });
          }
          // Non-matching IDs are skipped silently
        }
      }
    }
  }

  entity.lastUpdatedDateTime = new Date().toISOString();
  Context.instance.engine.put(Api.EXT_FULFILLMENT_SHIPMENTS, entity.id as string, entity);

  return {
    statusCode: 204,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: {} },
  };
};

/**
 * Handler for External Fulfillment Shipments v2024-09-11 getShipments.
 * Queries the EXT_FULFILLMENT_SHIPMENTS namespace with exact-match and date-range filtering, plus pagination.
 */
export const getShipmentsHandler: OperationHandler = async (validationResult) => {
  const qp = validationResult.queryParams;

  // Extract query params
  const status = qp.status as string | undefined;
  const locationId = qp.locationId as string | undefined;
  const marketplaceId = qp.marketplaceId as string | undefined;
  const channelName = qp.channelName as string | undefined;
  const lastUpdatedAfter = qp.lastUpdatedAfter as string | undefined;
  const lastUpdatedBefore = qp.lastUpdatedBefore as string | undefined;
  const maxResultsRaw = qp.maxResults as string | undefined;
  const paginationToken = qp.paginationToken as string | undefined;

  // Query all records from the EXT_FULFILLMENT_SHIPMENTS namespace
  const allItems = Context.instance.engine.find(Api.EXT_FULFILLMENT_SHIPMENTS, {});

  // Apply filters (all are combined as logical AND)
  let filteredItems = allItems;

  if (status !== undefined) {
    filteredItems = filteredItems.filter((item) => item.status === status);
  }

  if (locationId !== undefined) {
    filteredItems = filteredItems.filter((item) => item.locationId === locationId);
  }

  if (marketplaceId !== undefined) {
    filteredItems = filteredItems.filter((item) => {
      const marketplaceAttributes = item.marketplaceAttributes as Record<string, unknown> | undefined;
      return marketplaceAttributes?.marketplaceId === marketplaceId;
    });
  }

  if (channelName !== undefined) {
    filteredItems = filteredItems.filter((item) => {
      const marketplaceAttributes = item.marketplaceAttributes as Record<string, unknown> | undefined;
      return marketplaceAttributes?.channelName === channelName;
    });
  }

  if (lastUpdatedAfter !== undefined) {
    const afterTime = new Date(lastUpdatedAfter).getTime();
    filteredItems = filteredItems.filter((item) => {
      const lastUpdatedDateTime = item.lastUpdatedDateTime as string | undefined;
      if (!lastUpdatedDateTime) return false;
      return new Date(lastUpdatedDateTime).getTime() > afterTime;
    });
  }

  if (lastUpdatedBefore !== undefined) {
    const beforeTime = new Date(lastUpdatedBefore).getTime();
    filteredItems = filteredItems.filter((item) => {
      const lastUpdatedDateTime = item.lastUpdatedDateTime as string | undefined;
      if (!lastUpdatedDateTime) return false;
      return new Date(lastUpdatedDateTime).getTime() < beforeTime;
    });
  }

  // Apply pagination
  const paginationResult = shipmentsPaginator.paginate(filteredItems, { pageSize: maxResultsRaw, pageToken: paginationToken });

  // Strip _key from each returned item
  const shipments = paginationResult.page.map((item) => {
    const { _key, ...rest } = item;
    return rest;
  });

  // Build response body
  const responseBody: Record<string, unknown> = { shipments };

  // Include pagination.nextToken when more pages exist
  if (paginationResult.nextToken) {
    responseBody.pagination = { nextToken: paginationResult.nextToken };
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

/**
 * Handler for External Fulfillment Shipments v2024-09-11 updatePackage.
 * Finds the package by packageId path param, replaces it with the request body (preserving ID),
 * updates lastUpdatedDateTime, writes to DB, and returns 204.
 */
export const updatePackageHandler: OperationHandler = async (validationResult) => {
  const entity = validationResult.resolvedEntities["shipment"];

  if (entity === undefined) {
    return {
      statusCode: 500,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body: undefined,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "InternalError", message: "Resolved entity 'shipment' is not available" }] } },
    };
  }

  const packageId = validationResult.pathParams.packageId;
  const body = validationResult.body as Record<string, unknown>;
  const packages = entity.packages as Array<Record<string, unknown>>;

  const packageIndex = packages.findIndex((pkg) => pkg.id === packageId);
  if (packageIndex !== -1) {
    packages[packageIndex] = { ...body, id: packageId };
  }

  entity.lastUpdatedDateTime = new Date().toISOString();
  Context.instance.engine.put(Api.EXT_FULFILLMENT_SHIPMENTS, entity.id as string, entity);

  return {
    statusCode: 204,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: {} },
  };
};

/**
 * Handler for External Fulfillment Shipments v2024-09-11 getShipment.
 * Reads the pre-resolved entity from the validation pipeline and strips the internal `_key` field.
 */
export const getShipmentHandler: OperationHandler = async (validationResult) => {
  const entity = validationResult.resolvedEntities["shipment"];

  if (entity === undefined) {
    return {
      statusCode: 500,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body: undefined,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "InternalError", message: "Resolved entity 'shipment' is not available" }] } },
    };
  }

  const { _key: _, ...data } = entity;

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
    data: { body: data },
  };
};

/**
 * Handler for External Fulfillment Shipments v2024-09-11 updatePackageStatus.
 * Applies optional status, subStatus, and reason fields to the target package,
 * checks shipment-level status propagation, updates lastUpdatedDateTime, and returns 204.
 */
export const updatePackageStatusHandler: OperationHandler = async (validationResult) => {
  const entity = validationResult.resolvedEntities["shipment"];

  if (entity === undefined) {
    return {
      statusCode: 500,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body: undefined,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "InternalError", message: "Resolved entity 'shipment' is not available" }] } },
    };
  }

  const packageId = validationResult.pathParams.packageId;
  const packages = entity.packages as Array<Record<string, unknown>>;
  const pkg = packages.find((p) => p.id === packageId);

  const body = validationResult.body as Record<string, unknown> | undefined;

  // Apply optional fields from body to the target package
  if (body?.status !== undefined) {
    pkg!.status = body.status;
  }
  if (body?.subStatus !== undefined) {
    pkg!.subStatus = body.subStatus;
  }
  if (body?.reason !== undefined) {
    pkg!.reason = body.reason;
  }

  // Shipment status propagation
  const effectiveStatus = (body?.status !== undefined ? body.status : pkg!.status) as string | undefined;

  if (effectiveStatus === "SHIPPED" && packages.every((p) => p.status === "SHIPPED")) {
    entity.status = "SHIPPED";
  } else if (effectiveStatus === "DELIVERED" && packages.every((p) => p.status === "DELIVERED")) {
    entity.status = "DELIVERED";
  }

  // Update timestamp and persist
  entity.lastUpdatedDateTime = new Date().toISOString();
  Context.instance.engine.put(Api.EXT_FULFILLMENT_SHIPMENTS, entity.id as string, entity);

  return {
    statusCode: 204,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: {} },
  };
};

/**
 * Handler for External Fulfillment Shipments v2024-09-11 retrieveShippingOptions.
 * If the shipment's shippingInfo.shippingType is MARKETPLACE, returns a deterministic
 * shipping option derived from shipmentId and packageId. Otherwise returns empty options.
 */
export const retrieveShippingOptionsHandler: OperationHandler = async (validationResult) => {
  const entity = validationResult.resolvedEntities["shipment"];

  if (entity === undefined) {
    return {
      statusCode: 500,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body: undefined,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "InternalError", message: "Resolved entity 'shipment' is not available" }] } },
    };
  }

  const shipmentId = validationResult.pathParams.shipmentId;
  const packageId = validationResult.pathParams.packageId;
  const shippingInfo = entity.shippingInfo as { shippingType?: string } | undefined;

  if (shippingInfo?.shippingType === "MARKETPLACE") {
    const shippingOptionId = `so-${shipmentId}-${packageId}`;
    const option = {
      shippingOptionId,
      carrierName: "ATS",
      shipBy: "MARKETPLACE",
      pickupWindow: { startTime: "1612933142", endTime: "1612494142" },
      timeSlot: { startTime: "1612933142", endTime: "1612494142", handoverMethod: "PICKUP" },
    };

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
      data: { body: { shippingOptions: [option], recommendedShippingOption: option } },
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
    data: { body: { shippingOptions: [] } },
  };
};

/**
 * Handler for External Fulfillment Shipments v2024-09-11 generateShipLabels.
 * Generates a label entry for each packageId in the request body, sets shipment status
 * to SHIPLABEL_GENERATED, updates lastUpdatedDateTime, and writes to DB.
 */
export const generateShipLabelsHandler: OperationHandler = async (validationResult, request) => {
  const entity = validationResult.resolvedEntities["shipment"];

  if (entity === undefined) {
    return {
      statusCode: 500,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body: undefined,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "InternalError", message: "Resolved entity 'shipment' is not available" }] } },
    };
  }

  const body = validationResult.body as { packageIds?: string[]; courierSupportedAttributes?: { carrierName?: string; trackingId?: string } } | undefined;
  const packageIds = body?.packageIds ?? [];
  const carrierName = body?.courierSupportedAttributes?.carrierName ?? "";
  const trackingId = body?.courierSupportedAttributes?.trackingId ?? "";
  const host = request.get("host") ?? "localhost:9001";

  const packageShipLabelList = packageIds.map((packageId) => ({
    packageId,
    shipLabelMetadata: { carrierName, trackingId },
    fileData: { url: `http://${host}/label.png` },
    status: "SUCCESS",
  }));

  entity.status = "SHIPLABEL_GENERATED";
  entity.lastUpdatedDateTime = new Date().toISOString();
  Context.instance.engine.put(Api.EXT_FULFILLMENT_SHIPMENTS, entity.id as string, entity);

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
    data: { body: { packageShipLabelList } },
  };
};

/**
 * Handler for External Fulfillment Shipments v2024-09-11 createPackages.
 * Initializes the packages array if absent, appends new packages from the request body,
 * sets status to PACKAGE_CREATED, updates lastUpdatedDateTime, and writes to DB.
 */
/**
 * Handler for External Fulfillment Shipments v2024-09-11 generateInvoice.
 * Sets shipmentRequirements.invoice.status to AVAILABLE, updates timestamp, writes to DB,
 * and returns the static invoice document reference.
 */
export const generateInvoiceHandler: OperationHandler = async (validationResult, request) => {
  const entity = validationResult.resolvedEntities["shipment"];

  if (entity === undefined) {
    return {
      statusCode: 500,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body: undefined,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "InternalError", message: "Resolved entity 'shipment' is not available" }] } },
    };
  }

  // Set nested path shipmentRequirements.invoice.status = "AVAILABLE" (creating intermediates if absent)
  if (!entity.shipmentRequirements) entity.shipmentRequirements = {};
  const requirements = entity.shipmentRequirements as Record<string, unknown>;
  if (!requirements.invoice) requirements.invoice = {};
  (requirements.invoice as Record<string, unknown>).status = "AVAILABLE";

  entity.lastUpdatedDateTime = new Date().toISOString();
  Context.instance.engine.put(Api.EXT_FULFILLMENT_SHIPMENTS, entity.id as string, entity);
  const host = request.get("host") ?? "localhost:9001";

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
    data: { body: { document: { format: "PDF", content: `http://${host}/invoice.pdf` } } },
  };
};

/**
 * Handler for External Fulfillment Shipments v2024-09-11 retrieveInvoice.
 * Returns the static invoice document reference without modifying the database.
 */
export const retrieveInvoiceHandler: OperationHandler = async (validationResult, request) => {
  const entity = validationResult.resolvedEntities["shipment"];

  if (entity === undefined) {
    return {
      statusCode: 500,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body: undefined,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "InternalError", message: "Resolved entity 'shipment' is not available" }] } },
    };
  }

  const host = request.get("host") ?? "localhost:9001";
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
    data: { body: { document: { format: "PDF", content: `http://${host}/invoice.pdf` } } },
  };
};

/**
 * Handler for External Fulfillment Shipments v2024-09-11 createPackages.
 * Initializes the packages array if absent, appends new packages from the request body,
 * sets status to PACKAGE_CREATED, updates lastUpdatedDateTime, and writes to DB.
 */
export const createPackagesHandler: OperationHandler = async (validationResult) => {
  const entity = validationResult.resolvedEntities["shipment"];

  if (entity === undefined) {
    return {
      statusCode: 500,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body: undefined,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "InternalError", message: "Resolved entity 'shipment' is not available" }] } },
    };
  }

  // Initialize packages array if undefined or null
  if (!entity.packages) {
    entity.packages = [];
  }

  // Append each package from the request body
  const body = validationResult.body as { packages?: Record<string, unknown>[] } | undefined;
  const newPackages = body?.packages ?? [];
  for (const pkg of newPackages) {
    (entity.packages as Record<string, unknown>[]).push(pkg);
  }

  // Update status and timestamp
  entity.status = "PACKAGE_CREATED";
  entity.lastUpdatedDateTime = new Date().toISOString();

  // Persist to database
  Context.instance.engine.put(Api.EXT_FULFILLMENT_SHIPMENTS, entity.id as string, entity);

  return {
    statusCode: 204,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: {} },
  };
};
