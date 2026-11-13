// File: lambda/credentialRotation.js

const axios = require('./spApiLogger');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { 
    DynamoDBDocumentClient, 
    GetCommand, 
    UpdateCommand,
    QueryCommand 
} = require("@aws-sdk/lib-dynamodb");

const dynamoClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dynamoClient);

class CredentialRotation {
    constructor(partnersTableName) {
        this.tableName = partnersTableName;
    }

    // Rotate client secret for a partner
    // Rotate client secret for a partner
    async rotateCredentials(partnerId) {
        try {
            // Get partner details
            const partner = await this.getPartner(partnerId);
            if (!partner) {
                throw new Error('Partner not found');
            }

            // Only self-authorized partners can rotate credentials
            if (partner.authType !== 'self') {
                throw new Error('Credential rotation is only available for self-authorized partners');
            }

            // Get fresh access token with client credentials
            const accessToken = await this.getClientCredentialsToken(partner);

            // Call the rotation API
            try {
                const response = await axios.post(
                    `${partner.apiEndpoint}/applications/2023-11-30/clientSecret`,
                    {},  // Empty body as per API spec
                    {
                        headers: {
                            'x-amz-access-token': accessToken,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                // API returns 204 with no content on success
                if (response.status === 204) {
                    return {
                        success: true,
                        message: 'Client secret rotation initiated successfully'
                    };
                }

                throw new Error('Unexpected response from rotation API');
            } catch (error) {
                // Log the full error response
                if (error.response?.data?.errors) {
                    const apiErrors = error.response.data.errors;
                    console.error('SP-API Error Details:', apiErrors);
                    throw new Error(`SP-API Error: ${apiErrors.map(e => `${e.code}: ${e.message}`).join(', ')}`);
                }
                throw error;
            }

        } catch (error) {
            console.error('Error rotating client secret:', error);
            throw new Error(`Failed to rotate client secret: ${error.message}`);
        }
    }

    // Handle notification from SQS about new client secret
    async handleClientSecretNotification(sqsMessage) {
        try {
            console.log('Processing SQS message:', JSON.stringify({
                messageId: sqsMessage.messageId,
                body: typeof sqsMessage.body === 'string' ? 'string' : typeof sqsMessage.body
            }));

            const notification = JSON.parse(sqsMessage.body);
            console.log('Parsed notification:', JSON.stringify({
                notificationType: notification.notificationType,
                payloadVersion: notification.payloadVersion,
                eventTime: notification.eventTime
            }));
            
            if (notification.notificationType !== 'APPLICATION_OAUTH_CLIENT_NEW_SECRET') {
                console.warn('Ignoring notification of type:', notification.notificationType);
                return;
            }

            // Extract payload correctly based on the notification structure
            const payload = notification.payload.applicationOAuthClientNewSecret;
            console.log('Extracted payload:', JSON.stringify({
                clientId: payload.clientId,
                newSecretExpiry: payload.newClientSecretExpiryTime,
                oldSecretExpiry: payload.oldClientSecretExpiryTime
            }));

            // Find partner by clientId
            const partner = await this.findPartnerByClientId(payload.clientId);
            if (!partner) {
                console.error(`No partner found for clientId: ${payload.clientId}`);
                return;
            }

            // Update partner with new credentials
            const updatedPartner = await this.updatePartnerCredentials(
                partner.partnerId,
                {
                    newClientSecret: payload.newClientSecret,
                    newSecretExpiryTime: payload.newClientSecretExpiryTime,
                    oldClientSecret: partner.clientSecret, // Store current secret as old
                    oldSecretExpiryTime: payload.oldClientSecretExpiryTime
                }
            );

            console.log('Successfully updated partner credentials:', {
                partnerId: partner.partnerId,
                newExpiryTime: payload.newClientSecretExpiryTime
            });

            return {
                success: true,
                partnerId: partner.partnerId,
                newExpiryTime: payload.newClientSecretExpiryTime,
                updated: !!updatedPartner
            };

        } catch (error) {
            console.error('Error processing client secret notification:', {
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                }
            });
            throw error;
        }
    }

    async getClientCredentialsToken(partner) {
        try {
            const tokenResponse = await axios.post(
                process.env.TOKEN_ENDPOINT,
                new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: partner.clientId,
                    client_secret: partner.clientSecret,
                    scope: 'sellingpartnerapi::client_credential:rotation'
                }).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            return tokenResponse.data.access_token;
        } catch (error) {
            console.error('Error getting client credentials token:', error);
            throw new Error('Failed to obtain client credentials token');
        }
    }

    async findPartnerByClientId(clientId) {
        console.log('Finding partner by clientId:', clientId);
        
        try {
            const result = await docClient.send(new QueryCommand({
                TableName: this.tableName,
                IndexName: 'clientIdIndex',
                KeyConditionExpression: 'clientId = :clientId',
                ExpressionAttributeValues: {
                    ':clientId': clientId
                },
                Limit: 1
            }));

            console.log('Query result:', JSON.stringify(result, null, 2));

            if (!result.Items?.length) {
                console.log('No partner found for clientId:', clientId);
                return null;
            }

            console.log('Found partner:', JSON.stringify(result.Items[0], null, 2));
            return result.Items[0];
        } catch (error) {
            console.error('Error finding partner:', error);
            throw error;
        }
    }

    async updatePartnerCredentials(partnerId, credentials) {
        console.log('Updating partner credentials:', {
            partnerId,
            credentials: {
                ...credentials,
                newClientSecret: '***[REDACTED]***',
                oldClientSecret: credentials.oldClientSecret ? '***[REDACTED]***' : null
            }
        });

        try {
            const now = new Date().toISOString();
            
            const params = {
                TableName: this.tableName,
                Key: { partnerId },
                UpdateExpression: `
                    SET clientSecret = :newSecret,
                        clientSecretExpiryTime = :newSecretExpiry,
                        oldClientSecret = :oldSecret,
                        oldClientSecretExpiryTime = :oldSecretExpiry,
                        updatedAt = :updatedAt
                `,
                ExpressionAttributeValues: {
                    ':newSecret': credentials.newClientSecret,
                    ':newSecretExpiry': credentials.newSecretExpiryTime,
                    ':oldSecret': credentials.oldClientSecret || null,
                    ':oldSecretExpiry': credentials.oldSecretExpiryTime,
                    ':updatedAt': now
                },
                ReturnValues: 'ALL_NEW' // This will return the updated item
            };

            console.log('DynamoDB update params:', {
                ...params,
                ExpressionAttributeValues: {
                    ...params.ExpressionAttributeValues,
                    ':newSecret': '***[REDACTED]***',
                    ':oldSecret': credentials.oldClientSecret ? '***[REDACTED]***' : null
                }
            });

            const result = await docClient.send(new UpdateCommand(params));
            console.log('Update result:', JSON.stringify({
                ...result.Attributes,
                clientSecret: '***[REDACTED]***',
                oldClientSecret: result.Attributes?.oldClientSecret ? '***[REDACTED]***' : null
            }, null, 2));

            return result.Attributes;
        } catch (error) {
            console.error('Failed to update partner credentials:', {
                partnerId,
                error: {
                    name: error.name,
                    message: error.message,
                    code: error.$metadata?.httpStatusCode,
                    type: error.__type
                }
            });
            throw error;
        }
    }

    async getPartner(partnerId) {
        const result = await docClient.send(new GetCommand({
            TableName: this.tableName,
            Key: { partnerId }
        }));
        return result.Item;
    }
}

module.exports = CredentialRotation;