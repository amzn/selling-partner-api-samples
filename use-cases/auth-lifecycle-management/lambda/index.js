const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const AppstoreAuthorization = require('./appstore');
const AuthorizationTest = require('./authtest');
const NotificationManager = require('./notifications');
const CredentialRotation = require('./credentialRotation');
const StatusManager = require('./statusManager');
const ReminderManager = require('./reminderManager');

const {
    UpdateSecretCommand // Add this import
} = require("@aws-sdk/client-secrets-manager");

const {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,  // Add this import
    ScanCommand,
    DeleteCommand
} = require("@aws-sdk/lib-dynamodb");
const axios = require('./spApiLogger');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const secretsClient = new SecretsManagerClient();
const dynamoClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Region and marketplace configurations
const REGIONS = {
    NA: {
        code: 'NA',
        name: 'North America',
        endpoint: process.env.SPAPI_ENDPOINT_NA,
        awsRegion: process.env.AWS_REGION_NA,
        marketplaces: {
            CA: { name: 'Canada', sellerCentral: 'https://sellercentral.amazon.ca', vendorCentral: 'https://vendorcentral.amazon.ca' },
            US: { name: 'United States', sellerCentral: 'https://sellercentral.amazon.com', vendorCentral: 'https://vendorcentral.amazon.com' },
            MX: { name: 'Mexico', sellerCentral: 'https://sellercentral.amazon.com.mx', vendorCentral: 'https://vendorcentral.amazon.com.mx' },
            BR: { name: 'Brazil', sellerCentral: 'https://sellercentral.amazon.com.br', vendorCentral: 'https://vendorcentral.amazon.com.br' }
        }
    },
    EU: {
        code: 'EU',
        name: 'Europe',
        endpoint: process.env.SPAPI_ENDPOINT_EU,
        awsRegion: process.env.AWS_REGION_EU,
        marketplaces: {
            ES: { name: 'Spain', sellerCentral: 'https://sellercentral-europe.amazon.com', vendorCentral: 'https://vendorcentral.amazon.es' },
            UK: { name: 'United Kingdom', sellerCentral: 'https://sellercentral-europe.amazon.com', vendorCentral: 'https://vendorcentral.amazon.co.uk' },
            FR: { name: 'France', sellerCentral: 'https://sellercentral-europe.amazon.com', vendorCentral: 'https://vendorcentral.amazon.fr' },
            BE: { name: 'Belgium', sellerCentral: 'https://sellercentral.amazon.com.be', vendorCentral: 'https://vendorcentral.amazon.com.be' },
            NL: { name: 'Netherlands', sellerCentral: 'https://sellercentral.amazon.nl', vendorCentral: 'https://vendorcentral.amazon.nl' },
            DE: { name: 'Germany', sellerCentral: 'https://sellercentral-europe.amazon.com', vendorCentral: 'https://vendorcentral.amazon.de' },
            IT: { name: 'Italy', sellerCentral: 'https://sellercentral-europe.amazon.com', vendorCentral: 'https://vendorcentral.amazon.it' },
            SE: { name: 'Sweden', sellerCentral: 'https://sellercentral.amazon.se', vendorCentral: 'https://vendorcentral.amazon.se' },
            PL: { name: 'Poland', sellerCentral: 'https://sellercentral.amazon.pl', vendorCentral: 'https://vendorcentral.amazon.pl' },
            EG: { name: 'Egypt', sellerCentral: 'https://sellercentral.amazon.eg', vendorCentral: 'https://vendorcentral.amazon.me' },
            TR: { name: 'Turkey', sellerCentral: 'https://sellercentral.amazon.com.tr', vendorCentral: 'https://vendorcentral.amazon.com.tr' },
            SA: { name: 'Saudi Arabia', sellerCentral: 'https://sellercentral.amazon.sa', vendorCentral: 'https://vendorcentral.amazon.me' },
            AE: { name: 'U.A.E.', sellerCentral: 'https://sellercentral.amazon.ae', vendorCentral: 'https://vendorcentral.amazon.me' },
            IN: { name: 'India', sellerCentral: 'https://sellercentral.amazon.in', vendorCentral: 'https://www.vendorcentral.in' }
        }
    },
    FE: {
        code: 'FE',
        name: 'Far East',
        endpoint: process.env.SPAPI_ENDPOINT_FE,
        awsRegion: process.env.AWS_REGION_FE,
        marketplaces: {
            SG: { name: 'Singapore', sellerCentral: 'https://sellercentral.amazon.sg', vendorCentral: 'https://vendorcentral.amazon.com.sg' },
            AU: { name: 'Australia', sellerCentral: 'https://sellercentral.amazon.com.au', vendorCentral: 'https://vendorcentral.amazon.com.au' },
            JP: { name: 'Japan', sellerCentral: 'https://sellercentral.amazon.co.jp', vendorCentral: 'https://vendorcentral.amazon.co.jp' }
        }
    }
};


// In lambda/index.js, add these helper functions:
function validateCredentials(credentials) {
    // Add any specific validation rules for your credentials
    if (typeof credentials.clientId !== 'string' || credentials.clientId.length < 1) {
        throw new Error('Invalid Client ID format');
    }
    if (typeof credentials.clientSecret !== 'string' || credentials.clientSecret.length < 1) {
        throw new Error('Invalid Client Secret format');
    }
    if (typeof credentials.applicationId !== 'string' || credentials.applicationId.length < 1) {
        throw new Error('Invalid Application ID format');
    }
}

// Then, update the formatResponse function to ensure it always includes ALL necessary CORS headers
function formatResponse(statusCode, body, additionalHeaders = {}) {
    return {
        statusCode,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
            'Content-Type': 'application/json',
            ...additionalHeaders
        },
        body: typeof body === 'string' ? body : JSON.stringify(body)
    };
}

