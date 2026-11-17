// src/utils/graphqlHelpers.ts
import { SCHEMA_NAMES } from './constants.js';

/**
 * Validates a GraphQL query string
 * @param query The GraphQL query string to validate
 * @returns True if the query is valid, false otherwise
 */
export function validateGraphQLQuery(query: string): boolean {
  // Basic validation - check if it contains 'query' and has valid braces
  if (!query.includes('query')) {
    return false;
  }

  // Count open and close braces to ensure they match
  const openBraces = (query.match(/{/g) || []).length;
  const closeBraces = (query.match(/}/g) || []).length;
  
  return openBraces === closeBraces;
}

/**
 * Checks if a GraphQL query targets a specific schema
 * @param query The GraphQL query string
 * @param schemaName The schema name to check for
 * @returns True if the query targets the schema, false otherwise
 */
export function queryTargetsSchema(query: string, schemaName: string): boolean {
  return query.includes(schemaName);
}

/**
 * Identifies which schema a GraphQL query is targeting
 * @param query The GraphQL query string
 * @returns The schema name or null if not identified
 */
export function identifyQuerySchema(query: string): string | null {
  if (queryTargetsSchema(query, SCHEMA_NAMES.VENDOR_ANALYTICS)) {
    return SCHEMA_NAMES.VENDOR_ANALYTICS;
  }
  
  if (queryTargetsSchema(query, SCHEMA_NAMES.SALES_AND_TRAFFIC)) {
    return SCHEMA_NAMES.SALES_AND_TRAFFIC;
  }
  
  if (queryTargetsSchema(query, SCHEMA_NAMES.SALES_AND_TRAFFIC_LEGACY)) {
    return SCHEMA_NAMES.SALES_AND_TRAFFIC_LEGACY;
  }
  
  if (queryTargetsSchema(query, SCHEMA_NAMES.ECONOMICS)) {
    return SCHEMA_NAMES.ECONOMICS;
  }
  
  return null;
}

/**
 * Extracts query parameters from a GraphQL query
 * @param query The GraphQL query string
 * @returns Object containing the extracted parameters
 */
export function extractQueryParameters(query: string): Record<string, any> {
  const params: Record<string, any> = {};
  
  // Extract date parameters
  const startDateMatch = query.match(/startDate:\s*"([^"]+)"/);
  if (startDateMatch) {
    params.startDate = startDateMatch[1];
  }
  
  const endDateMatch = query.match(/endDate:\s*"([^"]+)"/);
  if (endDateMatch) {
    params.endDate = endDateMatch[1];
  }
  
  // Extract aggregation parameter
  const aggregateByMatch = query.match(/aggregateBy:\s*([A-Z_]+)/);
  if (aggregateByMatch) {
    params.aggregateBy = aggregateByMatch[1];
  }
  
  // Extract marketplace parameters
  const marketplaceMatch = query.match(/marketplaceIds:\s*\[\s*"([^"]+)"\s*\]/);
  if (marketplaceMatch) {
    params.marketplaceIds = [marketplaceMatch[1]];
  }
  
  return params;
}