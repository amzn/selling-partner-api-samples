package reports;

/**
 * Holds the sample values and notification payload reused by the Reports recipes.
 */
public final class Constants {

    private Constants() {}

    /**
     * The report type to request. See the Report Type Values reference for the full list:
     * https://developer-docs.amazon.com/sp-api/docs/report-type-values
     */
    public static final String SAMPLE_REPORT_TYPE = "GET_FLAT_FILE_OPEN_LISTINGS_DATA";

    /** US marketplace id. See https://developer-docs.amazon.com/sp-api/docs/marketplace-ids */
    public static final String SAMPLE_MARKETPLACE_ID = "ATVPDKIKX0DER";

    /**
     * Sample REPORT_PROCESSING_FINISHED notification. In production you subscribe to this
     * notification (via the Notifications API) instead of polling getReport, and read the
     * reportDocumentId from the payload once processingStatus is DONE.
     * https://developer-docs.amazon.com/sp-api/docs/notification-type-values#report_processing_finished
     */
    public static final String SAMPLE_NOTIFICATION =
            "{"
            + "  \"notificationVersion\": \"2021-06-30\"," + "\n"
            + "  \"notificationType\": \"REPORT_PROCESSING_FINISHED\"," + "\n"
            + "  \"payloadVersion\": \"2021-06-30\"," + "\n"
            + "  \"eventTime\": \"2023-12-23T21:30:13.713Z\"," + "\n"
            + "  \"payload\": {" + "\n"
            + "    \"reportProcessingFinishedNotification\": {" + "\n"
            + "      \"sellerId\": \"A3TUGXWLNSFPBS\"," + "\n"
            + "      \"accountId\": \"amzn1.merchant.o.ABCD012345689\"," + "\n"
            + "      \"reportId\": \"ID323\"," + "\n"
            + "      \"reportType\": \"GET_FLAT_FILE_OPEN_LISTINGS_DATA\"," + "\n"
            + "      \"processingStatus\": \"DONE\"," + "\n"
            + "      \"reportDocumentId\": \"amzn1.spdoc.1.3.sample-report-document\"" + "\n"
            + "    }" + "\n"
            + "  }," + "\n"
            + "  \"notificationMetadata\": {" + "\n"
            + "    \"applicationId\": \"amzn1.sellerapps.app.aacccfff-4455-4b7c-4422-664ecacdd336\"," + "\n"
            + "    \"subscriptionId\": \"subscription-id-d0e9e693-c3ad-4373-979f-ed4ec98dd746\"," + "\n"
            + "    \"publishTime\": \"2023-12-23T21:30:16.903Z\"," + "\n"
            + "    \"notificationId\": \"d0e9e693-c3ad-4373-979f-ed4ec98dd746\"" + "\n"
            + "  }" + "\n"
            + "}";
}
