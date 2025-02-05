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

    // Implementation-specific Constants
    public static final Integer QUANTITY = 1;
    public static final String CONTENT_INFORMATION_SOURCE = "BOX_CONTENT_PROVIDED";
    public static final Integer PAGE_SIZE = 20;
}
