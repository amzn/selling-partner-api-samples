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

    // North America marketplaces
    public static final String US_MARKETPLACE_ID = "ATVPDKIKX0DER";
    public static final String CA_MARKETPLACE_ID = "A2EUQ1WTGCTBG2";
    public static final String MX_MARKETPLACE_ID = "A1AM78C64UM0Y8";
    public static final String BR_MARKETPLACE_ID = "A2Q3Y263D00KWC";

    // Europe marketplaces
    public static final String ES_MARKETPLACE_ID = "A1RKKUPIHCS9HS";
    public static final String UK_MARKETPLACE_ID = "A1F83G8C2ARO7P";
    public static final String FR_MARKETPLACE_ID = "A13V1IB3VIYZZH";
    public static final String DE_MARKETPLACE_ID = "A1PA6795UKMFR9";
    public static final String IT_MARKETPLACE_ID = "APJ6JRA9NG5V4";

    // Far East marketplaces
    public static final String SG_MARKETPLACE_ID = "A19VAU5U5O7RUS";
    public static final String AU_MARKETPLACE_ID = "A39IBJ37TRP1C6";
    public static final String JP_MARKETPLACE_ID = "A1VC38T7YXB528";

    public static final String REPORT_TYPE = "GET_MERCHANT_LISTINGS_ALL_DATA";
    public static final String TEST_IDENTIFIER = "B0D1GN282B";
    public static final String INVALID_ASIN = "0000000001";

    public static final Map<String, String> VALID_SP_API_REGION_CONFIG = ImmutableMap.of(
            NA_REGION_CODE, SP_API_NA_ENDPOINT,
            EU_REGION_CODE, SP_API_EU_ENDPOINT,
            FE_REGION_CODE, SP_API_FE_ENDPOINT);

    //Login With Amazon Configuration
    public static final String LWA_ENDPOINT = "https://api.amazon.com/auth/o2/token";

    //Lambda Environment Variables
    public static final String SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE = "SP_API_APP_CREDENTIALS_SECRET_ARN";
    public static final String REFRESH_TOKEN = "REFRESH_TOKEN";
}