// Add this function to your handler
async function setupNotifications(partnerId) {
    try {
        const partner = await getPartner(partnerId);
        if (!partner) {
            throw new Error('Partner not found');
        }

        const accessToken = await getClientCredentialsToken(
            partner,
            'sellingpartnerapi::notifications'
        );

        const notificationManager = new NotificationManager(partner.apiEndpoint);
        const queueArn = process.env.CLIENT_SECRET_QUEUE_ARN;

        if (!queueArn) {
            throw new Error('Queue ARN not configured');
        }

        const destinations = await notificationManager.getDestinations(accessToken);
        let destination = destinations.find(d =>
            d.resourceSpecification?.sqs?.arn === queueArn
        );

        if (destination) {
            return {
                success: true,
                destinationId: destination.destinationId,
                queueArn,
                message: 'Existing destination found. Please subscribe to APPLICATION_OAUTH_CLIENT_NEW_SECRET notifications in the Seller/Vendor Central portal.',
                existingDestination: true
            };
        }

        destination = await notificationManager.createDestination(
            queueArn,
            `Client Secret Notifications - ${partnerId}`,
            accessToken
        );

        await docClient.send(new PutCommand({
            TableName: process.env.PARTNERS_TABLE,
            Item: {
                ...partner,
                notificationConfig: {
                    destinationId: destination.destinationId,
                    queueArn,
                    updatedAt: new Date().toISOString()
                }
            }
        }));

        return {
            success: true,
            destinationId: destination.destinationId,
            queueArn,
            message: 'Destination created successfully. Please subscribe to APPLICATION_OAUTH_CLIENT_NEW_SECRET notifications in the Seller/Vendor Central portal.',
            existingDestination: false
        };

    } catch (error) {
        if (error.response?.data?.errors) {
            const apiError = error.response.data.errors[0];
            throw new Error(`SP-API Error: ${apiError.code} - ${apiError.message} ${apiError.details || ''}`);
        }
        throw error;
    }
}

// Add new helper function to parse form data
function parseFormData(body) {
    try {
        const params = new URLSearchParams(body);
        const data = {};
        for (const [key, value] of params) {
            data[key] = value;
        }
        return data;
    } catch (error) {
        console.error('Error parsing form data:', error);
        throw new Error('Invalid form data format');
    }
}

async function createPartner(data, contentType) {
    // Handle application/x-www-form-urlencoded for self auth
    if (contentType === 'application/x-www-form-urlencoded') {
        const formData = parseFormData(data);

        // Validate required fields for self auth
        if (!formData.refresh_token || !formData.client_id || !formData.client_secret) {
            throw new Error('Missing required credentials: refresh_token, client_id, and client_secret are required');
        }

        // Create a self-auth partner with the provided credentials
        return await createPartnerWithCredentials({
            authType: 'self',
            type: 'seller', // Default to seller, can be overridden if needed
            name: `Self Auth Partner ${formData.client_id.slice(-6)}`, // Generate a name using last 6 chars of client_id
            region: 'NA', // Default to NA, can be overridden if needed
            marketplace: 'US', // Default to US, can be overridden if needed
            credentials: {
                refreshToken: formData.refresh_token,
                clientId: formData.client_id,
                clientSecret: formData.client_secret
            }
        });
    }

    // Handle JSON requests (existing flow)
    if (!data.region || !REGIONS[data.region]) {
        throw new Error('Invalid region. Must be one of: NA, EU, FE');
    }

    if (!data.marketplace || !REGIONS[data.region].marketplaces[data.marketplace]) {
        throw new Error(`Invalid marketplace for region ${data.region}`);
    }

    return await createPartnerWithCredentials(data);
}

async function createPartnerWithCredentials(data) {
    const partnerId = uuidv4();
    const now = new Date().toISOString();
    const region = REGIONS[data.region];
    const marketplace = region.marketplaces[data.marketplace];

    const item = {
        partnerId,
        name: data.name,
        type: data.type,
        authType: data.authType,  // This was missing
        region: data.region,
        marketplace: data.marketplace,
        marketplaceName: marketplace.name,
        apiEndpoint: region.endpoint,
        awsRegion: region.awsRegion,
        createdAt: now,
        updatedAt: now,
        status: 'PENDING_AUTH'  // This should be 'AUTHORIZED' for self-auth
    };

    // For self auth, store credentials and set status to AUTHORIZED
    if (data.authType === 'self' && data.credentials) {
        item.refreshToken = data.credentials.refreshToken;
        item.clientId = data.credentials.clientId;
        item.clientSecret = data.credentials.clientSecret;
        item.status = 'AUTHORIZED';  // Self-auth partners are always authorized
        item.lastTokenRefresh = now;
    }

    // For OAuth flow, add auth endpoint
    if (data.authType === 'oauth') {
        item.authEndpoint = `${data.type === 'seller' ? marketplace.sellerCentral : marketplace.vendorCentral}/apps/authorize/consent`;
        item.status = 'PENDING_AUTH';
    }

    await docClient.send(new PutCommand({
        TableName: process.env.PARTNERS_TABLE,
        Item: item
    }));

    // Don't return sensitive credentials in response
    const response = { ...item };
    delete response.clientSecret;
    return response;
}


// Cache for credentials
let cachedCredentials = null;
let credentialsLastFetched = null;
const CREDENTIALS_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

async function getCredentials() {
    if (cachedCredentials && credentialsLastFetched &&
        (Date.now() - credentialsLastFetched) < CREDENTIALS_CACHE_DURATION) {
        return cachedCredentials;
    }

    try {
        const command = new GetSecretValueCommand({
            SecretId: process.env.SECRETS_ARN
        });

        const response = await secretsClient.send(command);
        const secrets = JSON.parse(response.SecretString);

        cachedCredentials = {
            applicationId: secrets.applicationId,
            clientId: secrets.clientId,
            clientSecret: secrets.clientSecret
        };
        credentialsLastFetched = Date.now();

        return cachedCredentials;
    } catch (error) {
        console.error('Error fetching credentials:', error);
        throw new Error('Failed to retrieve credentials');
    }
}

