<?php

namespace Lambda\Utils;

class Constants
{
    // Region configuration
    public const string NA_REGION_CODE = "NA";
    public const string SP_API_NA_ENDPOINT = "https://sellingpartnerapi-na.amazon.com";
    public const string EU_REGION_CODE = "EU";
    public const string SP_API_EU_ENDPOINT = "https://sellingpartnerapi-eu.amazon.com";
    public const string FE_REGION_CODE = "FE";
    public const string SP_API_FE_ENDPOINT = "https://sellingpartnerapi-fe.amazon.com";

    public const array VALID_SP_API_REGION_CONFIG = [
        self::NA_REGION_CODE => self::SP_API_NA_ENDPOINT,
        self::EU_REGION_CODE => self::SP_API_EU_ENDPOINT,
        self::FE_REGION_CODE => self::SP_API_FE_ENDPOINT,
    ];

    // Login With Amazon Configuration
    public const string LWA_ENDPOINT = "https://api.amazon.com/auth/o2/token";

    // Lambda Environment Variables
    public const string SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE = "SP_API_APP_CREDENTIALS_SECRET_ARN";
    public const string INVENTORY_TABLE_NAME_ENV_VARIABLE = "INVENTORY_TABLE_NAME";
    public const string SQS_QUEUE_ARN_ENV_VARIABLE = "SQS_QUEUE_ARN";
    public const string EASYSHIP_LABEL_S3_BUCKET_NAME_ENV_VARIABLE = "EASYSHIP_LABEL_DOCUMENTS_S3_BUCKET_NAME";
    public const string LWA_NOTIFICATIONS_SCOPE = "sellingpartnerapi::notifications";
    public const string URL_TABLE_NAME_ENV_VARIABLE = "URL_TABLE_NAME";
    public const string SHORTLINK_BASE_URL_ENV_VARIABLE = "SHORTLINK_BASE_URL";

    // Generic Lambda Input Parameters
    public const string REGION_CODE_KEY_NAME = "REGION_CODE";
    public const string REFRESH_TOKEN_KEY_NAME = "REFRESH_TOKEN";
    public const string STATE_MACHINE_ARN_ENV_VARIABLE = "STATE_MACHINE_ARN";
    public const string NOTIFICATION_TYPE_KEY_NAME = "NotificationType";

    // Notifications Configuration
    public const string NOTIFICATION_TYPE_ORDER_CHANGE = "ORDER_CHANGE";
    public const string NOTIFICATION_LEVEL_ORDER_LEVEL = "OrderLevel";
    public const string NOTIFICATION_IGNORE_ORDER_STATUS= "Pending";

    // DynamoDB Attributes
    public const string INVENTORY_TABLE_HASH_KEY_NAME = "SKU";
    public const string INVENTORY_TABLE_STOCK_ATTRIBUTE_NAME = "Stock";
    public const string INVENTORY_TABLE_WEIGHT_VALUE_ATTRIBUTE_NAME = "WeightValue";
    public const string INVENTORY_TABLE_WEIGHT_UNIT_ATTRIBUTE_NAME = "WeightUnit";
    public const string INVENTORY_TABLE_LENGTH_ATTRIBUTE_NAME = "Length";
    public const string INVENTORY_TABLE_WIDTH_ATTRIBUTE_NAME = "Width";
    public const string INVENTORY_TABLE_HEIGHT_ATTRIBUTE_NAME = "Height";
    public const string INVENTORY_TABLE_SIZE_UNIT_ATTRIBUTE_NAME = "SizeUnit";
    public const string URL_TABLE_HASH_KEY_NAME = "AmazonOrderNumber";

    // Feeds attribute
    public const string POST_EASYSHIP_DOCUMENTS = "POST_EASYSHIP_DOCUMENTS";
    public const string FEED_OPTIONS_DOCUMENT_TYPE_VALUE = "ShippingLabel";
    public const string FEED_OPTIONS_KEY_AMAZON_ORDER_ID = "AmazonOrderId";
    public const string FEED_OPTIONS_KEY_DOCUMENT_TYPE = "DocumentType";
    public const string FEED_DOCUMENT_REPORT_REFERENCE_ID = "DocumentReportReferenceID";

    // Lambda Utils
    public const int POLLING_INTERVAL_MS = 5000;
    public const int PRESIGNED_URL_EXPIRATION_MINUTES = 60;
    public const string PDF_CONTENT_TYPE = "application/pdf";
    public const int MAX_RETRY_ATTEMPTS = 20;
}
