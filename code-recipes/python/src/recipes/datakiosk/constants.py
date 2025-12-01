backend_url = "http://localhost:3000"

sample_query = "query MyQuery{analytics_salesAndTraffic_2023_11_15{salesAndTrafficByAsin(aggregateBy:CHILD endDate:\"10-05-2025\" startDate:\"10-06-2025\"){sku traffic{browserSessions pageViews}}}}"

sample_data_kiosk_notification = {
  "notificationVersion": "2023-11-15",
  "notificationType": "DATA_KIOSK_QUERY_PROCESSING_FINISHED",
  "payloadVersion": "2023-11-15",
  "eventTime": "2023-12-23T21:30:13.713Z",
  "payload": {
    "accountId": "amzn1.merchant.o.ABCD0123456789",
    "processingStatus": "DONE",
    "dataDocumentId": "amzn1.tortuga.4.na.sample-data-document",
    "errorDocumentId": None,
    "query": "query MyQuery {analytics_salesAndTraffic_2023_11_15 {salesAndTrafficByDate(aggregateBy:DAY,endDate:\"11-02-2023\",startDate:\"25-02-2023\",marketplaceIds:[\"ATVPDKIKX0DER\"]) {endDate marketplaceId sales {ordersShipped}}}}",
    "createdTime": "2024-03-12T16:05:20Z",
    "processingStartTime": "2024-03-12T16:05:25Z",
    "queryId": "233844020409"
  },
  "notificationMetadata": {
    "applicationId": "amzn1.sellerapps.app.aacccfff-4455-4b7c-4422-664ecacdd336",
    "subscriptionId": "subscription-id-d0e9e693-c3ad-4373-979f-ed4ec98dd746",
    "publishTime": "2023-12-23T21:30:16.903Z",
    "notificationId": "d0e9e693-c3ad-4373-979f-ed4ec98dd746"
  }
}