async function getPartner(partnerId) {
    const result = await docClient.send(new GetCommand({
        TableName: process.env.PARTNERS_TABLE,
        Key: { partnerId }
    }));
    return result.Item;
}

async function deletePartner(partnerId) {
    await docClient.send(new DeleteCommand({
        TableName: process.env.PARTNERS_TABLE,
        Key: { partnerId }
    }));
}

async function updatePartnerTokens(partnerId, tokens, amazonId) {
    const partner = await getPartner(partnerId);
    const now = new Date().toISOString();

    await docClient.send(new PutCommand({
        TableName: process.env.PARTNERS_TABLE,
        Item: {
            ...partner,
            amazonId,
            refreshToken: tokens.refresh_token,
            status: 'AUTHORIZED',
            updatedAt: now,
            lastTokenRefresh: now
        }
    }));
}

async function listPartners() {
    const result = await docClient.send(new ScanCommand({
        TableName: process.env.PARTNERS_TABLE
    }));
    return result.Items;
}

async function storeState(state, stateData) {
    const ttl = Math.floor(Date.now() / 1000) + (15 * 60); // 15 minutes

    const item = {
        state: state, // This is our partition key, must be a string
        partnerId: stateData.partnerId,
        ttl: ttl,
        createdAt: new Date().toISOString(),
        metadata: {
            isReauthorization: stateData.isReauthorization || false,
            previousRefreshToken: stateData.previousRefreshToken || null
        }
    };

    await docClient.send(new PutCommand({
        TableName: process.env.STATE_TABLE_NAME,
        Item: item
    }));

    return state;
}

async function verifyState(state) {
    const result = await docClient.send(new GetCommand({
        TableName: process.env.STATE_TABLE_NAME,
        Key: { state }
    }));
    return result.Item;
}

function generateState() {
    return crypto.randomBytes(32).toString('hex');
}

