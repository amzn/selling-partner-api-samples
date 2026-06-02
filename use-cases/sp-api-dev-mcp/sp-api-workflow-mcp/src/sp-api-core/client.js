/**
 * Generic SP-API Client
 *
 * A simple HTTP client for SP-API that executes requests based on
 * workflow-provided specifications. No hard-coded operation mappings.
 *
 * The workflow task contains all endpoint details (method, path, params)
 * learned from the SP-API Discovery MCP.
 */

import { TokenManager, createAuthHeaders } from './auth.js';

/**
 * SP-API Client class
 * Generic client for executing any SP-API request
 */
export class SPAPIClient {
  /**
   * @param {object} config
   * @param {string} config.clientId - SP-API client ID
   * @param {string} config.clientSecret - SP-API client secret
   * @param {string} config.refreshToken - SP-API refresh token
   * @param {string} config.region - AWS region (na, eu, fe)
   * @param {string} config.endpoint - Optional custom API endpoint URL (for mock testing)
   * @param {string} config.tokenEndpoint - Optional custom token endpoint URL (for mock testing)
   */
  constructor(config) {
    this.tokenManager = new TokenManager({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
      authEndpoint: config.tokenEndpoint
    });

    this.baseUrl = config.endpoint || this.getRegionalEndpoint(config.region || 'na');
    this.timeout = config.timeout || 30000;
  }

  /**
   * Get the regional SP-API endpoint
   */
  getRegionalEndpoint(region) {
    const endpoints = {
      na: 'https://sellingpartnerapi-na.amazon.com',
      eu: 'https://sellingpartnerapi-eu.amazon.com',
      fe: 'https://sellingpartnerapi-fe.amazon.com'
    };
    return endpoints[region] || endpoints.na;
  }

  /**
   * Execute an SP-API request based on workflow specification
   *
   * @param {object} spec - Request specification from workflow
   * @param {string} spec.method - HTTP method (GET, POST, PUT, DELETE)
   * @param {string} spec.path - API path (e.g., /orders/v0/orders/{orderId})
   * @param {object} spec.pathParams - Path parameter values (e.g., { orderId: "123" })
   * @param {object} spec.queryParams - Query parameters
   * @param {object} spec.body - Request body for POST/PUT
   * @param {object} spec.headers - Additional headers
   * @returns {Promise<object>} API response
   */
  async execute(spec) {
    const { method = 'GET', path, pathParams = {}, queryParams = {}, body, headers = {} } = spec;

    if (!path) {
      throw new SPAPIError({
        message: 'Missing required "path" in request specification',
        status: 400
      });
    }

    // Get access token
    const accessToken = await this.tokenManager.getAccessToken();

    // Build URL
    const url = this.buildUrl(path, pathParams, queryParams);

    // Build request options
    const options = {
      method: method.toUpperCase(),
      headers: {
        ...createAuthHeaders(accessToken),
        ...headers
      }
    };

    // Add body for POST/PUT/PATCH
    if (body && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      options.body = JSON.stringify(body);
    }

    // Execute request
    const response = await this.fetchWithTimeout(url, options);

    return this.handleResponse(response);
  }

  /**
   * Build full URL with path and query parameters
   */
  buildUrl(path, pathParams, queryParams) {
    // Replace path parameters: /orders/{orderId} -> /orders/123
    let resolvedPath = path;
    for (const [key, value] of Object.entries(pathParams)) {
      resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(value));
    }

    // Check for unresolved path params
    const unresolvedMatch = resolvedPath.match(/\{(\w+)\}/);
    if (unresolvedMatch) {
      throw new SPAPIError({
        message: `Missing path parameter: ${unresolvedMatch[1]}`,
        status: 400
      });
    }

    // Build query string
    const queryParts = [];
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          queryParts.push(`${encodeURIComponent(key)}=${value.map(v => encodeURIComponent(v)).join(',')}`);
        } else {
          queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
      }
    }

    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return `${this.baseUrl}${resolvedPath}${queryString}`;
  }

  /**
   * Fetch with timeout support
   */
  async fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle API response
   */
  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!response.ok) {
      const errorBody = isJson ? await response.json() : await response.text();
      throw new SPAPIError({
        status: response.status,
        statusText: response.statusText,
        body: errorBody
      });
    }

    if (response.status === 204) {
      return {};
    }

    return isJson ? response.json() : { text: await response.text() };
  }
}

/**
 * SP-API Error class
 */
export class SPAPIError extends Error {
  constructor({ message, status, statusText, body }) {
    super(message || `SP-API error: ${status} ${statusText || ''}`);
    this.name = 'SPAPIError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;

    if (body && typeof body === 'object') {
      this.errorCode = body.code || body.errorCode;
      this.errorMessage = body.message || body.errorMessage;
      this.errors = body.errors;
    }
  }

  isRetryable() {
    return this.status === 429 || (this.status >= 500 && this.status < 600);
  }

  getRetryDelay() {
    return this.status === 429 ? 2000 : 1000;
  }
}

/**
 * Create a configured SP-API client
 */
export function createClient(config) {
  return new SPAPIClient(config);
}
