const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand,
    QueryCommand,
    PutCommand
} = require("@aws-sdk/lib-dynamodb");

const axios = require('./spApiLogger');
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const dynamoClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient();

class ReminderManager {
    constructor(partnersTableName) {
        const dynamoClient = new DynamoDBClient();
        this.docClient = DynamoDBDocumentClient.from(dynamoClient);
        this.tableName = partnersTableName;
    }


    async getCredentials() {
        try {
            const command = new GetSecretValueCommand({
                SecretId: process.env.SECRETS_ARN
            });

            const response = await secretsClient.send(command);
            const secrets = JSON.parse(response.SecretString);

            return {
                clientId: secrets.clientId,
                clientSecret: secrets.clientSecret
            };
        } catch (error) {
            console.error('Error fetching credentials:', error);
            throw new Error('Failed to retrieve credentials');
        }
    }

    async getPartner(partnerId) {
        const result = await this.docClient.send(new GetCommand({
            TableName: this.tableName,
            Key: { partnerId }
        }));
        return result.Item;
    }

    async sendRevocationReminder(partnerId) {
        try {
            const partner = await this.getPartner(partnerId);
            if (!partner || partner.status !== 'MARKED_INACTIVE') {
                return;
            }

            // Get credentials for API call
            const credentials = await this.getCredentials();

            // Get fresh access token
            // Remove hard-coded token and use proper token from credentials
            const tokenResponse = await axios.post(process.env.TOKEN_ENDPOINT,
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: partner.refreshToken,
                    client_id: credentials.clientId,
                    client_secret: credentials.clientSecret
                }).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            // Send notification using App Integration API
            const response = await axios.post(
                `${partner.apiEndpoint}/appIntegrations/2024-04-01/notifications`,
                {
                    templateId: 'REVOCATION_REMINDER',
                    marketplaceId: partner.marketplace,
                    notificationParameters: {
                        inactiveSince: new Date(partner.markedInactiveAt).toLocaleDateString()
                    }
                },
                {
                    headers: {
                        'x-amz-access-token': tokenResponse.data.access_token,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Update last reminder timestamp
            await docClient.send(new UpdateCommand({
                TableName: this.tableName,
                Key: { partnerId },
                UpdateExpression: 'SET lastReminderSent = :now, updatedAt = :now',
                ExpressionAttributeValues: {
                    ':now': new Date().toISOString()
                }
            }));

            return {
                success: true,
                notificationId: response.data.notificationId
            };

        } catch (error) {
            // Check if error indicates authorization revoked
            if (error.response?.status === 401 ||
                error.response?.data?.code === 'Unauthorized' ||
                error.message.includes('invalid_grant')) {

                // Update partner status to revoked
                await docClient.send(new UpdateCommand({
                    TableName: this.tableName,
                    Key: { partnerId },
                    UpdateExpression: 'SET status = :status, authorizationRevokedAt = :now, updatedAt = :now',
                    ExpressionAttributeValues: {
                        ':status': 'AUTHORIZATION_REVOKED',
                        ':now': new Date().toISOString()
                    }
                }));

                return {
                    success: false,
                    status: 'AUTHORIZATION_REVOKED'
                };
            }

            throw error;
        }
    }

    async processReminders() {
        try {
            // Find all inactive partners
            const result = await docClient.send(new QueryCommand({
                TableName: this.tableName,
                IndexName: 'statusIndex',
                KeyConditionExpression: 'status = :status',
                ExpressionAttributeValues: {
                    ':status': 'MARKED_INACTIVE'
                }
            }));

            const reminderInterval = parseInt(process.env.REMINDER_INTERVAL_DAYS) * 24 * 60 * 60 * 1000;
            const now = new Date();
            const results = [];

            for (const partner of result.Items) {
                // Check if it's time for a reminder
                const lastReminder = partner.lastReminderSent ? new Date(partner.lastReminderSent) : null;
                if (!lastReminder || (now - lastReminder) >= reminderInterval) {
                    const result = await this.sendRevocationReminder(partner.partnerId);
                    results.push({
                        partnerId: partner.partnerId,
                        result
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('Error processing reminders:', error);
            throw error;
        }
    }
}

module.exports = ReminderManager;
