import type { OperationHandler } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";

interface InventoryRequestParams {
  quantity?: number;
  clientSequenceNumber?: number;
  marketplaceAttributes?: { marketplaceId?: string; channelName?: string };
}

interface InventorySubResponse {
  status: { statusCode: number; reasonPhrase: string };
  body: {
    locationId?: string;
    skuId?: string;
    sellableQuantity?: number;
    reservedQuantity?: number;
    clientSequenceNumber?: number;
    marketplaceAttributes?: { marketplaceId?: string; channelName?: string };
    actionableErrors: Array<{ errorType: string; errorSubType: string }>;
  };
}

interface SubRequest {
  uri: string;
  method?: string;
  body?: InventoryRequestParams;
}

/**
 * Parses a sub-request URI to extract the operation type (update/fetch/null),
 * locationId, and skuId from the query parameters.
 */
function parseSubRequestUri(uri: string): { operation: "update" | "fetch" | null; locationId: string | null; skuId: string | null } {
  let operation: "update" | "fetch" | null = null;

  if (uri.includes("/inventory/update")) {
    operation = "update";
  } else if (uri.includes("/inventory/fetch")) {
    operation = "fetch";
  }

  // Extract query params from the URI
  let locationId: string | null = null;
  let skuId: string | null = null;

  const queryIndex = uri.indexOf("?");
  if (queryIndex !== -1) {
    const queryString = uri.substring(queryIndex + 1);
    const params = new URLSearchParams(queryString);
    locationId = params.get("locationId");
    skuId = params.get("skuId");
  }

  return { operation, locationId, skuId };
}

/**
 * Processes an inventory update sub-request.
 * Validates body fields, checks concurrency via stored clientSequenceNumber,
 * and performs DB upsert.
 */
function processUpdate(locationId: string, skuId: string, body: InventoryRequestParams | undefined): InventorySubResponse {
  // Validate quantity is present
  if (body?.quantity === undefined || body.quantity === null) {
    return {
      status: { statusCode: 400, reasonPhrase: "Invalid Input" },
      body: {
        locationId,
        skuId,
        actionableErrors: [{ errorType: "INVALID_INPUT", errorSubType: "Quantity is required for update operations" }],
      },
    };
  }

  // Validate quantity is an integer
  if (!Number.isInteger(body.quantity)) {
    return {
      status: { statusCode: 400, reasonPhrase: "Invalid Input" },
      body: {
        locationId,
        skuId,
        actionableErrors: [{ errorType: "INVALID_INPUT", errorSubType: "Quantity must be an integer" }],
      },
    };
  }

  // Validate quantity is non-negative
  if (body.quantity < 0) {
    return {
      status: { statusCode: 400, reasonPhrase: "Invalid Input" },
      body: {
        locationId,
        skuId,
        actionableErrors: [{ errorType: "INVALID_INPUT", errorSubType: "Quantity must be non-negative" }],
      },
    };
  }

  // Validate clientSequenceNumber is present
  if (body.clientSequenceNumber === undefined || body.clientSequenceNumber === null) {
    return {
      status: { statusCode: 400, reasonPhrase: "Invalid Input" },
      body: {
        locationId,
        skuId,
        actionableErrors: [{ errorType: "INVALID_INPUT", errorSubType: "clientSequenceNumber is required for update operations" }],
      },
    };
  }

  const compositeKey = `${locationId}:${skuId}`;
  const existing = Context.instance.engine.get(Api.EXT_FULFILLMENT_INVENTORY, compositeKey);

  // Check concurrency: stale clientSequenceNumber
  if (existing && (body.clientSequenceNumber as number) <= (existing.clientSequenceNumber as number)) {
    return {
      status: { statusCode: 400, reasonPhrase: "Invalid Input" },
      body: {
        locationId,
        skuId,
        actionableErrors: [{ errorType: "STALE_DATA", errorSubType: "Client sequence number is not greater than the current value" }],
      },
    };
  }

  // Perform upsert — preserve reservedQuantity on update
  const reservedQuantity = existing ? (existing.reservedQuantity as number) : 0;

  const record: Record<string, unknown> = {
    locationId,
    skuId,
    sellableQuantity: body.quantity,
    reservedQuantity,
    clientSequenceNumber: body.clientSequenceNumber,
    marketplaceAttributes: body.marketplaceAttributes,
  };

  Context.instance.engine.put(Api.EXT_FULFILLMENT_INVENTORY, compositeKey, record);

  return {
    status: { statusCode: 200, reasonPhrase: "Success" },
    body: {
      locationId,
      skuId,
      sellableQuantity: body.quantity,
      reservedQuantity,
      clientSequenceNumber: body.clientSequenceNumber,
      marketplaceAttributes: body.marketplaceAttributes,
      actionableErrors: [],
    },
  };
}

