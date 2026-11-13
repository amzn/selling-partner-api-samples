/**
 * Tests for SP-API Core module (Generic Client)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

import { TokenManager, createAuthHeaders } from '../src/sp-api-core/auth.js';
import { REGIONAL_ENDPOINTS, getRegionalEndpoint, validateRequestSpec } from '../src/sp-api-core/endpoints.js';
import { SPAPIClient, SPAPIError, createClient } from '../src/sp-api-core/client.js';

// Auth Tests
describe('TokenManager', () => {
  it('should initialize with config', () => {
    const manager = new TokenManager({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      refreshToken: 'test-refresh'
    });

    assert.strictEqual(manager.clientId, 'test-client');
    assert.strictEqual(manager.clientSecret, 'test-secret');
    assert.strictEqual(manager.refreshToken, 'test-refresh');
  });

  it('should use default auth endpoint', () => {
    const manager = new TokenManager({
      clientId: 'test',
      clientSecret: 'test',
      refreshToken: 'test'
    });

    assert.strictEqual(manager.authEndpoint, 'https://api.amazon.com/auth/o2/token');
  });

  it('should report invalid when no token cached', () => {
    const manager = new TokenManager({
      clientId: 'test',
      clientSecret: 'test',
      refreshToken: 'test'
    });

    assert.strictEqual(manager.isTokenValid(), false);
  });

  it('should clear token', () => {
    const manager = new TokenManager({
      clientId: 'test',
      clientSecret: 'test',
      refreshToken: 'test'
    });

    manager.accessToken = 'test-token';
    manager.tokenExpiry = Date.now() + 3600000;

    assert.strictEqual(manager.isTokenValid(), true);

    manager.clearToken();

    assert.strictEqual(manager.accessToken, null);
    assert.strictEqual(manager.tokenExpiry, null);
    assert.strictEqual(manager.isTokenValid(), false);
  });
});

describe('createAuthHeaders', () => {
  it('should create headers with access token', () => {
    const headers = createAuthHeaders('test-token-123');

    assert.strictEqual(headers['x-amz-access-token'], 'test-token-123');
    assert.strictEqual(headers['Content-Type'], 'application/json');
  });
});

// Endpoint Utilities Tests
describe('Regional Endpoints', () => {
  it('should have NA endpoint', () => {
    assert.strictEqual(REGIONAL_ENDPOINTS.na, 'https://sellingpartnerapi-na.amazon.com');
  });

  it('should have EU endpoint', () => {
    assert.strictEqual(REGIONAL_ENDPOINTS.eu, 'https://sellingpartnerapi-eu.amazon.com');
  });

  it('should have FE endpoint', () => {
    assert.strictEqual(REGIONAL_ENDPOINTS.fe, 'https://sellingpartnerapi-fe.amazon.com');
  });
});

describe('getRegionalEndpoint', () => {
  it('should return NA endpoint for na region', () => {
    assert.strictEqual(getRegionalEndpoint('na'), 'https://sellingpartnerapi-na.amazon.com');
  });

  it('should return EU endpoint for eu region', () => {
    assert.strictEqual(getRegionalEndpoint('eu'), 'https://sellingpartnerapi-eu.amazon.com');
  });

  it('should default to NA for unknown region', () => {
    assert.strictEqual(getRegionalEndpoint('unknown'), 'https://sellingpartnerapi-na.amazon.com');
  });
});

describe('validateRequestSpec', () => {
  it('should validate valid spec', () => {
    const result = validateRequestSpec({
      method: 'GET',
      path: '/orders/v0/orders'
    });

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('should require path', () => {
    const result = validateRequestSpec({
      method: 'GET'
    });

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('path')));
  });

  it('should validate HTTP method', () => {
    const result = validateRequestSpec({
      method: 'INVALID',
      path: '/test'
    });

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Invalid method')));
  });

  it('should check for missing path parameters', () => {
    const result = validateRequestSpec({
      path: '/orders/v0/orders/{orderId}',
      pathParams: {}
    });

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('orderId')));
  });

  it('should pass when path params are provided', () => {
    const result = validateRequestSpec({
      path: '/orders/v0/orders/{orderId}',
      pathParams: { orderId: '123-456' }
    });

    assert.strictEqual(result.valid, true);
  });

  it('should fail for null spec', () => {
    const result = validateRequestSpec(null);

    assert.strictEqual(result.valid, false);
  });
});

// Client Tests
describe('SPAPIClient', () => {
  it('should initialize with config', () => {
    const client = new SPAPIClient({
      clientId: 'test',
      clientSecret: 'test',
      refreshToken: 'test',
      region: 'na'
    });

    assert.strictEqual(client.baseUrl, 'https://sellingpartnerapi-na.amazon.com');
  });

  it('should use EU endpoint for EU region', () => {
    const client = new SPAPIClient({
      clientId: 'test',
      clientSecret: 'test',
      refreshToken: 'test',
      region: 'eu'
    });

    assert.strictEqual(client.baseUrl, 'https://sellingpartnerapi-eu.amazon.com');
  });

  it('should use FE endpoint for FE region', () => {
    const client = new SPAPIClient({
      clientId: 'test',
      clientSecret: 'test',
      refreshToken: 'test',
      region: 'fe'
    });

    assert.strictEqual(client.baseUrl, 'https://sellingpartnerapi-fe.amazon.com');
  });

  it('should default to NA region', () => {
    const client = new SPAPIClient({
      clientId: 'test',
      clientSecret: 'test',
      refreshToken: 'test'
    });

    assert.strictEqual(client.baseUrl, 'https://sellingpartnerapi-na.amazon.com');
  });

  it('should allow custom endpoint', () => {
    const client = new SPAPIClient({
      clientId: 'test',
      clientSecret: 'test',
      refreshToken: 'test',
      endpoint: 'https://custom.endpoint.com'
    });

    assert.strictEqual(client.baseUrl, 'https://custom.endpoint.com');
  });

  describe('buildUrl', () => {
    let client;

    beforeEach(() => {
      client = new SPAPIClient({
        clientId: 'test',
        clientSecret: 'test',
        refreshToken: 'test'
      });
    });

    it('should build URL without parameters', () => {
      const url = client.buildUrl('/orders/v0/orders', {}, {});
      assert.strictEqual(url, 'https://sellingpartnerapi-na.amazon.com/orders/v0/orders');
    });

    it('should build URL with path parameters', () => {
      const url = client.buildUrl('/orders/v0/orders/{orderId}', { orderId: '123-456' }, {});
      assert.strictEqual(url, 'https://sellingpartnerapi-na.amazon.com/orders/v0/orders/123-456');
    });

    it('should encode path parameters', () => {
      const url = client.buildUrl('/orders/v0/orders/{orderId}', { orderId: 'order with spaces' }, {});
      assert.ok(url.includes('order%20with%20spaces'));
    });

    it('should build URL with query parameters', () => {
      const url = client.buildUrl('/orders/v0/orders', {}, {
        MarketplaceIds: 'ATVPDKIKX0DER',
        CreatedAfter: '2024-01-01'
      });

      assert.ok(url.includes('MarketplaceIds=ATVPDKIKX0DER'));
      assert.ok(url.includes('CreatedAfter=2024-01-01'));
    });

    it('should handle array query parameters', () => {
      const url = client.buildUrl('/orders/v0/orders', {}, {
        MarketplaceIds: ['ATVPDKIKX0DER', 'A2EUQ1WTGCTBG2']
      });

      assert.ok(url.includes('MarketplaceIds=ATVPDKIKX0DER,A2EUQ1WTGCTBG2'));
    });

    it('should throw for missing path parameter', () => {
      assert.throws(
        () => client.buildUrl('/orders/v0/orders/{orderId}', {}, {}),
        /Missing path parameter: orderId/
      );
    });
  });
});

describe('createClient', () => {
  it('should create a client instance', () => {
    const client = createClient({
      clientId: 'test',
      clientSecret: 'test',
      refreshToken: 'test'
    });

    assert.ok(client instanceof SPAPIClient);
  });
});

describe('SPAPIError', () => {
  it('should create error with details', () => {
    const error = new SPAPIError({
      status: 400,
      statusText: 'Bad Request',
      body: { message: 'Invalid parameter' }
    });

    assert.strictEqual(error.name, 'SPAPIError');
    assert.strictEqual(error.status, 400);
    assert.strictEqual(error.errorMessage, 'Invalid parameter');
    assert.ok(error.message.includes('400'));
  });

  it('should identify retryable errors', () => {
    const rateLimitError = new SPAPIError({
      status: 429,
      statusText: 'Too Many Requests',
      body: {}
    });

    const serverError = new SPAPIError({
      status: 503,
      statusText: 'Service Unavailable',
      body: {}
    });

    const clientError = new SPAPIError({
      status: 400,
      statusText: 'Bad Request',
      body: {}
    });

    assert.strictEqual(rateLimitError.isRetryable(), true);
    assert.strictEqual(serverError.isRetryable(), true);
    assert.strictEqual(clientError.isRetryable(), false);
  });

  it('should provide retry delays', () => {
    const rateLimitError = new SPAPIError({
      status: 429,
      statusText: 'Too Many Requests',
      body: {}
    });

    const serverError = new SPAPIError({
      status: 500,
      statusText: 'Internal Server Error',
      body: {}
    });

    assert.strictEqual(rateLimitError.getRetryDelay(), 2000);
    assert.strictEqual(serverError.getRetryDelay(), 1000);
  });
});
