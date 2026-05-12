/**
 * SP-API Authentication
 *
 * Handles OAuth/LWA (Login with Amazon) token management
 * for SP-API authentication.
 */

/**
 * Token Manager class
 * Manages access token lifecycle for SP-API authentication
 */
export class TokenManager {
  /**
   * @param {object} config
   * @param {string} config.clientId - SP-API client ID
   * @param {string} config.clientSecret - SP-API client secret
   * @param {string} config.refreshToken - SP-API refresh token
   * @param {string} config.authEndpoint - LWA auth endpoint
   */
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.refreshToken = config.refreshToken;
    this.authEndpoint = config.authEndpoint || 'https://api.amazon.com/auth/o2/token';

    // Token cache
    this.accessToken = null;
    this.tokenExpiry = null;

    // Token refresh buffer (refresh 5 minutes before expiry)
    this.expiryBuffer = 5 * 60 * 1000;
  }

  /**
   * Get a valid access token
   * Returns cached token if valid, otherwise refreshes
   *
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    if (this.isTokenValid()) {
      return this.accessToken;
    }

    return this.refreshAccessToken();
  }

  /**
   * Check if current token is still valid
   *
   * @returns {boolean} True if token is valid
   */
  isTokenValid() {
    if (!this.accessToken || !this.tokenExpiry) {
      return false;
    }

    const now = Date.now();
    return now < (this.tokenExpiry - this.expiryBuffer);
  }

  /**
   * Refresh the access token using the refresh token
   *
   * @returns {Promise<string>} New access token
   */
  async refreshAccessToken() {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret
    });

    const response = await fetch(this.authEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    this.accessToken = data.access_token;
    // Token typically expires in 3600 seconds (1 hour)
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);

    return this.accessToken;
  }

  /**
   * Clear cached token (for testing or forced refresh)
   */
  clearToken() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }
}

/**
 * Create authorization headers for SP-API request
 *
 * @param {string} accessToken - Valid access token
 * @returns {object} Headers object
 */
export function createAuthHeaders(accessToken) {
  return {
    'x-amz-access-token': accessToken,
    'Content-Type': 'application/json'
  };
}
