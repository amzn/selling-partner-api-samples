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

    //Data Kiosk Variables
    public static final String QUERY_CODE_KEY_NAME = "Query";
    public static final String QUERY_ID_KEY_NAME = "QueryId";

    //Notifications Configuration
    public static final String NOTIFICATION_TYPE_DATA_KIOSK_PROCESSING_FINISHED = "DATA_KIOSK_QUERY_PROCESSING_FINISHED";
    public static final String DATA_KIOSK_NOTIFICATION_PROCESSING_STATUS_FATAL = "Fatal";

    //Lambda Environment Variables
    public static final String SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE = "SP_API_APP_CREDENTIALS_SECRET_ARN";
    public static final String STATE_MACHINE_ARN_ENV_VARIABLE = "STATE_MACHINE_ARN";
    public static final String SQS_QUEUE_ARN_ENV_VARIABLE = "SQS_QUEUE_ARN";
    public static final String REGION_CODE_ARN_ENV_VARIABLE = "REGION_CODE";
    public static final String REFRESH_TOKEN_ARN_ENV_VARIABLE = "REFRESH_TOKEN";
    public static final String DATAKIOSK_DOCUMENTS_S3_BUCKET_NAME_ENV_VARIABLE = "DATAKIOSK_DOCUMENTS_S3_BUCKET_NAME";

    //Generic Lambda Input Parameters
    public static final String REGION_CODE_KEY_NAME = "RegionCode";
    public static final String REFRESH_TOKEN_KEY_NAME = "RefreshToken";
    public static final String NOTIFICATION_TYPE_KEY_NAME = "NotificationType";

    //Lambda Utils
    public static final String LWA_NOTIFICATIONS_SCOPE = "sellingpartnerapi::notifications";

    //DynamoDB Utils
    public static final String QUERY_ITEMS_TABLE_NAME_ENV_VARIABLE = "QUERY_ITEMS_TABLE_NAME";
    public static final String QUERY_ITEMS_TABLE_ATTRIBUTE_ACCOUNT_ID = "AccountId";
    public static final String QUERY_ITEMS_TABLE_ATTRIBUTE_QUERY_ID = "QueryId";
    public static final String QUERY_ITEMS_TABLE_ATTRIBUTE_QUERY = "Query";
    public static final String QUERY_ITEMS_TABLE_ATTRIBUTE_DOCUMENT_ID = "DocumentId";
    public static final String QUERY_ITEMS_TABLE_ATTRIBUTE_DOCUMENT_S3 = "DocumentS3";
    public static final String QUERY_ITEMS_TABLE_ATTRIBUTE_PROCESSING_STATUS = "ProcessingStatus";

    //Login With Amazon Configuration
    public static final String LWA_ENDPOINT = "https://api.amazon.com/auth/o2/token";
}