/**
 * Processes an inventory fetch sub-request.
 * Looks up a record by composite key and returns success or INVALID_SKU error.
 */
function processFetch(locationId: string, skuId: string): InventorySubResponse {
  const compositeKey = `${locationId}:${skuId}`;
  const record = Context.instance.engine.get(Api.EXT_FULFILLMENT_INVENTORY, compositeKey);

  if (!record) {
    return {
      status: { statusCode: 400, reasonPhrase: "Invalid Input" },
      body: {
        locationId,
        skuId,
        actionableErrors: [{ errorType: "INVALID_SKU", errorSubType: "SKU does not exist for the seller at the requested location" }],
      },
    };
  }

  return {
    status: { statusCode: 200, reasonPhrase: "Success" },
    body: {
      locationId,
      skuId,
      sellableQuantity: record.sellableQuantity as number,
      reservedQuantity: record.reservedQuantity as number,
      clientSequenceNumber: record.clientSequenceNumber as number,
      marketplaceAttributes: record.marketplaceAttributes as { marketplaceId?: string; channelName?: string } | undefined,
      actionableErrors: [],
    },
  };
}

/**
 * Handler for External Fulfillment Inventory v2024-09-11 batchInventory.
 * Processes batches of 1–10 sub-requests (update or fetch) against the LokiJS database,
 * returning HTTP 207 Multi-Status with per-item success/error entries.
 */
export const batchInventoryHandler: OperationHandler = async (validationResult) => {
  const body = validationResult.body as { requests: SubRequest[] } | undefined;
  const requests = body?.requests ?? [];
  const responses: InventorySubResponse[] = [];

  for (const subRequest of requests) {
    try {
      const { operation, locationId, skuId } = parseSubRequestUri(subRequest.uri ?? "");

      // Unrecognized URI path
      if (operation === null) {
        responses.push({
          status: { statusCode: 400, reasonPhrase: "Invalid Input" },
          body: {
            locationId: locationId ?? undefined,
            skuId: skuId ?? undefined,
            actionableErrors: [{ errorType: "INVALID_REQUEST", errorSubType: "Unrecognized sub-operation in URI path" }],
          },
        });
        continue;
      }

      // Missing locationId or skuId
      if (!locationId || !skuId) {
        responses.push({
          status: { statusCode: 400, reasonPhrase: "Invalid Input" },
          body: {
            locationId: locationId ?? undefined,
            skuId: skuId ?? undefined,
            actionableErrors: [{ errorType: "INVALID_REQUEST", errorSubType: "Both locationId and skuId query parameters are required" }],
          },
        });
        continue;
      }

      // Dispatch to update or fetch
      if (operation === "update") {
        responses.push(processUpdate(locationId, skuId, subRequest.body));
      } else {
        responses.push(processFetch(locationId, skuId));
      }
    } catch {
      // Per-item error isolation: unexpected errors
      responses.push({
        status: { statusCode: 500, reasonPhrase: "Internal Server Error" },
        body: {
          actionableErrors: [{ errorType: "INTERNAL_ERROR", errorSubType: "Unexpected processing failure" }],
        },
      });
    }
  }

  return {
    statusCode: 207,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: { responses } },
  };
};
