import { randomUUID } from "node:crypto";
import { OperationHandler } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";
// Read inside handlers only. The registry imports this module, so the binding
// is resolved when a request runs rather than while the modules initialise.
import { CURRENT_MODE } from "../registry/operationRegistry.js";

// --- Supported Notification Types Allowlist ---

export const SUPPORTED_NOTIFICATION_TYPES: Record<string, { payloadVersions: string[]; supportedModes: string[] }> = {
  ORDER_CHANGE: { payloadVersions: ["1.0"], supportedModes: ["Seller"] },
};

// --- createDestination ---

export const createDestinationHandler: OperationHandler = async (validationResult, request) => {
  const body = request.body as Record<string, unknown>;
  const name = body.name as string;
  const resourceSpecification = body.resourceSpecification as Record<string, unknown> | undefined;

  // Validate name length
  if (name && name.length > 256) {
    return {
      statusCode: 400,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "InvalidInput", message: "Destination name must not exceed 256 characters." }] } },
    };
  }

  // Validate resource specification
  const hasSqs = resourceSpecification?.sqs != null;
  const hasEventBridge = resourceSpecification?.eventBridge != null;

  if (hasEventBridge) {
    return {
      statusCode: 501,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "NotImplemented", message: "EventBridge destinations are not supported in the sandbox." }] } },
    };
  }

  if (!hasSqs) {
    return {
      statusCode: 400,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "InvalidInput", message: "Resource specification must contain a valid sqs or eventBridge resource." }] } },
    };
  }

  // Check uniqueness (name)
  const existingByName = Context.instance.engine.find(Api.NOTIFICATIONS, { _type: "destination", name });
  if (existingByName.length > 0) {
    return {
      statusCode: 409,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "Conflict", message: `A destination with the name '${name}' already exists.` }] } },
    };
  }

  // Generate destination
  const destinationId = randomUUID();
  const destination = {
    _key: destinationId,
    _type: "destination" as const,
    destinationId,
    name,
    resource: resourceSpecification,
  };

  Context.instance.engine.put(Api.NOTIFICATIONS, destinationId, destination);

  // Return the destination without internal fields
  const { _key: _, _type: __, ...payload } = destination;

  return {
    statusCode: 200,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: { payload } },
  };
};

// --- getDestinations ---

export const getDestinationsHandler: OperationHandler = async (validationResult) => {
  const collection = Context.instance.engine.getCollection(Api.NOTIFICATIONS);
  const allDocs = collection
    ? collection.find({ _type: "destination" }).map((d) => {
        const { $loki, meta, _key, _type, ...rest } = d as Record<string, unknown>;
        return rest;
      })
    : [];

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
    data: { body: { payload: allDocs } },
  };
};

// --- getDestination ---

export const getDestinationHandler: OperationHandler = async (validationResult) => {
  const { $loki, meta, _key, _type, ...payload } = validationResult.resolvedEntities.destination as Record<string, unknown>;

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
    data: { body: { payload } },
  };
};

// --- deleteDestination ---

export const deleteDestinationHandler: OperationHandler = async (validationResult) => {
  const destinationId = validationResult.pathParams.destinationId;

  // Check for active subscriptions referencing this destination
  const subscriptions = Context.instance.engine.find(Api.NOTIFICATIONS, { _type: "subscription", destinationId });

  if (subscriptions.length > 0) {
    return {
      statusCode: 409,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body: undefined,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: {
        body: {
          errors: [{ code: "Conflict", message: "Cannot delete destination because it has active subscriptions referencing it." }],
        },
      },
    };
  }

  void Context.instance.engine.remove(Api.NOTIFICATIONS, destinationId);

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
    data: { body: {} },
  };
};

// --- createSubscription ---

export const createSubscriptionHandler: OperationHandler = async (validationResult, request) => {
  const body = request.body as Record<string, unknown>;
  const notificationType = validationResult.pathParams.notificationType;
  const payloadVersion = body.payloadVersion as string | undefined;
  const destinationId = body.destinationId as string | undefined;
  const processingDirective = body.processingDirective as Record<string, unknown> | undefined;

  // Validate required fields
  if (!payloadVersion || typeof payloadVersion !== "string" || payloadVersion.trim() === "") {
    return {
      statusCode: 400,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "InvalidInput", message: "payloadVersion is required and must be a non-empty string." }] } },
    };
  }

  if (!destinationId || typeof destinationId !== "string" || destinationId.trim() === "") {
    return {
      statusCode: 400,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "InvalidInput", message: "destinationId is required and must be a non-empty string." }] } },
    };
  }

  // Validate notificationType is in supported allowlist
  if (!(notificationType in SUPPORTED_NOTIFICATION_TYPES)) {
    return {
      statusCode: 400,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: { body: { errors: [{ code: "InvalidInput", message: `Notification type '${notificationType}' is not supported.` }] } },
    };
  }

  // Validate payloadVersion is supported for this notificationType
  const supportedConfig = SUPPORTED_NOTIFICATION_TYPES[notificationType];
  if (!supportedConfig.payloadVersions.includes(payloadVersion)) {
    return {
      statusCode: 400,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: {
        body: { errors: [{ code: "InvalidInput", message: `Payload version '${payloadVersion}' is not supported for notification type '${notificationType}'.` }] },
      },
    };
  }

  // Check mode availability
  const currentMode = CURRENT_MODE;
  if (!supportedConfig.supportedModes.includes(currentMode)) {
    return {
      statusCode: 400,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: {
        body: { errors: [{ code: "InvalidInput", message: `Notification type '${notificationType}' is not available for the current mode '${currentMode}'.` }] },
      },
    };
  }

  // Check uniqueness (notificationType + payloadVersion)
  const existing = Context.instance.engine.find(Api.NOTIFICATIONS, { _type: "subscription", notificationType, payloadVersion });
  if (existing.length > 0) {
    return {
      statusCode: 409,
      operationId: validationResult.operationId,
      apiName: validationResult.apiName,
      apiVersion: validationResult.apiVersion,
      pathParams: validationResult.pathParams,
      queryParams: validationResult.queryParams,
      body,
      operation: validationResult.operation,
      resolvedEntities: validationResult.resolvedEntities,
      data: {
        body: { errors: [{ code: "Conflict", message: `A subscription already exists for notification type '${notificationType}' with payload version '${payloadVersion}'.` }] },
      },
    };
  }

  // Generate subscription
  const subscriptionId = randomUUID();
  const subscription: Record<string, unknown> = {
    _key: subscriptionId,
    _type: "subscription" as const,
    subscriptionId,
    notificationType,
    payloadVersion,
    destinationId,
  };

  if (processingDirective) {
    subscription.processingDirective = processingDirective;
  }

  Context.instance.engine.put(Api.NOTIFICATIONS, subscriptionId, subscription);

  // Return subscription without internal fields
  const { _key: _, _type: __, ...payload } = subscription;

  return {
    statusCode: 200,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: { payload } },
  };
};

