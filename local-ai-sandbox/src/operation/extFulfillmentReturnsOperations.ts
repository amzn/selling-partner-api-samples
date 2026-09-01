import type { OperationHandler } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";
import { Paginator } from "../service/Paginator.js";

const returnsPaginator = new Paginator({ defaultPageSize: 10, maxPageSize: 100 });

/**
 * Handler for External Fulfillment Returns v2024-09-11 listReturns.
 * Queries the EXT_FULFILLMENT_RETURNS namespace with exact-match and date-range filtering, plus pagination.
 */
export const listReturnsHandler: OperationHandler = async (validationResult) => {
  const qp = validationResult.queryParams;

  // Extract query params
  const returnLocationId = qp.returnLocationId as string | undefined;
  const rmaId = qp.rmaId as string | undefined;
  const status = qp.status as string | undefined;
  const reverseTrackingId = qp.reverseTrackingId as string | undefined;
  const createdSince = qp.createdSince as string | undefined;
  const createdUntil = qp.createdUntil as string | undefined;
  const lastUpdatedSince = qp.lastUpdatedSince as string | undefined;
  const lastUpdatedUntil = qp.lastUpdatedUntil as string | undefined;
  const maxResultsRaw = qp.maxResults as string | undefined;
  const nextToken = qp.nextToken as string | undefined;

  // Query all records from the EXT_FULFILLMENT_RETURNS namespace
  const allItems = Context.instance.engine.find(Api.EXT_FULFILLMENT_RETURNS, {});

  // Apply filters (all are combined as logical AND)
  let filteredItems = allItems;

  if (returnLocationId !== undefined) {
    filteredItems = filteredItems.filter((item) => item.returnLocationId === returnLocationId);
  }

  if (rmaId !== undefined) {
    filteredItems = filteredItems.filter((item) => {
      const metadata = item.returnMetadata as Record<string, unknown> | undefined;
      return metadata?.rmaId === rmaId;
    });
  }

  if (status !== undefined) {
    filteredItems = filteredItems.filter((item) => item.status === status);
  }

  if (reverseTrackingId !== undefined) {
    filteredItems = filteredItems.filter((item) => {
      const shippingInfo = item.returnShippingInfo as Record<string, unknown> | undefined;
      const reverseTrackingInfo = shippingInfo?.reverseTrackingInfo as Record<string, unknown> | undefined;
      return reverseTrackingInfo?.trackingId === reverseTrackingId;
    });
  }

  if (createdSince !== undefined) {
    const sinceTime = new Date(createdSince).getTime();
    filteredItems = filteredItems.filter((item) => {
      const creationDateTime = item.creationDateTime as string | undefined;
      if (!creationDateTime) return false;
      return new Date(creationDateTime).getTime() >= sinceTime;
    });
  }

  if (createdUntil !== undefined) {
    const untilTime = new Date(createdUntil).getTime();
    filteredItems = filteredItems.filter((item) => {
      const creationDateTime = item.creationDateTime as string | undefined;
      if (!creationDateTime) return false;
      return new Date(creationDateTime).getTime() <= untilTime;
    });
  }

  if (lastUpdatedSince !== undefined) {
    const sinceTime = new Date(lastUpdatedSince).getTime();
    filteredItems = filteredItems.filter((item) => {
      const lastUpdatedDateTime = item.lastUpdatedDateTime as string | undefined;
      if (!lastUpdatedDateTime) return false;
      return new Date(lastUpdatedDateTime).getTime() >= sinceTime;
    });
  }

  if (lastUpdatedUntil !== undefined) {
    const untilTime = new Date(lastUpdatedUntil).getTime();
    filteredItems = filteredItems.filter((item) => {
      const lastUpdatedDateTime = item.lastUpdatedDateTime as string | undefined;
      if (!lastUpdatedDateTime) return false;
      return new Date(lastUpdatedDateTime).getTime() <= untilTime;
    });
  }

  // Apply pagination
  const paginationResult = returnsPaginator.paginate(filteredItems, { pageSize: maxResultsRaw, pageToken: nextToken });

  // Strip _key from each returned item
  const returns = paginationResult.page.map((item) => {
    const { _key, ...rest } = item;
    return rest;
  });

  // Build response body
  const responseBody: Record<string, unknown> = { returns };

  // Include nextToken when more pages exist
  if (paginationResult.nextToken) {
    responseBody.nextToken = paginationResult.nextToken;
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
 * Handler for External Fulfillment Returns v2024-09-11 getReturn.
 * Reads the pre-resolved entity from the validation pipeline and strips the internal `_key` field.
 */
export const getReturnHandler: OperationHandler = async (validationResult) => {
  const entity = validationResult.resolvedEntities["return"];

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
      data: { body: { errors: [{ code: "InternalError", message: "Resolved entity 'return' is not available" }] } },
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
