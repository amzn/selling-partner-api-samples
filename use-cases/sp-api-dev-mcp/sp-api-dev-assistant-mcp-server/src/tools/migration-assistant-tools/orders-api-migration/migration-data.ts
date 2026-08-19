import { readFileSync } from "fs";

export interface ApiMapping {
  v1: string;
  status: string;
  notes: string;
}

export interface IncludedDataParameter {
  description: string;
  attributes: string[];
  notes?: string;
}

export interface StatusMappings {
  fulfillmentStatus: Record<string, string>;
  fulfillmentChannel: Record<string, string>;
}

export interface PackageTracking {
  description: string;
  attributes: Record<string, string>;
}

export interface ProgramsList {
  orderLevel: string[];
  orderItemLevel: string[];
}

export interface MigrationData {
  deprecated: string[];
  notSupported: string[];
  attributeMappings: Record<string, string>;
  newFeatures: string[];
  apiMappings: Record<string, ApiMapping>;
  includedDataParameters: Record<string, IncludedDataParameter>;
  statusMappings: StatusMappings;
  queryParameterMappings: Record<string, string>;
  packageTracking: PackageTracking;
  programsList: ProgramsList;
  migrationBenefits: string[];
}

export function getOrdersApiMigrationData(resourcePath: string): MigrationData {
  const jsonData = JSON.parse(readFileSync(resourcePath, "utf-8"));

  return {
    deprecated: jsonData.deprecated,
    notSupported: jsonData.notSupported,
    attributeMappings: jsonData.attributeMappings,
    newFeatures: jsonData.newFeatures,
    apiMappings: jsonData.apiMappings,
    includedDataParameters: jsonData.includedDataParameters,
    statusMappings: jsonData.statusMappings,
    queryParameterMappings: jsonData.queryParameterMappings,
    packageTracking: jsonData.packageTracking,
    programsList: jsonData.programsList,
    migrationBenefits: jsonData.migrationBenefits,
  };
}
