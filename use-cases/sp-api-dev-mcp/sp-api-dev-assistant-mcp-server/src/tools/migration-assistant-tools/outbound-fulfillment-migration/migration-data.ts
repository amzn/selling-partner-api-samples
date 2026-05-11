import { readFileSync } from "fs";

export interface ApiMapping {
  v1: string;
  status: string;
  notes: string;
}

export interface StatusMappings {
  fulfillmentOrderStatus: Record<string, string>;
  shipmentStatus: Record<string, string>;
  packageStatus: Record<string, string>;
}

export interface RequestBodyChange {
  removed: string[];
  renamed: Record<string, string>;
  added: string[];
  enumChanges?: Record<string, string>;
}

export interface ResponseChange {
  renamed: Record<string, string>;
  structureChanges: string[];
}

export interface TenancyOperation {
  endpoint: string;
  description: string;
}

export interface NotificationEventType {
  statuses: string[];
  description: string;
}

export interface Notifications {
  description: string;
  eventTypes: Record<string, NotificationEventType>;
  webhookSupport: boolean;
  sbqFilterSupport: boolean;
  payloadVersion: string;
}

export interface OutboundMigrationData {
  deprecated: string[];
  notSupported: string[];
  attributeMappings: Record<string, string>;
  newFeatures: string[];
  apiMappings: Record<string, ApiMapping>;
  deliveryServiceLevelMappings: Record<string, string>;
  fulfillmentActionMappings: Record<string, string>;
  fulfillmentPolicyMappings: Record<string, string>;
  statusMappings: StatusMappings;
  queryParameterMappings: Record<string, string>;
  requestBodyChanges: Record<string, RequestBodyChange>;
  responseChanges: Record<string, ResponseChange>;
  basePath: { old: string; new: string };
  tenancyOperations: {
    description: string;
    operations: Record<string, TenancyOperation>;
  };
  notifications: Notifications;
  migrationBenefits: string[];
}

export function getOutboundFulfillmentMigrationData(
  resourcePath: string,
): OutboundMigrationData {
  const jsonData = JSON.parse(readFileSync(resourcePath, "utf-8"));

  return {
    deprecated: jsonData.deprecated,
    notSupported: jsonData.notSupported,
    attributeMappings: jsonData.attributeMappings,
    newFeatures: jsonData.newFeatures,
    apiMappings: jsonData.apiMappings,
    deliveryServiceLevelMappings: jsonData.deliveryServiceLevelMappings,
    fulfillmentActionMappings: jsonData.fulfillmentActionMappings,
    fulfillmentPolicyMappings: jsonData.fulfillmentPolicyMappings,
    statusMappings: jsonData.statusMappings,
    queryParameterMappings: jsonData.queryParameterMappings,
    requestBodyChanges: jsonData.requestBodyChanges,
    responseChanges: jsonData.responseChanges,
    basePath: jsonData.basePath,
    tenancyOperations: jsonData.tenancyOperations,
    notifications: jsonData.notifications,
    migrationBenefits: jsonData.migrationBenefits,
  };
}