// --- getSubscription ---

export const getSubscriptionHandler: OperationHandler = async (validationResult) => {
  const notificationType = validationResult.pathParams.notificationType;
  const payloadVersion = validationResult.queryParams.payloadVersion as string | undefined;

  let subscriptions: Record<string, unknown>[];

  if (payloadVersion) {
    // Find subscription matching both notificationType and payloadVersion
    subscriptions = Context.instance.engine.find(Api.NOTIFICATIONS, { _type: "subscription", notificationType, payloadVersion });
  } else {
    // Find all subscriptions for this notificationType
    subscriptions = Context.instance.engine.find(Api.NOTIFICATIONS, { _type: "subscription", notificationType });
  }

  if (subscriptions.length === 0) {
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
      data: { body: { errors: [{ code: "NotFound", message: `No subscription found for notification type '${notificationType}'.` }] } },
    };
  }

  // Return the one with the highest (latest) payloadVersion
  const sorted = subscriptions.sort((a, b) => {
    const vA = typeof a.payloadVersion === "string" ? a.payloadVersion : "";
    const vB = typeof b.payloadVersion === "string" ? b.payloadVersion : "";
    return vB.localeCompare(vA, undefined, { numeric: true });
  });

  const result = sorted[0];
  const { $loki, meta, _key, _type, ...payload } = result as Record<string, unknown>;

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
    data: { body: { payload } },
  };
};

// --- getSubscriptionById ---

export const getSubscriptionByIdHandler: OperationHandler = async (validationResult) => {
  const { $loki, meta, _key, _type, ...payload } = validationResult.resolvedEntities.subscription as Record<string, unknown>;

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
    data: { body: { payload } },
  };
};

// --- getSubscriptions ---

export const getSubscriptionsHandler: OperationHandler = async (validationResult) => {
  const notificationTypesRaw = validationResult.queryParams.notificationTypes;
  const payloadVersion = validationResult.queryParams.payloadVersion as string | undefined;
  const pageSize = Math.min(Math.max(Number(validationResult.queryParams.pageSize) || 30, 30), 100);
  const nextToken = validationResult.queryParams.nextToken as string | undefined;

  // notificationTypes is required and limited to a single value per the spec
  const notificationTypes: string[] = Array.isArray(notificationTypesRaw)
    ? notificationTypesRaw
    : typeof notificationTypesRaw === "string"
      ? notificationTypesRaw.split(",")
      : [];

  // Find all subscriptions matching the filter criteria
  let subscriptions = Context.instance.engine.find(Api.NOTIFICATIONS, { _type: "subscription" }) as Record<string, unknown>[];

  // Filter by notificationTypes
  if (notificationTypes.length > 0) {
    subscriptions = subscriptions.filter((s) => notificationTypes.includes(s.notificationType as string));
  }

  // Filter by payloadVersion if provided
  if (payloadVersion) {
    subscriptions = subscriptions.filter((s) => s.payloadVersion === payloadVersion);
  }

  // Sort by subscriptionId for deterministic pagination
  subscriptions.sort((a, b) => (a.subscriptionId as string).localeCompare(b.subscriptionId as string));

  // Handle pagination via nextToken (offset-based using subscriptionId)
  let startIndex = 0;
  if (nextToken) {
    const idx = subscriptions.findIndex((s) => s.subscriptionId === nextToken);
    startIndex = idx >= 0 ? idx : subscriptions.length;
  }

  const page = subscriptions.slice(startIndex, startIndex + pageSize);
  const hasMore = startIndex + pageSize < subscriptions.length;
  const responseNextToken = hasMore ? (subscriptions[startIndex + pageSize].subscriptionId as string) : undefined;

  // Strip internal fields
  const cleaned = page.map((s) => {
    const { $loki, meta, _key, _type, ...rest } = s;
    return rest;
  });

  const payload: Record<string, unknown> = { subscriptions: cleaned };
  if (responseNextToken) {
    payload.nextToken = responseNextToken;
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
    data: { body: { payload } },
  };
};

// --- deleteSubscriptionById ---

export const deleteSubscriptionByIdHandler: OperationHandler = async (validationResult) => {
  const subscriptionId = validationResult.pathParams.subscriptionId;
  void Context.instance.engine.remove(Api.NOTIFICATIONS, subscriptionId);

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
    data: { body: {} },
  };
};
