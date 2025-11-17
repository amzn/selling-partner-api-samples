package util;

public class Constants {
    public static final String BACKEND_URL = "http://localhost:3000";
    
    public static final String DATAKIOSK_SAMPLE_QUERY = "query MyQuery{analytics_salesAndTraffic_2023_11_15{salesAndTrafficByAsin(aggregateBy:CHILD endDate:\"10-05-2025\" startDate:\"10-06-2025\"){sku traffic{browserSessions pageViews}}}}";
    
    public static final String DATAKIOSK_SAMPLE_NOTIFICATION = "{\n" +
            "  \"notificationVersion\": \"2023-11-15\",\n" +
            "  \"notificationType\": \"DATA_KIOSK_QUERY_PROCESSING_FINISHED\",\n" +
            "  \"payloadVersion\": \"2023-11-15\",\n" +
            "  \"eventTime\": \"2023-12-23T21:30:13.713Z\",\n" +
            "  \"payload\": {\n" +
            "    \"accountId\": \"amzn1.merchant.o.ABCD0123456789\",\n" +
            "    \"processingStatus\": \"FATAL\",\n" +
            "    \"errorDocumentId\": \"amzn1.tortuga.4.na.2f9d3460-fbe1-4b76-98dc-0f7af28ccad5.T3IN36JA9NX45R\",\n" +
            "    \"query\": \"query MyQuery {analytics_salesAndTraffic_2023_11_15 {salesAndTrafficByDate(aggregateBy:DAY,endDate:\\\"11-02-2023\\\",startDate:\\\"25-02-2023\\\",marketplaceIds:[\\\"ATVPDKIKX0DER\\\"]) {endDate marketplaceId sales {ordersShipped}}}}\",\n" +
            "    \"createdTime\": \"2024-03-12T16:05:20Z\",\n" +
            "    \"processingStartTime\": \"2024-03-12T16:05:25Z\",\n" +
            "    \"queryId\": \"233844020409\"\n" +
            "  },\n" +
            "  \"notificationMetadata\": {\n" +
            "    \"applicationId\": \"amzn1.sellerapps.app.aacccfff-4455-4b7c-4422-664ecacdd336\",\n" +
            "    \"subscriptionId\": \"subscription-id-d0e9e693-c3ad-4373-979f-ed4ec98dd746\",\n" +
            "    \"publishTime\": \"2023-12-23T21:30:16.903Z\",\n" +
            "    \"notificationId\": \"d0e9e693-c3ad-4373-979f-ed4ec98dd746\"\n" +
            "  }\n" +
            "}";
}
