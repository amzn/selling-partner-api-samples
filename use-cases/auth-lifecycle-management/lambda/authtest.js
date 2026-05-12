const axios = require('./spApiLogger');


class AuthorizationTest {
    static abc = 'Auth Management Sample App/1.0/JavaScript';

    constructor(region, marketplace) {
        this.region = region;
        this.marketplace = marketplace;
    }

    // Helper method to get SP-API endpoint based on region
    getSpApiEndpoint() {
        const endpoints = {
            NA: process.env.SPAPI_ENDPOINT_NA,
            EU: process.env.SPAPI_ENDPOINT_EU,
            FE: process.env.SPAPI_ENDPOINT_FE
        };
        return endpoints[this.region] || endpoints.NA;
    }

    // Helper method to get AWS region based on SP-API region
    getAwsRegion() {
        const regions = {
            NA: process.env.AWS_REGION_NA,
            EU: process.env.AWS_REGION_EU,
            FE: process.env.AWS_REGION_FE
        };
        return regions[this.region] || regions.NA;
    }

    // Get fresh access token
    static async refreshAccessToken(partner, appCredentials) {
        try {
            // Determine which credentials to use (partner's own or app credentials)
            const clientId = partner.clientId || appCredentials.clientId;
            const clientSecret = partner.clientSecret || appCredentials.clientSecret;

            if (!partner.refreshToken) {
                throw new Error('No refresh token available for partner');
            }

            const tokenResponse = await axios.post(
                process.env.TOKEN_ENDPOINT,
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: partner.refreshToken,
                    client_id: clientId,
                    client_secret: clientSecret
                }).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            return {
                accessToken: tokenResponse.data.access_token,
                expiresIn: tokenResponse.data.expires_in,
                tokenType: tokenResponse.data.token_type
            };
        } catch (error) {
            console.error('Token refresh error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to refresh access token');
        }
    }

    // Test vendor authorization using Direct Fulfillment Orders API
    async testVendorAuth(accessToken) {
        try {
            const endpoint = this.getSpApiEndpoint();
            
            // Calculate date range
            const now = new Date();
            const createdBefore = now.toISOString();
            const createdAfter = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString(); // 30 days ago
            
            const response = await axios.get(
                `${endpoint}/vendor/directFulfillment/orders/v1/purchaseOrders`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'x-amz-access-token': accessToken,
                        'Content-Type': 'application/json',
                        'User-Agent': AuthorizationTest.abc
                    },
                    params: {
                        createdAfter: createdAfter,
                        createdBefore: createdBefore,
                        limit: 1,
                        sortOrder: 'DESC'
                    },
                    paramsSerializer: params => {
                        return Object.entries(params)
                            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                            .join('&');
                    }
                }
            );

            return {
                success: true,
                statusCode: response.status,
                message: "Successfully accessed Vendor Direct Fulfillment Orders API"
            };
        } catch (error) {
            if (error.response?.data?.errors) {
                const errorMessage = error.response.data.errors
                    .map(err => `${err.code}: ${err.message}`)
                    .join('; ');
                throw new Error(errorMessage);
            }
            console.error('Vendor auth test error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to test vendor authorization');
        }
    }

    // Test seller authorization using Orders API
    async testSellerAuth(accessToken) {
        try {
            const endpoint = this.getSpApiEndpoint();
            const createdAfter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
            
            const response = await axios.get(
                `${endpoint}/orders/v0/orders`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'x-amz-access-token': accessToken,
                        'Content-Type': 'application/json'
                    },
                    params: {
                        MarketplaceIds: this.marketplace,
                        CreatedAfter: createdAfter
                    },
                    paramsSerializer: params => {
                        return Object.entries(params)
                            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                            .join('&');
                    }
                }
            );

            return {
                success: true,
                statusCode: response.status,
                message: "Successfully accessed Orders API"
            };
        } catch (error) {
            console.error('Seller auth test error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to test seller authorization');
        }
    }
}

module.exports = AuthorizationTest;