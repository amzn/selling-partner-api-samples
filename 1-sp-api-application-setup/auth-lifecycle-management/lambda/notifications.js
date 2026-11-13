// lambda/notifications.js
const axios = require('./spApiLogger');

  

class NotificationManager {
    constructor(spApiEndpoint) {
        this.spApiEndpoint = spApiEndpoint;
    }

    /**
     * Create a destination for SP-API notifications
     * @param {string} queueArn - The ARN of the SQS queue
     * @param {string} name - A name to identify this destination
     * @param {string} accessToken - SP-API access token
     * @returns {Promise<{destinationId: string}>}
     */
    async createDestination(queueArn, name, accessToken) {
        try {
            console.log('Creating destination with ARN:', queueArn);

            const response = await axios.post(
                `${this.spApiEndpoint}/notifications/v1/destinations`,
                {
                    name,
                    resourceSpecification: {
                        sqs: {
                            arn: queueArn
                        }
                    }
                },
                {
                    headers: {
                        'x-amz-access-token': accessToken,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data?.payload?.destinationId) {
                throw new Error('No destinationId received in response');
            }

            return {
                destinationId: response.data.payload.destinationId,
                name: response.data.payload.name,
                resource: response.data.payload.resourceSpecification
            };
        } catch (error) {
            console.error('Error creating destination:', error.response?.data || error);
            throw error;
        }
    }

    /**
     * Create a subscription to a notification type
     * @param {string} notificationType - The type of notification to subscribe to
     * @param {string} destinationId - The destination ID to send notifications to
     * @param {string} accessToken - SP-API access token
     * @param {string} payloadVersion - Version of the notification payload
     * @returns {Promise<{subscriptionId: string}>}
     */
    async createSubscription(notificationType, destinationId, accessToken, payloadVersion = '1.0') {
        try {
            const response = await axios.post(
                `${this.spApiEndpoint}/notifications/v1/subscriptions/${notificationType}`,
                {
                    payloadVersion,
                    destinationId
                },
                {
                    headers: {
                        'x-amz-access-token': `${accessToken}`,   
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data?.payload?.subscriptionId) {
                throw new Error('No subscriptionId received in response');
            }

            return {
                subscriptionId: response.data.payload.subscriptionId,
                destinationId: response.data.payload.destinationId,
                payloadVersion: response.data.payload.payloadVersion
            };
        } catch (error) {
            console.error('Error creating subscription:', error.response?.data || error.message);
            throw new Error(`Failed to create subscription: ${error.message}`);
        }
    }

    /**
     * Get all destinations
     * @param {string} accessToken - SP-API access token
     * @returns {Promise<Array>}
     */
    async getDestinations(accessToken) {
        try {
            const response = await axios.get(
                `${this.spApiEndpoint}/notifications/v1/destinations`,
                {
                    headers: {
                        'x-amz-access-token': `${accessToken}`,
                    }
                }
            );

            return response.data?.payload || [];
        } catch (error) {
            console.error('Error getting destinations:', error.response?.data || error.message);
            throw new Error(`Failed to get destinations: ${error.message}`);
        }
    }

    /**
     * Delete a destination
     * @param {string} destinationId - The ID of the destination to delete
     * @param {string} accessToken - SP-API access token
     * @returns {Promise<void>}
     */
    async deleteDestination(destinationId, accessToken) {
        try {
            await axios.delete(
                `${this.spApiEndpoint}/notifications/v1/destinations/${destinationId}`,
                {
                    headers: {
                        'x-amz-access-token': `${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        } catch (error) {
            console.error('Error deleting destination:', error.response?.data || error.message);
            throw new Error(`Failed to delete destination: ${error.message}`);
        }
    }
}

module.exports = NotificationManager;