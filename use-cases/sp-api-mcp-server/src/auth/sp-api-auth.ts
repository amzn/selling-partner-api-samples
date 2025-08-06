// src/auth/sp-api-auth.ts

import axios from 'axios';
import aws4 from 'aws4';
import { URL } from 'url';
import { logger } from '../utils/logger.js';

interface SpApiCredentials {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    roleArn?: string;
    baseUrl?: string;
}

interface TokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

export class SpApiAuthenticator {
    private accessToken: string | null = null;
    private tokenExpiration: Date | null = null;

    constructor(private credentials: SpApiCredentials) { }

    /**
     * Get the configured base URL for SP-API requests
     */
    getBaseUrl(): string {
        return this.credentials.baseUrl || 'https://sellingpartnerapi-na.amazon.com';
    }

    /**
  * Get a valid access token, refreshing if necessary
  * @throws Error if token cannot be obtained
  */
    async getAccessToken(): Promise<string> {
        // Check if token is still valid
        if (this.accessToken && this.tokenExpiration && this.tokenExpiration > new Date()) {
            return this.accessToken;
        }

        // Otherwise, refresh the token
        try {
            logger.info('Refreshing SP-API access token');

            const params = new URLSearchParams();
            params.append('grant_type', 'refresh_token');
            params.append('refresh_token', this.credentials.refreshToken);
            params.append('client_id', this.credentials.clientId);
            params.append('client_secret', this.credentials.clientSecret);

            // Get the OAuth URL from environment or use default
            const oauthUrl = process.env.SP_API_OAUTH_URL || 'https://api.amazon.com/auth/o2/token';

            // Use axios for the request
            const response = await axios.post<TokenResponse>(
                oauthUrl,
                params.toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    }
                }
            );

            // Ensure we have a valid access token
            if (!response.data.access_token) {
                throw new Error('No access token received in the response');
            }

            this.accessToken = response.data.access_token;

            // Set expiration time (subtract 5 minutes for safety)
            const expiresIn = (response.data.expires_in - 300) * 1000;
            this.tokenExpiration = new Date(Date.now() + expiresIn);

            logger.info('Successfully refreshed SP-API access token');
            logger.info(`Token expires in ${expiresIn / 1000} seconds (${this.tokenExpiration})`);
            logger.info(this.accessToken);

            return this.accessToken;
        } catch (error) {
            logger.error('Failed to refresh SP-API access token:', error);
            this.accessToken = null;
            this.tokenExpiration = null;
            throw new Error('Failed to authenticate with SP-API: ' + (error instanceof Error ? error.message : String(error)));
        }
    }

    /**
  * Prepare a request with the required SP-API authentication
  */
    async signRequest(request: {
        method: string;
        url: string;
        headers: Record<string, string>;
        body?: any;
    }): Promise<{
        method: string;
        url: string;
        headers: Record<string, string>;
        body?: any;
    }> {
        try {
            // Get access token
            const accessToken = await this.getAccessToken();
            logger.info('Successfully obtained access token for request');

            // Add access token to headers
            const headers = {
                ...request.headers,
                'x-amz-access-token': accessToken
            };

            // Log request details for debugging (without sensitive info)
            logger.info(`Preparing request for ${request.method} ${request.url}`);

            // Return the request with the access token added
            return {
                method: request.method,
                url: request.url,
                headers: headers,
                body: request.body
            };
        } catch (error) {
            logger.info('Failed to prepare SP-API request:', error);
            throw new Error('Failed to prepare SP-API request: ' + (error instanceof Error ? error.message : String(error)));
        }
    }
}
// Factory to create authenticator from environment variables
export const createAuthenticatorFromEnv = (): SpApiAuthenticator => {
    const clientId = process.env.SP_API_CLIENT_ID || "";
    const clientSecret = process.env.SP_API_CLIENT_SECRET
    const refreshToken = process.env.SP_API_REFRESH_TOKEN;
    const baseUrl = process.env.SP_API_BASE_URL;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Missing required SP-API credentials in environment variables');
    }

    return new SpApiAuthenticator({
        clientId,
        clientSecret,
        refreshToken,
        baseUrl
    });
}