async function getClientCredentialsToken(partner, scope) {
    try {
        if (!partner.clientId || !partner.clientSecret) {
            throw new Error('Partner client ID and client secret are required');
        }

        const tokenResponse = await axios.post(
            process.env.TOKEN_ENDPOINT,
            new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: partner.clientId,
                client_secret: partner.clientSecret,
                scope: scope
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        return tokenResponse.data.access_token;
    } catch (error) {
        console.error('Error retrieving client credentials token:', error);
        throw new Error('Failed to retrieve client credentials token');
    }
}

exports.handler = async (event, context) => {
    try {
        const path = event.path || '';
        const method = event.httpMethod;
        const { partnerId } = event.pathParameters || {};
        const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'];
        // Handle OPTIONS request for CORS
        // In lambda/index.js, find the export.handler function
        // Locate the following section for handling OPTIONS requests

        // Handle OPTIONS request for CORS - make sure this comes first
        if (method === 'OPTIONS') {
            return formatResponse(200, '');
        }
        // Partner Management Endpoints
        if (path.endsWith('/partners') && method === 'POST') {
            // For application/x-www-form-urlencoded requests
            if (contentType === 'application/x-www-form-urlencoded') {
                const partner = await createPartner(event.body, contentType);
                return formatResponse(201, {
                    body: JSON.stringify(partner)
                });
            }

            // For JSON requests
            const body = JSON.parse(event.body);
            if (!body.name || !body.type || !['seller', 'vendor'].includes(body.type) ||
                !body.region || !body.marketplace || !body.authType ||
                !['oauth', 'self'].includes(body.authType)) {
                return formatResponse(400, {
                    body: JSON.stringify({
                        error: 'Invalid partner data. Required: name, type (seller/vendor), region, marketplace, and authType (oauth/self)'
                    })
                });
            }
            const partner = await createPartner(body, contentType);
            return formatResponse(201, {
                body: JSON.stringify(partner)
            });
        }

        if (path.endsWith('/partners') && method === 'GET') {
            const partners = await listPartners();
            return formatResponse(200, {
                partners,
                regions: Object.entries(REGIONS).map(([code, region]) => ({
                    code,
                    name: region.name,
                    marketplaces: Object.entries(region.marketplaces).map(([code, mp]) => ({
                        code,
                        name: mp.name
                    }))
                }))
            });
        }


        if (partnerId && path.endsWith(partnerId) && method === 'GET') {
            const partner = await getPartner(partnerId);
            if (!partner) {
                return formatResponse(404, {
                    body: JSON.stringify({ error: 'Partner not found' })
                });
            }
            return formatResponse(200, {
                body: JSON.stringify(partner)
            });
        }

        if (partnerId && path.endsWith(partnerId) && method === 'DELETE') {
            await deletePartner(partnerId);
            return formatResponse(204, {
            });
        }

        // OAuth Flow Endpoints
        // In the OAuth initialization handler
        // In the OAuth initialization handler
        if (path.includes('/oauth/init') && method === 'POST') {
            const partner = await getPartner(partnerId);
            if (!partner) {
                return formatResponse(404, {
                    error: 'Partner not found'
                });
            }

            // Allow reauthorization even if already authorized
            if (!['PENDING_AUTH', 'AUTHORIZED'].includes(partner.status)) {
                return formatResponse(400, {
                    error: 'Partner is in an invalid state for authorization'
                });
            }

            try {
                const credentials = await getCredentials();
                const state = generateState();

                // Store state with proper structure
                await storeState(state, {
                    partnerId: partnerId,
                    isReauthorization: partner.status === 'AUTHORIZED',
                    previousRefreshToken: partner.refreshToken
                });

                // Get base URL based on partner type and marketplace
                let authUrl;
                if (partner.authType === 'appstore') {
                    const region = REGIONS[partner.region];
                    const marketplace = region.marketplaces[partner.marketplace];
                    const baseUrl = partner.type === 'seller' ?
                        marketplace.sellerCentral :
                        marketplace.vendorCentral;
                    authUrl = new URL('/apps/authorize/consent', baseUrl);
                } else {
                    authUrl = new URL(partner.authEndpoint);
                }

                // Add common parameters
                authUrl.searchParams.append('application_id', credentials.applicationId);
                authUrl.searchParams.append('state', state);
                authUrl.searchParams.append('version', 'beta');

                // Use same callback URL for both auth types
                const domain = event.requestContext.domainName;
                const stage = process.env.API_STAGE;
                const callbackUrl = `https://${domain}/${stage}/partners/oauth/callback`;
                authUrl.searchParams.append('redirect_uri', callbackUrl);

                return formatResponse(200, {
                    authorizationUrl: authUrl.toString(),
                    state,
                    isReauthorization: partner.status === 'AUTHORIZED'
                });
            } catch (error) {
                console.error('Error in OAuth initialization:', error);
                return formatResponse(500, {
                    error: 'Failed to initialize authorization',
                    message: error.message
                });
            }
        }

        // In the OAuth callback handler
        // In index.js, remove appstore-specific callback and update oauth/callback to handle both
        if (path.includes('/oauth/callback')) {
            const { spapi_oauth_code, state, selling_partner_id } = event.queryStringParameters || {};

            if (!spapi_oauth_code || !state || !selling_partner_id) {
                return formatResponse(400, {
                    error: 'Missing required parameters',
                    message: 'Required parameters: state, selling_partner_id, spapi_oauth_code'
                });
            }

            const stateData = await verifyState(state);
            if (!stateData) {
                return formatResponse(400, {
                    error: 'Invalid state token'
                });
            }

            if (!stateData.partnerId) {
                return formatResponse(400, {
                    error: 'Invalid state data: missing partnerId'
                });
            }

            // Construct callback URL
            const domain = event.requestContext.domainName;
            const stage = process.env.API_STAGE;
            const callbackUrl = `https://${domain}/${stage}/partners/oauth/callback`;

            try {
                const credentials = await getCredentials();
                const tokenResponse = await axios.post(process.env.TOKEN_ENDPOINT,
                    new URLSearchParams({
                        grant_type: 'authorization_code',
                        code: spapi_oauth_code,
                        client_id: credentials.clientId,
                        client_secret: credentials.clientSecret,
                        redirect_uri: callbackUrl
                    }).toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                // Handle token history for reauthorization
                if (stateData.metadata?.isReauthorization && stateData.metadata?.previousRefreshToken) {
                    await storeTokenHistory(
                        stateData.partnerId,
                        stateData.metadata.previousRefreshToken,
                        tokenResponse.data.refresh_token,
                        'reauthorization'
                    );
                }

                await updatePartnerTokens(stateData.partnerId, tokenResponse.data, selling_partner_id);

                const webappDomain = process.env.WEBAPP_DOMAIN || event.headers.Referer?.split('/')[2];
                if (webappDomain) {
                    return {
                        statusCode: 302,
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Credentials': true,
                            'Location': `https://${webappDomain}?success=true&partnerId=${stateData.partnerId}&reauthorized=${stateData.metadata?.isReauthorization || false}`
                        },
                        body: ''
                    };
                }

                return formatResponse(200, {
                    message: stateData.metadata?.isReauthorization ? 'Reauthorization successful' : 'Authorization successful',
                    partnerId: stateData.partnerId
                });
            } catch (error) {
                console.error('Token exchange error:', error);
                throw error;
            }
        }

        // Add this function to store token history only when there's a change
        async function storeTokenHistory(partnerId, oldToken, newToken, reason) {
            // Only store history if the tokens are different
            if (oldToken === newToken) {
                return;
            }

            const timestamp = new Date().toISOString();
            const ttl = Math.floor(Date.now() / 1000) + (180 * 24 * 60 * 60); // 180 days retention

            await docClient.send(new PutCommand({
                TableName: process.env.TOKENS_HISTORY_TABLE,
                Item: {
                    partnerId,
                    timestamp,
                    oldToken: oldToken,
                    newToken: newToken,
                    reason,
                    ttl,
                    metadata: {
                        userAgent: event.requestContext?.identity?.userAgent,
                        sourceIp: event.requestContext?.identity?.sourceIp,
                        requestId: event.requestContext?.requestId
                    }
                }
            }));
        }

        // Updated OAuth refresh token handling
        if (path.includes('/oauth/refresh') && method === 'POST') {
            const partner = await getPartner(partnerId);
            if (!partner || !partner.refreshToken) {
                return formatResponse(404, {
                    body: JSON.stringify({ error: 'Partner not found or not authorized' })
                });
            }

            try {
                const credentials = await getCredentials();
                const oldRefreshToken = partner.refreshToken;

                const tokenResponse = await axios.post(process.env.TOKEN_ENDPOINT,
                    new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: oldRefreshToken,
                        client_id: credentials.clientId,
                        client_secret: credentials.clientSecret
                    }).toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                // Check if Amazon provided a new refresh token that's different from the current one
                if (tokenResponse.data.refresh_token && tokenResponse.data.refresh_token !== oldRefreshToken) {
                    const now = new Date().toISOString();

                    // Store token history
                    await storeTokenHistory(
                        partnerId,
                        oldRefreshToken,
                        tokenResponse.data.refresh_token,
                        'amazon_token_rotation'
                    );

                    // Update partner record with new refresh token and timestamp
                    await docClient.send(new PutCommand({
                        TableName: process.env.PARTNERS_TABLE,
                        Item: {
                            ...partner,
                            refreshToken: tokenResponse.data.refresh_token,
                            lastTokenRefresh: now,
                            updatedAt: now,
                            tokenVersion: (partner.tokenVersion || 0) + 1
                        }
                    }));
                } else if (tokenResponse.data.refresh_token) {
                    // If the refresh token is the same, just update the lastTokenRefresh timestamp
                    await docClient.send(new PutCommand({
                        TableName: process.env.PARTNERS_TABLE,
                        Item: {
                            ...partner,
                            lastTokenRefresh: new Date().toISOString()
                        }
                    }));
                }

                // Return the access token response
                return formatResponse(200, {
                    headers: {
                        'Cache-Control': 'no-store'
                    },
                    body: JSON.stringify({
                        access_token: tokenResponse.data.access_token,
                        token_type: tokenResponse.data.token_type,
                        expires_in: tokenResponse.data.expires_in,
                        refresh_token_updated: tokenResponse.data.refresh_token !== oldRefreshToken
                    })
                });
            } catch (error) {
                console.error('Token refresh error:', error.response?.data || error);

                if (error.response?.status === 400 &&
                    error.response?.data?.error === 'invalid_grant') {

                    // Store token history for invalid token
                    await storeTokenHistory(
                        partnerId,
                        partner.refreshToken,
                        null,
                        'token_invalidated'
                    );

                    // Update partner status to indicate reauthorization needed
                    await docClient.send(new PutCommand({
                        TableName: process.env.PARTNERS_TABLE,
                        Item: {
                            ...partner,
                            status: 'PENDING_AUTH',
                            updatedAt: new Date().toISOString()
                        }
                    }));

                    return formatResponse(401, {
                        body: JSON.stringify({
                            error: 'Reauthorization required',
                            message: 'The refresh token is no longer valid. Partner needs to be reauthorized.'
                        })
                    });
                }

                // Handle other errors
                return formatResponse(error.response?.status || 500, {
                    body: JSON.stringify({
                        error: 'Token refresh failed',
                        message: error.response?.data?.error_description || error.message
                    })
                });
            }
        }
        // In lambda/index.js, update the handler with new appstore endpoints:

        // Initialize AppstoreAuthorization with both table names
        const appstoreAuth = new AppstoreAuthorization(
            process.env.PARTNERS_TABLE,
            process.env.STATE_TABLE_NAME
        );

        // Add these cases in the main try/catch block:

        // Appstore authorization routes - no partnerId required for initial auth
        // In index.js, update the appstore authorization handler:

        // Appstore authorization route
        if (path.includes('/appstore/authorize')) {
            try {
                const { amazon_callback_uri, amazon_state, selling_partner_id } = event.queryStringParameters || {};

                if (!amazon_callback_uri || !amazon_state || !selling_partner_id) {
                    return formatResponse(400, {
                        error: 'Missing required parameters',
                        message: 'Required parameters: amazon_callback_uri, amazon_state, selling_partner_id'
                    });
                }

                const appstoreAuth = new AppstoreAuthorization(
                    process.env.PARTNERS_TABLE,
                    process.env.STATE_TABLE_NAME
                );

                // Generate our own state token
                const ourState = appstoreAuth.generateStateToken();

                // Store both states and parameters
                await appstoreAuth.storeState(ourState, amazon_callback_uri, {
                    appstoreUrl: event.headers?.referer,
                    isTestWorkflow: event.queryStringParameters?.version === 'beta',
                    selling_partner_id,
                    amazon_state  // Store Amazon's state for verification
                });

                // Construct the redirect URL back to Amazon
                const redirectUrl = new URL(amazon_callback_uri);

                // Add all required parameters
                redirectUrl.searchParams.append('redirect_uri', `https://${event.requestContext.domainName}/${process.env.API_STAGE}/partners/appstore/callback`);
                redirectUrl.searchParams.append('amazon_state', amazon_state);
                redirectUrl.searchParams.append('state', ourState);

                // If testing workflow, add version parameter
                if (event.queryStringParameters?.version === 'beta') {
                    redirectUrl.searchParams.append('version', 'beta');
                }

                // Set no-referrer policy header
                return formatResponse(302, {
                    redirectUrl: redirectUrl.toString()
                }, {
                    'Location': redirectUrl.toString(),
                    'Referrer-Policy': 'no-referrer'
                });
            } catch (error) {
                console.error('Error initiating appstore auth:', error);
                return formatResponse(500, {
                    error: 'Failed to initiate authorization',
                    message: error.message
                });
            }
        }

        // Add this function near the top of the file with other helper functions
        // Modify the findPartnerByAmazonId function to be more specific
        async function findPartnerByAmazonId(amazonId, authType = null) {
            const result = await docClient.send(new QueryCommand({
                TableName: process.env.PARTNERS_TABLE,
                IndexName: 'amazonIdIndex',
                KeyConditionExpression: 'amazonId = :amazonId',
                ExpressionAttributeValues: {
                    ':amazonId': amazonId
                }
            }));

            // If authType is specified, filter for that specific type
            if (authType) {
                return result.Items.find(item => item.authType === authType);
            }

            // Otherwise return the first match
            return result.Items[0];
        }
        // Add this function to create a new partner for appstore flow
        async function createAppstorePartner(selling_partner_id, options = {}) {
            console.log('Creating new appstore partner:', {
                selling_partner_id,
                options
            });

            const partnerId = uuidv4();
            const now = new Date().toISOString();

            // Get region configuration
            const region = REGIONS['NA']; // Default to NA region
            const marketplace = region.marketplaces['US']; // Default to US marketplace

            const partner = {
                partnerId,
                amazonId: selling_partner_id,
                name: `Appstore Partner ${selling_partner_id.slice(-6)}-${partnerId.slice(0, 4)}`,
                type: 'seller',
                authType: 'appstore',
                status: 'AUTHORIZED',
                createdAt: now,
                updatedAt: now,
                isTestWorkflow: options.isTestWorkflow || false,
                // Add region-specific configuration
                region: 'NA',
                marketplace: 'US',
                marketplaceName: 'United States',
                apiEndpoint: region.endpoint,
                awsRegion: region.awsRegion,
                // Add marketplace URLs
                sellerCentralUrl: marketplace.sellerCentral,
                vendorCentralUrl: marketplace.vendorCentral
            };

            console.log('Attempting to save appstore partner to DynamoDB:', partner);

            try {
                await docClient.send(new PutCommand({
                    TableName: process.env.PARTNERS_TABLE,
                    Item: partner
                }));
                console.log('Successfully saved appstore partner to DynamoDB');
                return partner;
            } catch (error) {
                console.error('Failed to save appstore partner to DynamoDB:', error);
                throw error;
            }
        }

        // Handle the callback from Amazon - this is where we'll create/update the partner
        if (path.includes('/appstore/callback')) {
            try {
                const { state, selling_partner_id, spapi_oauth_code } = event.queryStringParameters || {};

                console.log('Received appstore callback with params:', {
                    state,
                    selling_partner_id,
                    spapi_oauth_code: spapi_oauth_code ? '***' : undefined
                });

                if (!state || !selling_partner_id || !spapi_oauth_code) {
                    return formatResponse(400, {
                        error: 'Missing required parameters',
                        message: 'Required parameters: state, selling_partner_id, spapi_oauth_code'
                    });
                }

                // Verify state and get stored information
                console.log('Verifying state token:', state);
                const stateInfo = await verifyState(state);
                if (!stateInfo) {
                    console.log('State token verification failed');
                    return formatResponse(400, {
                        error: 'Invalid state token'
                    });
                }
                console.log('State token verified:', stateInfo);

                // For appstore flow, always create a new partner
                console.log('Creating new appstore partner for:', selling_partner_id);
                const newPartner = await createAppstorePartner(selling_partner_id, {
                    isTestWorkflow: stateInfo.metadata?.isTestWorkflow,
                    appstoreUrl: stateInfo.metadata?.appstoreUrl
                });
                const partnerId = newPartner.partnerId;
                console.log('Created new appstore partner with ID:', partnerId);

                // Exchange authorization code for tokens
                console.log('Exchanging authorization code for tokens');
                const credentials = await getCredentials();
                const tokenResponse = await axios.post(process.env.TOKEN_ENDPOINT,
                    new URLSearchParams({
                        grant_type: 'authorization_code',
                        code: spapi_oauth_code,
                        client_id: credentials.clientId,
                        client_secret: credentials.clientSecret,
                        redirect_uri: `https://${event.requestContext.domainName}/${process.env.API_STAGE}/partners/appstore/callback`
                    }).toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );
                console.log('Successfully received token response');

                // Update partner with tokens
                console.log('Updating partner with tokens:', partnerId);
                await updatePartnerTokens(partnerId, tokenResponse.data, selling_partner_id);
                console.log('Successfully updated partner with tokens');

                // Get the webapp domain for redirect
                const webappDomain = process.env.WEBAPP_DOMAIN || event.headers.Referer?.split('/')[2];

                if (webappDomain) {
                    console.log('Redirecting to webapp:', webappDomain);
                    return formatResponse(302, null, {
                        'Location': `https://${webappDomain}?success=true&partnerId=${partnerId}`,
                        'Cache-Control': 'no-store'
                    });
                }

                return formatResponse(200, {
                    message: 'Authorization successful',
                    partnerId,
                    isNewPartner: true
                });

            } catch (error) {
                console.error('Authorization callback error:', error);
                return formatResponse(500, {
                    error: 'Authorization failed',
                    message: error.message,
                    stack: error.stack
                });
            }
        }

        // Status check endpoint - this still needs partnerId
        if (partnerId && path.includes('/appstore/status')) {
            try {
                const appstoreAuth = new AppstoreAuthorization(
                    process.env.PARTNERS_TABLE,
                    process.env.STATE_TABLE_NAME
                );

                const status = await appstoreAuth.getAuthorizationStatus(partnerId);
                return formatResponse(200, status);
            } catch (error) {
                if (error.message === 'Partner not found') {
                    return formatResponse(404, {
                        error: 'Partner not found'
                    });
                }
                throw error;
            }
        }

        // Test seller authorization
        if (partnerId && path.includes('/test/seller') && method === 'POST') {
            const partner = await getPartner(partnerId);
            if (!partner) {
                return formatResponse(404, {
                    error: 'Partner not found'
                });
            }

            if (!['seller'].includes(partner.type)) {
                return formatResponse(400, {
                    error: 'Partner must be a seller'
                });
            }

            try {
                // Get fresh access token using the helper function
                const credentials = await getCredentials();
                const { accessToken } = await AuthorizationTest.refreshAccessToken(partner, credentials);

                const authTest = new AuthorizationTest(partner.region, partner.marketplace);
                const result = await authTest.testSellerAuth(accessToken);

                return formatResponse(200, result);
            } catch (error) {
                return formatResponse(400, {
                    error: 'Authorization test failed',
                    message: error.message
                });
            }
        }

        // Test vendor authorization
        if (partnerId && path.includes('/test/vendor') && method === 'POST') {
            const partner = await getPartner(partnerId);
            if (!partner) {
                return formatResponse(404, {
                    error: 'Partner not found'
                });
            }

            if (!['vendor'].includes(partner.type)) {
                return formatResponse(400, {
                    error: 'Partner must be a vendor'
                });
            }

            try {
                // Get fresh access token using the helper function
                const credentials = await getCredentials();
                const { accessToken } = await AuthorizationTest.refreshAccessToken(partner, credentials);

                const authTest = new AuthorizationTest(partner.region, partner.marketplace);
                const result = await authTest.testVendorAuth(accessToken);

                return formatResponse(200, result);
            } catch (error) {
                return formatResponse(400, {
                    error: 'Authorization test failed',
                    message: error.message
                });
            }
        }

        // Credential rotation endpoint
        if (partnerId && path.includes('/credentials/rotate') && method === 'POST') {
            try {
                // Create new instance of CredentialRotation with the partners table name
                const credentialRotation = new CredentialRotation(process.env.PARTNERS_TABLE);
                const result = await credentialRotation.rotateCredentials(partnerId);
                return formatResponse(204, null); // SP-API returns 204 with no content
            } catch (error) {
                if (error.message.includes('Partner not found')) {
                    return formatResponse(404, { error: error.message });
                }
                if (error.message.includes('only available for self-authorized')) {
                    return formatResponse(400, { error: error.message });
                }
                throw error; // Let the global error handler catch other errors
            }
        }

        // For the credentials update endpoint, ensure we're using formatResponse
        if (path.includes('/credentials/update') && method === 'POST') {
            try {
                const body = JSON.parse(event.body);

                // Validate credentials format
                validateCredentials(body);

                const command = new UpdateSecretCommand({
                    SecretId: process.env.SECRETS_ARN,
                    SecretString: JSON.stringify({
                        clientId: body.clientId,
                        clientSecret: body.clientSecret,
                        applicationId: body.applicationId
                    })
                });

                await secretsClient.send(command);

                // Clear cached credentials
                cachedCredentials = null;
                credentialsLastFetched = null;

                return formatResponse(200, {
                    message: 'Credentials updated successfully',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error updating credentials:', error);
                return formatResponse(error.name === 'ValidationError' ? 400 : 500, {
                    error: 'Failed to update credentials',
                    message: error.message
                });
            }
        }

        if (partnerId && path.includes('/status') && method === 'PUT') {
            try {
                const statusManager = new StatusManager(process.env.PARTNERS_TABLE);
                const body = JSON.parse(event.body);

                switch (body.status) {
                    case 'inactive': {
                        const result = await statusManager.markInactive(partnerId);

                        // Send initial reminder
                        const reminderManager = new ReminderManager(process.env.PARTNERS_TABLE);
                        const reminderResult = await reminderManager.sendRevocationReminder(partnerId);

                        return formatResponse(200, {
                            ...result,
                            reminder: reminderResult
                        });
                    }

                    default:
                        return formatResponse(400, {
                            error: 'Invalid status. Only "inactive" is supported.'
                        });
                }
            } catch (error) {
                if (error.message.includes('Partner not found')) {
                    return formatResponse(404, { error: error.message });
                }
                if (error.message.includes('Only OAuth') ||
                    error.message.includes('Only authorized')) {
                    return formatResponse(400, { error: error.message });
                }
                throw error;
            }
        }

        // Handle SQS events
        if (event.Records && event.Records[0]?.eventSource === 'aws:sqs') {
            console.log('Received SQS event:', JSON.stringify(event, null, 2));

            const credentialRotation = new CredentialRotation(process.env.PARTNERS_TABLE);
            const results = [];
            const errors = [];

            console.log(`Processing ${event.Records.length} SQS records`);

            for (const [index, record] of event.Records.entries()) {
                console.log(`\nProcessing record ${index + 1}/${event.Records.length}`);
                console.log('Record metadata:', {
                    messageId: record.messageId,
                    eventSource: record.eventSource,
                    eventSourceARN: record.eventSourceARN,
                    awsRegion: record.awsRegion,
                    timestamp: record.attributes?.SentTimestamp
                });

                try {
                    // Log the raw message body
                    console.log('Raw message body:', record.body);

                    // Try to parse the message body if it's JSON
                    let parsedBody;
                    try {
                        parsedBody = JSON.parse(record.body);
                        console.log('Parsed message body:', JSON.stringify(parsedBody, null, 2));
                    } catch (parseError) {
                        console.warn('Message body is not JSON:', parseError.message);
                    }

                    // Log notification type if available
                    if (parsedBody?.NotificationType) {
                        console.log('Notification Type:', parsedBody.NotificationType);
                    }

                    // Process the message
                    console.log('Attempting to process message with CredentialRotation...');
                    const result = await credentialRotation.handleClientSecretNotification(record);

                    if (result) {
                        console.log('Successfully processed message:', result);
                        results.push({
                            messageId: record.messageId,
                            result,
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        console.warn('Message processed but no result returned');
                        results.push({
                            messageId: record.messageId,
                            result: null,
                            warning: 'No result returned',
                            timestamp: new Date().toISOString()
                        });
                    }
                } catch (error) {
                    console.error('Error processing SQS record:', {
                        messageId: record.messageId,
                        error: {
                            name: error.name,
                            message: error.message,
                            stack: error.stack
                        }
                    });

                    errors.push({
                        messageId: record.messageId,
                        error: {
                            name: error.name,
                            message: error.message,
                            timestamp: new Date().toISOString()
                        }
                    });

                    // Continue processing other records
                    continue;
                }
            }

            // Log final processing summary
            console.log('\nSQS Processing Summary:', {
                totalRecords: event.Records.length,
                successfullyProcessed: results.length,
                errors: errors.length,
                processingTime: `${Date.now() - context.getRemainingTimeInMillis()}ms`
            });

            // For SQS events, return detailed processing results
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'SQS message processing completed',
                    summary: {
                        totalRecords: event.Records.length,
                        successfullyProcessed: results.length,
                        errorCount: errors.length
                    },
                    results: results,
                    errors: errors,
                    timestamp: new Date().toISOString(),
                    requestId: context.awsRequestId
                }, null, 2)
            };
        }

        if (path.endsWith('/config') && method === 'GET') {
            try {
                const credentials = await getCredentials();
                return formatResponse(200, {
                    applicationId: credentials.applicationId,
                    regions: REGIONS  // Include the REGIONS configuration from backend
                });
            } catch (error) {
                console.error('Error fetching application config:', error);
                return formatResponse(500, {
                    error: 'Failed to fetch application configuration'
                });
            }
        }

        // Add this to your handler's route handling
        if (partnerId && path.includes('/notifications/setup') && method === 'POST') {
            try {
                const result = await setupNotifications(partnerId);
                return formatResponse(200, result);
            } catch (error) {
                if (error.message.includes('Partner not found')) {
                    return formatResponse(404, {
                        error: 'Partner not found'
                    });
                }

                if (error.message.startsWith('SP-API Error:')) {
                    return formatResponse(error.response?.status || 403, {
                        error: error.message,
                        details: error.response?.data
                    });
                }

                return formatResponse(500, {
                    error: 'Failed to setup notifications',
                    message: error.message
                });
            }
        }

        // Credential rotation endpoint
        if (partnerId && path.includes('/credentials/rotate') && method === 'POST') {
            try {
                const credentialRotation = new CredentialRotation(process.env.PARTNERS_TABLE);
                const result = await credentialRotation.rotateCredentials(partnerId);
                return formatResponse(204, null); // SP-API returns 204 with no content
            } catch (error) {
                if (error.message.includes('Partner not found')) {
                    return formatResponse(404, { error: error.message });
                }
                if (error.message.includes('only available for self-authorized')) {
                    return formatResponse(400, { error: error.message });
                }
                throw error; // Let the global error handler catch other errors
            }
        }

        // Add the new status endpoint handler while preserving existing status update logic
        if (partnerId && path.includes('/status') && method === 'PUT') {
            try {
                const statusManager = new StatusManager(process.env.PARTNERS_TABLE);
                const body = JSON.parse(event.body);

                switch (body.status) {
                    case 'inactive': {
                        const result = await statusManager.markInactive(partnerId);

                        // Send initial reminder
                        const reminderManager = new ReminderManager(process.env.PARTNERS_TABLE);
                        const reminderResult = await reminderManager.sendRevocationReminder(partnerId);

                        return formatResponse(200, {
                            ...result,
                            reminder: reminderResult
                        });
                    }

                    default:
                        return formatResponse(400, {
                            error: 'Invalid status. Only "inactive" is supported.'
                        });
                }
            } catch (error) {
                if (error.message.includes('Partner not found')) {
                    return formatResponse(404, { error: error.message });
                }
                if (error.message.includes('Only OAuth') ||
                    error.message.includes('Only authorized')) {
                    return formatResponse(400, { error: error.message });
                }
                throw error;
            }
        }

        // In lambda/index.js, add this new endpoint handler:

        if (partnerId && path.includes('/tokens/rdt') && method === 'POST') {
            try {
                const partner = await getPartner(partnerId);
                if (!partner) {
                    return formatResponse(404, { error: 'Partner not found' });
                }

                // Validate the request body
                const requestBody = JSON.parse(event.body);
                if (!requestBody.restrictedResources || !Array.isArray(requestBody.restrictedResources)) {
                    return formatResponse(400, {
                        error: 'Invalid request',
                        message: 'restrictedResources must be an array'
                    });
                }

                // Validate each resource
                for (const resource of requestBody.restrictedResources) {
                    if (!resource.method || !resource.path) {
                        return formatResponse(400, {
                            error: 'Invalid resource definition',
                            message: 'Each resource must have method and path'
                        });
                    }
                }

                // Get fresh access token
                const credentials = await getCredentials();
                const accessToken = await AuthorizationTest.refreshAccessToken(partner, credentials);

                // Call the SP-API Tokens endpoint
                const response = await axios.post(
                    `${partner.apiEndpoint}/tokens/2021-03-01/restrictedDataToken`,
                    {
                        restrictedResources: requestBody.restrictedResources
                    },
                    {
                        headers: {
                            'x-amz-access-token': accessToken.accessToken,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                return formatResponse(200, {
                    restrictedDataToken: response.data.restrictedDataToken,
                    expiresIn: response.data.expiresIn
                });
            } catch (error) {
                console.error('Error generating RDT token:', error);

                if (error.response?.data?.errors) {
                    return formatResponse(error.response.status || 500, {
                        error: 'SP-API Error',
                        errors: error.response.data.errors
                    });
                }

                return formatResponse(500, {
                    error: 'Failed to generate RDT token',
                    message: error.message
                });
            }
        }




        if (partnerId && path.includes('/debug/status') && method === 'GET') {
            try {
                const partner = await getPartner(partnerId);
                if (!partner) {
                    return formatResponse(404, {
                        error: 'Partner not found'
                    });
                }

                // Return basic info without sensitive fields
                const partnerInfo = {
                    partnerId: partner.partnerId,
                    name: partner.name,
                    type: partner.type,
                    authType: partner.authType,
                    status: partner.status,
                    region: partner.region,
                    marketplace: partner.marketplace,
                    createdAt: partner.createdAt,
                    updatedAt: partner.updatedAt,
                    lastTokenRefresh: partner.lastTokenRefresh,
                    markedInactiveAt: partner.markedInactiveAt,
                    authorizationRevokedAt: partner.authorizationRevokedAt
                };

                return formatResponse(200, partnerInfo);
            } catch (error) {
                console.error('Error in debug status endpoint:', error);
                return formatResponse(500, {
                    error: 'Failed to retrieve partner debug info',
                    message: error.message
                });
            }
        }

        // If no matching endpoint is found, use formatResponse for 404 as well
        return formatResponse(404, {
            error: 'Not Found'
        });

    } catch (error) {
        console.error('Error:', error);

        if (error.message === 'Invalid form data format') {
            return formatResponse(400, {
                body: JSON.stringify({
                    error: 'Invalid form data',
                    message: 'The provided form data could not be parsed'
                })
            });
        }

        if (axios.isAxiosError(error)) {
            return formatResponse(error.response?.status || 500, {
                body: JSON.stringify({
                    error: 'API request failed',
                    details: error.response?.data,
                    message: error.message
                })
            });
        }

        // Handle specific error types
        if (error.name === 'ValidationError') {
            return formatResponse(400, {
                body: JSON.stringify({
                    error: 'Validation Error',
                    message: error.message
                })
            });
        }

        // Update the error response to include CORS headers
        console.error('Error:', error);
        
        // Even for global error handler, use formatResponse
        return formatResponse(500, {
            error: 'Internal Server Error',
            message: error.message
        });
    }
};