"""
Sample values and notification payload reused by the Reports recipe.
"""

# The report type to request. See the Report Type Values reference for the full list:
# https://developer-docs.amazon.com/sp-api/docs/report-type-values
sample_report_type = "GET_FLAT_FILE_OPEN_LISTINGS_DATA"

# US marketplace id. See https://developer-docs.amazon.com/sp-api/docs/marketplace-ids
sample_marketplace_id = "ATVPDKIKX0DER"

# Sample REPORT_PROCESSING_FINISHED notification. In production you subscribe to this
# notification (via the Notifications API) instead of polling getReport, and read the
# reportDocumentId from the payload once processingStatus is DONE.
# https://developer-docs.amazon.com/sp-api/docs/notification-type-values#report_processing_finished
sample_report_notification = {
    "notificationVersion": "2021-06-30",
    "notificationType": "REPORT_PROCESSING_FINISHED",
    "payloadVersion": "2021-06-30",
    "eventTime": "2023-12-23T21:30:13.713Z",
    "payload": {
        "reportProcessingFinishedNotification": {
            "sellerId": "A3TUGXWLNSFPBS",
            "accountId": "amzn1.merchant.o.ABCD012345689",
            "reportId": "ID323",
            "reportType": "GET_FLAT_FILE_OPEN_LISTINGS_DATA",
            "processingStatus": "DONE",
            "reportDocumentId": "amzn1.spdoc.1.3.sample-report-document",
        }
    },
    "notificationMetadata": {
        "applicationId": "amzn1.sellerapps.app.aacccfff-4455-4b7c-4422-664ecacdd336",
        "subscriptionId": "subscription-id-d0e9e693-c3ad-4373-979f-ed4ec98dd746",
        "publishTime": "2023-12-23T21:30:16.903Z",
        "notificationId": "d0e9e693-c3ad-4373-979f-ed4ec98dd746",
    },
}
