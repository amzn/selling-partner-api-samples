package lambda.utils;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

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

    //Notifications Configuration
    public static final String NOTIFICATION_TYPE_ANY_OFFER_CHANGED = "ANY_OFFER_CHANGED";

    public static final String OFFER_CHANGE_TYPE_INTERNAL = "Internal";
    public static final String OFFER_CHANGE_TYPE_FEATURED_OFFER = "FeaturedOffer";
    public static final Set<String> PRICE_CHANGE_OFFER_CHANGE_TYPES = ImmutableSet.of(
            OFFER_CHANGE_TYPE_INTERNAL,
            OFFER_CHANGE_TYPE_FEATURED_OFFER);

    //Lambda Environment Variables
    public static final String SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE = "SP_API_APP_CREDENTIALS_SECRET_ARN";
    public static final String SQS_QUEUE_ARN_ENV_VARIABLE = "SQS_QUEUE_ARN";
    public static final String REFRESH_TOKEN_ARN_ENV_VARIABLE = "REFRESH_TOKEN";
    public static final String STATE_MACHINE_ARN_ENV_VARIABLE = "STATE_MACHINE_ARN";
    public static final String SELLER_ITEMS_TABLE_NAME_ENV_VARIABLE = "SELLER_ITEMS_TABLE_NAME";

    //Lambda Utils
    public static final String LWA_NOTIFICATIONS_SCOPE = "sellingpartnerapi::notifications";

    public static final String getMartketplaceIdToRegionCodeMapping(String marketplaceId) {
        Map<String, String> martketplaceIdToRegionCodeMap = new HashMap<>();
        martketplaceIdToRegionCodeMap.put("A2EUQ1WTGCTBG2", NA_REGION_CODE); //CA
        martketplaceIdToRegionCodeMap.put("ATVPDKIKX0DER", NA_REGION_CODE); //US
        martketplaceIdToRegionCodeMap.put("A1AM78C64UM0Y8", NA_REGION_CODE); //MX
        martketplaceIdToRegionCodeMap.put("A2Q3Y263D00KWC", NA_REGION_CODE); //BR
        martketplaceIdToRegionCodeMap.put("A1RKKUPIHCS9HS", EU_REGION_CODE); //ES
        martketplaceIdToRegionCodeMap.put("A1F83G8C2ARO7P", EU_REGION_CODE); //UK
        martketplaceIdToRegionCodeMap.put("A13V1IB3VIYZZH", EU_REGION_CODE); //FR
        martketplaceIdToRegionCodeMap.put("AMEN7PMS3EDWL", EU_REGION_CODE); //BE
        martketplaceIdToRegionCodeMap.put("A1805IZSGTT6HS", EU_REGION_CODE); //NL
        martketplaceIdToRegionCodeMap.put("A1PA6795UKMFR9", EU_REGION_CODE); //DE
        martketplaceIdToRegionCodeMap.put("APJ6JRA9NG5V4", EU_REGION_CODE); //IT
        martketplaceIdToRegionCodeMap.put("A2NODRKZP88ZB9", EU_REGION_CODE); //SE
        martketplaceIdToRegionCodeMap.put("AE08WJ6YKNBMC", EU_REGION_CODE); //ZA
        martketplaceIdToRegionCodeMap.put("A1C3SOZRARQ6R3", EU_REGION_CODE); //PL
        martketplaceIdToRegionCodeMap.put("ARBP9OOSHTCHU", EU_REGION_CODE); //EG
        martketplaceIdToRegionCodeMap.put("A33AVAJ2PDY3EV", EU_REGION_CODE); //TR
        martketplaceIdToRegionCodeMap.put("A17E79C6D8DWNP", EU_REGION_CODE); //SA
        martketplaceIdToRegionCodeMap.put("A2VIGQ35RCS4UG", EU_REGION_CODE); //AE
        martketplaceIdToRegionCodeMap.put("A21TJRUUN4KGV", EU_REGION_CODE); //IN
        martketplaceIdToRegionCodeMap.put("A19VAU5U5O7RUS", FE_REGION_CODE); //SG
        martketplaceIdToRegionCodeMap.put("A39IBJ37TRP1C6", FE_REGION_CODE); //AU
        martketplaceIdToRegionCodeMap.put("A1VC38T7YXB528", FE_REGION_CODE); //JP

        return martketplaceIdToRegionCodeMap.get(marketplaceId);
    }

    public static final String PRICE_CHANGE_RULE_PERCENTAGE = "PERCENTAGE";
    public static final String PRICE_CHANGE_RULE_FIXED = "FIXED";

    //Generic Lambda Input Parameters
    public static final String REGION_CODE_KEY_NAME = "RegionCode";
    public static final String REFRESH_TOKEN_KEY_NAME = "RefreshToken";
    public static final String NOTIFICATION_TYPE_KEY_NAME = "NotificationType";

    //DynamoDB attributes
    public static final String SELLER_ITEMS_TABLE_HASH_KEY_NAME = "ASIN";
    public static final String SELLER_ITEMS_TABLE_SKU_KEY_NAME = "SKU";
    public static final String SELLER_ITEMS_TABLE_SELLER_ID_KEY_NAME = "SellerId";
    public static final String SELLER_ITEMS_TABLE_MARKETPLACE_ID_KEY_NAME = "MarketplaceId";
    public static final String SELLER_ITEMS_TABLE_CONDITION_KEY_NAME = "Condition";
    public static final String SELLER_ITEMS_TABLE_IS_FULFILLED_BY_AMAZON_KEY_NAME = "IsFulfilledByAmazon";
    public static final String SELLER_ITEMS_TABLE_PRICE_CHANGE_RULE_KEY_NAME = "PriceChangeRule";
    public static final String SELLER_ITEMS_TABLE_PRICE_CHANGE_RULE_AMOUNT_KEY_NAME = "PriceChangeRuleAmount";
    public static final String SELLER_ITEMS_TABLE_MIN_THRESHOLD_KEY_NAME = "MinThreshold";
}
