/**
 * SP-API Endpoint Utilities
 *
 * Helper utilities for working with SP-API endpoints.
 * No hard-coded operation mappings - the workflow contains full endpoint details.
 */

/**
 * Regional SP-API base URLs
 */
export const REGIONAL_ENDPOINTS = {
  na: 'https://sellingpartnerapi-na.amazon.com',
  eu: 'https://sellingpartnerapi-eu.amazon.com',
  fe: 'https://sellingpartnerapi-fe.amazon.com'
};

/**
 * Get regional endpoint URL
 *
 * @param {string} region - Region code (na, eu, fe)
 * @returns {string} Base URL
 */
export function getRegionalEndpoint(region) {
  return REGIONAL_ENDPOINTS[region] || REGIONAL_ENDPOINTS.na;
}

/**
 * Validate a request specification
 *
 * @param {object} spec - Request specification
 * @returns {object} Validation result { valid, errors }
 */
export function validateRequestSpec(spec) {
  const errors = [];

  if (!spec) {
    errors.push('Request specification is required');
    return { valid: false, errors };
  }

  if (!spec.path) {
    errors.push('path is required');
  }

  if (spec.method) {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    if (!validMethods.includes(spec.method.toUpperCase())) {
      errors.push(`Invalid method: ${spec.method}. Must be one of: ${validMethods.join(', ')}`);
    }
  }

  // Check for path parameters in path
  const pathParamMatches = spec.path?.match(/\{(\w+)\}/g) || [];
  const requiredPathParams = pathParamMatches.map(m => m.slice(1, -1));

  if (requiredPathParams.length > 0 && spec.pathParams) {
    for (const param of requiredPathParams) {
      if (spec.pathParams[param] === undefined) {
        errors.push(`Missing path parameter: ${param}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
