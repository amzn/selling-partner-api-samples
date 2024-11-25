package lambda.utils;

import com.google.common.collect.ImmutableMap;

import java.util.Map;

public class Constants {

    //Region configuration
    public static final String NA_REGION_CODE = "NA";
    public static final String SP_API_NA_ENDPOINT = "https://sellingpartnerapi-na.amazon.com";
    public static final String EU_REGION_CODE = "EU";
    public static final String SP_API_EU_ENDPOINT = "https://sellingpartnerapi-eu.amazon.com";
    public static final String FE_REGION_CODE = "FE";
    public static final String SP_API_FE_ENDPOINT = "https://sellingpartnerapi-fe.amazon.com";

    public static final Map<String, String> VALID_SP_API_REGION_CONFIG = ImmutableMap.of(
            NA_REGION_CODE, SP_API_NA_ENDPOINT,
            EU_REGION_CODE, SP_API_EU_ENDPOINT,
            FE_REGION_CODE, SP_API_FE_ENDPOINT);

    //Login With Amazon Configuration
    public static final String LWA_ENDPOINT = "https://api.amazon.com/auth/o2/token";

    //Lambda Environment Variables
    public static final String SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE = "SP_API_APP_CREDENTIALS_SECRET_ARN";
    public static final String INVENTORY_TABLE_NAME_ENV_VARIABLE = "INVENTORY_TABLE_NAME";
    public static final String SQS_QUEUE_ARN_ENV_VARIABLE = "SQS_QUEUE_ARN";
    public static final String EASYSHIP_LABEL_S3_BUCKET_NAME_ENV_VARIABLE = "EASYSHIP_LABEL_DOCUMENTS_S3_BUCKET_NAME";
    public static final String LWA_NOTIFICATIONS_SCOPE = "sellingpartnerapi::notifications";

    //Generic Lambda Input Parameters
    public static final String REGION_CODE_KEY_NAME = "REGION_CODE";
    public static final String REFRESH_TOKEN_KEY_NAME = "REFRESH_TOKEN";
    public static final String STATE_MACHINE_ARN_ENV_VARIABLE = "STATE_MACHINE_ARN";
    public static final String NOTIFICATION_TYPE_KEY_NAME = "NotificationType";

    //Notifications Configuration
    public static final String NOTIFICATION_TYPE_ORDER_CHANGE = "ORDER_CHANGE";
    public static final String NOTIFICATION_LEVEL_ORDER_LEVEL = "OrderLevel";

    // DynamoDB Attributes
    public static final String INVENTORY_TABLE_HASH_KEY_NAME = "SKU";
    public static final String INVENTORY_TABLE_STOCK_ATTRIBUTE_NAME = "Stock";
    public static final String INVENTORY_TABLE_WEIGHT_VALUE_ATTRIBUTE_NAME = "WeightValue";
    public static final String INVENTORY_TABLE_WEIGHT_UNIT_ATTRIBUTE_NAME = "WeightUnit";
    public static final String INVENTORY_TABLE_LENGTH_ATTRIBUTE_NAME = "Length";
    public static final String INVENTORY_TABLE_WIDTH_ATTRIBUTE_NAME = "Width";
    public static final String INVENTORY_TABLE_HEIGHT_ATTRIBUTE_NAME = "Height";
    public static final String INVENTORY_TABLE_SIZE_UNIT_ATTRIBUTE_NAME = "SizeUnit";

    // Feeds attribute
    public static final String POST_EASYSHIP_DOCUMENTS = "POST_EASYSHIP_DOCUMENTS";
    public static final String FEED_OPTIONS_DOCUMENT_TYPE_VALUE = "ShippingLabel";
    public static final String FEED_OPTIONS_KEY_AMAZON_ORDER_ID = "AmazonOrderId";
    public static final String FEED_OPTIONS_KEY_DOCUMENT_TYPE = "DocumentType";
    public static final String FEED_DOCUMENT_REPORT_REFERENCE_ID = "DocumentReportReferenceID";

    //Lambda Utils
    public static final int POLLING_INTERVAL_MS = 5000;
    public static final int PRESIGNED_URL_EXPIRATION_MINUTES = 60;
    public static final String PDF_CONTENT_TYPE = "application/pdf";
    public static final String GZIP_ENCODING = "gzip";
    public static final int BUFFER_SIZE = 4096;
    public static final int MAX_RETRY_ATTEMPTS = 20;
}
