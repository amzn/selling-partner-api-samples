// lambda/appstore.js

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { 
    DynamoDBDocumentClient, 
    QueryCommand,
    UpdateCommand,
    GetCommand,
    PutCommand
} = require("@aws-sdk/lib-dynamodb");
const axios = require('./spApiLogger');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dynamoClient);

class AppstoreAuthorization {
    constructor(partnersTableName, stateTableName) {
        this.partnersTableName = partnersTableName;
        this.stateTableName = stateTableName;
    }

    // Generate a secure state token
    generateStateToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Store state information with a 5-minute TTL (as per documentation)
    async storeState(stateToken, callbackUri, metadata = {}) {
        const ttl = Math.floor(Date.now() / 1000) + (5 * 60); // 5 minutes TTL
        
        // Create clean item object without undefined values
        const item = {
            state: stateToken,
            amazonCallbackUri: callbackUri,
            ttl,
            createdAt: new Date().toISOString(),
            metadata: {} // Initialize metadata object
        };

        // Add required metadata for appstore flow
        if (metadata.amazon_state) {
            item.metadata.amazon_state = metadata.amazon_state;
        }
        if (metadata.selling_partner_id) {
            item.metadata.selling_partner_id = metadata.selling_partner_id;
        }
        if (metadata.isTestWorkflow !== undefined) {
            item.metadata.isTestWorkflow = metadata.isTestWorkflow;
        }

        await docClient.send(new PutCommand({
            TableName: this.stateTableName,
            Item: item
        }));
        
        return stateToken;
    }

    // Verify state token
    async verifyState(stateToken) {
        const result = await docClient.send(new GetCommand({
            TableName: this.stateTableName,
            Key: { state: stateToken }
        }));
        
        if (!result.Item) {
            throw new Error('Invalid or expired state token');
        }
        
        return result.Item;
    }

    // Find existing partner by Amazon ID
    async findPartnerByAmazonId(amazonId) {
        const result = await docClient.send(new QueryCommand({
            TableName: this.partnersTableName,
            IndexName: 'amazonIdIndex',
            KeyConditionExpression: 'amazonId = :amazonId',
            ExpressionAttributeValues: {
                ':amazonId': amazonId
            }
        }));
        return result.Items[0];
    }

    // Determine partner type from appstore URL
    determinePartnerType(appstoreUrl) {
        if (!appstoreUrl) return 'seller'; // Default to seller if no URL provided
        
        return appstoreUrl.includes('vendorcentral') ? 'vendor' : 'seller';
    }

    // Get appropriate auth endpoint based on partner type
    getAuthEndpoint(partnerType) {
        return partnerType === 'vendor' ? this.vendorAuthEndpoint : this.sellerAuthEndpoint;
    }

    // Create a new partner for appstore authorization
    async createAppstorePartner(selling_partner_id, appstoreUrl = null, isTestWorkflow = false) {
        const partnerId = uuidv4();
        const now = new Date().toISOString();
        
        // Determine partner type from the appstore URL
        const partnerType = this.determinePartnerType(appstoreUrl);
        
        const partner = {
            partnerId,
            amazonId: selling_partner_id,
            name: `Appstore ${partnerType.charAt(0).toUpperCase() + partnerType.slice(1)} ${selling_partner_id.slice(-6)}`,
            type: partnerType,
            authType: 'appstore',
            status: 'PENDING_AUTH',
            createdAt: now,
            updatedAt: now,
            isTestWorkflow,
            // Default to NA region and US marketplace, can be updated later based on marketplace info
            region: 'NA',
            marketplace: 'US',
            authEndpoint: this.getAuthEndpoint(partnerType)
        };

        await docClient.send(new PutCommand({
            TableName: this.partnersTableName,
            Item: partner
        }));

        return partner;
    }

    // Update partner with new authorization information
    async updatePartnerAuth(partnerId, tokens, amazonId) {
        const now = new Date().toISOString();
        
        await docClient.send(new UpdateCommand({
            TableName: this.partnersTableName,
            Key: { partnerId },
            UpdateExpression: 'SET status = :status, refreshToken = :refreshToken, ' +
                            'amazonId = :amazonId, updatedAt = :updatedAt, ' +
                            'lastTokenRefresh = :lastTokenRefresh',
            ExpressionAttributeValues: {
                ':status': 'AUTHORIZED',
                ':refreshToken': tokens.refresh_token,
                ':amazonId': amazonId,
                ':updatedAt': now,
                ':lastTokenRefresh': now
            }
        }));
    }

    // Handle the authorization callback
    async handleCallback(params, clientId, clientSecret) {
        const { state, selling_partner_id, spapi_oauth_code, version } = params;
        const isTestWorkflow = version === 'beta';

        if (!state || !selling_partner_id || !spapi_oauth_code) {
            throw new Error('Missing required parameters');
        }

        // Verify state token
        const stateData = await this.verifyState(state);
        if (!stateData) {
            throw new Error('Invalid state token');
        }

        // Extract appstore URL from metadata if available
        const appstoreUrl = stateData.metadata?.appstoreUrl;

        // Find existing partner or create new one
        let partner = await this.findPartnerByAmazonId(selling_partner_id);
        
        if (!partner) {
            // Create new partner if none exists
            partner = await this.createAppstorePartner(selling_partner_id, appstoreUrl, isTestWorkflow);
        }

        // Exchange authorization code for refresh token
        try {
            const tokenResponse = await axios.post(this.tokenEndpoint,
                new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: spapi_oauth_code,
                    redirect_uri: stateData.amazonCallbackUri,
                    client_id: clientId,
                    client_secret: clientSecret
                }).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                    }
                }
            );

            // Update partner with tokens and authorization status
            await this.updatePartnerAuth(
                partner.partnerId,
                tokenResponse.data,
                selling_partner_id
            );

            return {
                partnerId: partner.partnerId,
                status: 'AUTHORIZED',
                isNewPartner: !partner.refreshToken // Indicate if this was a new authorization
            };

        } catch (error) {
            console.error('Token exchange error:', error);
            throw new Error('Failed to exchange authorization code for refresh token');
        }
    }

    // Get current authorization status
    async getAuthorizationStatus(partnerId) {
        if (!partnerId) {
            throw new Error('Partner ID is required');
        }

        const partner = await docClient.send(new GetCommand({
            TableName: this.partnersTableName,
            Key: { partnerId }
        }));

        if (!partner.Item) {
            throw new Error('Partner not found');
        }

        return {
            status: partner.Item.status || 'PENDING',
            amazonId: partner.Item.amazonId || null,
            lastTokenRefresh: partner.Item.lastTokenRefresh || null,
            isTestWorkflow: partner.Item.isTestWorkflow || false
        };
    }
}

module.exports = AppstoreAuthorization;