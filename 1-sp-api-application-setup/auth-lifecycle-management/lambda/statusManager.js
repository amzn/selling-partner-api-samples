const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { 
    DynamoDBDocumentClient, 
    GetCommand, 
    UpdateCommand,
    QueryCommand,
    PutCommand 
} = require("@aws-sdk/lib-dynamodb");

class StatusManager {
    constructor(partnersTableName) {
        const dynamoClient = new DynamoDBClient();
        this.docClient = DynamoDBDocumentClient.from(dynamoClient);
        this.tableName = partnersTableName;
    }

    // Status definitions matching existing usage
    static STATUSES = {
        PENDING_AUTH: 'PENDING_AUTH',     // Initial state and when reauth needed
        AUTHORIZED: 'AUTHORIZED',         // Successfully authorized
        MARKED_INACTIVE: 'MARKED_INACTIVE', // New status for inactive partners
        AUTHORIZATION_REVOKED: 'AUTHORIZATION_REVOKED', // New status when auth is revoked
        MARKED_INACTIVE: 'MARKED_INACTIVE'
    };

    // Define valid transitions based on existing logic
    static VALID_TRANSITIONS = {
        PENDING_AUTH: ['AUTHORIZED'],
        AUTHORIZED: ['PENDING_AUTH', 'MARKED_INACTIVE'],
        MARKED_INACTIVE: ['AUTHORIZED', 'AUTHORIZATION_REVOKED'],
        AUTHORIZATION_REVOKED: ['PENDING_AUTH']
    };

    async getPartner(partnerId) {
        const result = await this.docClient.send(new GetCommand({
            TableName: this.tableName,
            Key: { partnerId }
        }));
        return result.Item;
    }    

    // Method used by existing code for standard status updates
    async updatePartnerStatus(partnerId, status, additionalUpdates = {}) {
        const partner = await this.getPartner(partnerId);
        if (!partner) {
            throw new Error('Partner not found');
        }

        const now = new Date().toISOString();
        const updates = {
            ...additionalUpdates,
            status,
            updatedAt: now
        };

        await this.docClient.send(new PutCommand({
            TableName: this.tableName,
            Item: {
                ...partner,
                ...updates
            }
        }));

        return {
            partnerId,
            oldStatus: partner.status,
            newStatus: status,
            updatedAt: now
        };
    }

    // New method for marking partner as inactive
    async markInactive(partnerId) {
        const partner = await this.getPartner(partnerId);
        if (!partner) {
            throw new Error('Partner not found');
        }

        if (!['oauth', 'appstore'].includes(partner.authType)) {
            throw new Error('Only OAuth and Appstore partners can be marked inactive');
        }

        if (partner.status !== StatusManager.STATUSES.AUTHORIZED) {
            throw new Error('Only authorized partners can be marked inactive');
        }

        const now = new Date().toISOString();
        await this.docClient.send(new PutCommand({
            TableName: this.tableName,
            Item: {
                ...partner,
                status: StatusManager.STATUSES.MARKED_INACTIVE,
                markedInactiveAt: now,
                lastReminderSent: null,
                updatedAt: now
            }
        }));

        return {
            partnerId,
            oldStatus: partner.status,
            newStatus: StatusManager.STATUSES.MARKED_INACTIVE,
            updatedAt: now
        };
    }

    // Method for marking authorization as revoked
    async markRevoked(partnerId) {
        const partner = await this.getPartner(partnerId);
        if (!partner) {
            throw new Error('Partner not found');
        }

        const now = new Date().toISOString();
        await this.docClient.send(new PutCommand({
            TableName: this.tableName,
            Item: {
                ...partner,
                status: StatusManager.STATUSES.AUTHORIZATION_REVOKED,
                authorizationRevokedAt: now,
                updatedAt: now
            }
        }));

        return {
            partnerId,
            oldStatus: partner.status,
            newStatus: StatusManager.STATUSES.AUTHORIZATION_REVOKED,
            updatedAt: now
        };
    }


    // Add this method to the StatusManager class
    async markInactive(partnerId) {
        const partner = await this.getPartner(partnerId);
        if (!partner) {
        throw new Error('Partner not found');
        }
    
        if (!['oauth', 'appstore'].includes(partner.authType)) {
        throw new Error('Only OAuth and Appstore partners can be marked inactive');
        }
    
        if (partner.status !== StatusManager.STATUSES.AUTHORIZED) {
        throw new Error('Only authorized partners can be marked inactive');
        }
    
        const now = new Date().toISOString();
        await this.docClient.send(new PutCommand({
        TableName: this.tableName,
        Item: {
            ...partner,
            status: StatusManager.STATUSES.MARKED_INACTIVE,
            markedInactiveAt: now,
            lastReminderSent: null,
            updatedAt: now
        }
        }));
    
        return {
        partnerId,
        oldStatus: partner.status,
        newStatus: StatusManager.STATUSES.MARKED_INACTIVE,
        updatedAt: now
        };
    }
}

module.exports = StatusManager;
