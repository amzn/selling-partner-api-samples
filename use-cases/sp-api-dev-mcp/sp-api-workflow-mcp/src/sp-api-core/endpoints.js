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
 * Path parameters whose value spans several path segments, keyed by path template.
 * These are marked x-amazon-spds-greedy-path-parameter in the SP-API models; their
 * "/" separators must not be encoded or SP-API cannot route the request (403).
 */
export const GREEDY_PATH_PARAMS = {
  '/uploads/2020-11-01/uploadDestinations/{resource}': ['resource']
};

/**
 * Encode a path parameter value for the given path template.
 * Greedy values are encoded per segment, keeping "/" and dropping leading slashes.
 *
 * @param {string} path - Path template, e.g. /orders/v0/orders/{orderId}
 * @param {string} key - Path parameter name
 * @param {*} value - Parameter value
 * @returns {string} Encoded value
 */
export function encodePathParam(path, key, value) {
  if (!GREEDY_PATH_PARAMS[path]?.includes(key)) {
    return encodeURIComponent(value);
  }
  return String(value).replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
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
