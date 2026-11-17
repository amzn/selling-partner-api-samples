package lambda.common;

import com.google.common.collect.ImmutableMap;
import software.amazon.spapi.models.notifications.v1.EventFilter;

import java.util.Map;

import static software.amazon.spapi.models.notifications.v1.EventFilter.EventFilterTypeEnum.ANY_OFFER_CHANGED;
import static software.amazon.spapi.models.notifications.v1.EventFilter.EventFilterTypeEnum.ORDER_CHANGE;

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

    public static final ImmutableMap<String, EventFilter.EventFilterTypeEnum> EVENT_FILTER_REQUIRED_NOTIFICATION_TYPE = ImmutableMap.of(
            "ORDER_CHANGE", ORDER_CHANGE,
            "ANY_OFFER_CHANGED", ANY_OFFER_CHANGED);

    //Lambda Environment Variables
    public static final String SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE = "AGGREGATED_SECRET_NAMES";
    public static final String NOTIFICATION_DESTINATION_ENV_VARIABLE = "NOTIFICATION_RESOURCES";
    public static final String WEB_HOOK_URL_ENV_VARIABLE = "WEB_HOOK_URL";
    public static final String CLIENT_TABLE_NAME_ENV_VARIABLE = "CLIENT_TABLE_NAME";
    public static final String EVENT_BUS_DESTINATION_ID_ENV_VARIABLE = "EVENT_BUS_DESTINATION_ID";
    public static final String WEB_HOOK_AUTH_TOKEN_ENV_VARIABLE = "WEB_HOOK_AUTH_TOKEN";
    public static final String NOTIFICATION_TYPE_DEFINITION_ENV_VARIABLE = "NOTIFICATION_TYPE_DEFINITION";
    public static final String WEB_HOOK_AUTH_HEADER_NAME_ENV_VARIABLE = "WEB_HOOK_AUTH_HEADER_NAME";
    public static final String CROSS_PLATFORM_DESTINATION_TYPE_ENV_VARIABLE = "CROSS_PLATFORM_DESTINATION_TYPE";
    public static final String TARGET_SQS_URL_ENV_VARIABLE = "TARGET_SQS_URL";
    public static final String TARGET_EVENT_BUS_ARN_ENV_VARIABLE = "TARGET_EVENT_BUS_ARN";
    public static final String GCP_PROJECT_ID_ENV_VARIABLE = "GCP_PROJECT_ID";
    public static final String GCP_TOPIC_ID_ENV_VARIABLE = "GCP_TOPIC_ID";
    public static final String AZURE_QUEUE_CONNECTION_STRING_ARN_ENV_VARIABLE = "AZURE_QUEUE_CONNECTION_STRING_ARN";
    public static final String AZURE_QUEUE_NAME_ENV_VARIABLE = "AZURE_QUEUE_NAME";
    public static final String AZURE_SB_CONNECTION_STRING_ARN_ENV_VARIABLE = "AZURE_SB_CONNECTION_STRING_ARN";
    public static final String AZURE_SB_QUEUE_NAME_ENV_VARIABLE = "AZURE_SB_QUEUE_NAME";
    public static final String NOTIFICATION_TYPE_ENV_VARIABLE = "NOTIFICATION_TYPE";
    public static final String GCP_SPAPI_PUBSUB_KEY_ARN_ENV_VARIABLE = "GCP_SPAPI_PUBSUB_KEY_ARN";
    public static final String DLQ_SQS_URL_ENV_VARIABLE = "DLQ_SQS_URL";
    public static final String STATE_MACHINE_ARN_ORDERNOTIFICATION_ENV_VARIABLE = "STATE_MACHINE_ARN_ORDERNOTIFICATION";

    //Generic Lambda Input Parameters
    public static final String NOTIFICATION_TYPE_KEY_NAME = "NotificationTypes";
    public static final String SELLER_ID_KEY_NAME = "SellerIds";

    //Lambda Utils
    public static final String LWA_NOTIFICATIONS_SCOPE = "sellingpartnerapi::notifications";
    public static final int BATCH_SIZE = 10;

    //Login With Amazon Configuration
    public static final String LWA_ENDPOINT = "https://api.amazon.com/auth/o2/token";

    //Notifications Configuration
    public static final String NOTIFICATION_TYPE_ORDER_CHANGE = "ORDER_CHANGE";
    public static final String NOTIFICATION_LEVEL_ORDER_LEVEL = "OrderLevel";
    public static final String NOTIFICATION_IGNORE_ORDER_STATUS= "Pending";

    // DynamoDB Attribute Keys
    public static final String SUBSCRIPTION_ID = "SubscriptionId";
    public static final String SELLER_ID = "SellerId";
    public static final String DESTINATION_ID = "DestinationId";
    public static final String TIMESTAMP = "Timestamp";
    public static final String NOTIFICATION_TYPE = "NotificationType";
    public static final String SELLER_SECRETS_ARN = "SellerSecretsArn";

    //Combined order information Json Keys
    public static final String COMBINED_ORDER_JSON_KEY_ORDER = "orderResponse";
    public static final String COMBINED_ORDER_JSON_KEY_ORDER_ITEM = "orderItemsResponse";

    // Step Function input Key
    public static final String STEP_FUNCTION_INPUT_KEY_SUBJECT = "Subject";
    public static final String STEP_FUNCTION_INPUT_KEY_MESSAGE = "Message";
    public static final String STEP_FUNCTION_INPUT_KEY_CREDENTIAL = "Credentials";

}
