package lambda.utils.common;

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
    public static final String NOTIFICATION_TYPE_B2B_ANY_OFFER_CHANGED = "B2B_ANY_OFFER_CHANGED";

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
        martketplaceIdToRegionCodeMap.put("A123456", NA_REGION_CODE); //CA
        martketplaceIdToRegionCodeMap.put("B123456", NA_REGION_CODE); //US
        martketplaceIdToRegionCodeMap.put("C123456", NA_REGION_CODE); //MX
        martketplaceIdToRegionCodeMap.put("D123456", NA_REGION_CODE); //BR
        martketplaceIdToRegionCodeMap.put("E123456", EU_REGION_CODE); //ES
        martketplaceIdToRegionCodeMap.put("F123456", EU_REGION_CODE); //UK
        martketplaceIdToRegionCodeMap.put("G123456", EU_REGION_CODE); //FR
        martketplaceIdToRegionCodeMap.put("H123456", EU_REGION_CODE); //BE
        martketplaceIdToRegionCodeMap.put("I123456", EU_REGION_CODE); //NL
        martketplaceIdToRegionCodeMap.put("J123456", EU_REGION_CODE); //DE
        martketplaceIdToRegionCodeMap.put("K123456", EU_REGION_CODE); //IT
        martketplaceIdToRegionCodeMap.put("L123456", EU_REGION_CODE); //SE
        martketplaceIdToRegionCodeMap.put("M123456", EU_REGION_CODE); //ZA
        martketplaceIdToRegionCodeMap.put("N123456", EU_REGION_CODE); //PL
        martketplaceIdToRegionCodeMap.put("O123456", EU_REGION_CODE); //EG
        martketplaceIdToRegionCodeMap.put("P123456", EU_REGION_CODE); //TR
        martketplaceIdToRegionCodeMap.put("Q123456", EU_REGION_CODE); //SA
        martketplaceIdToRegionCodeMap.put("R123456", EU_REGION_CODE); //AE
        martketplaceIdToRegionCodeMap.put("S123456", EU_REGION_CODE); //IN
        martketplaceIdToRegionCodeMap.put("T123456", FE_REGION_CODE); //SG
        martketplaceIdToRegionCodeMap.put("U123456", FE_REGION_CODE); //AU
        martketplaceIdToRegionCodeMap.put("V123456", FE_REGION_CODE); //JP

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
    public static final String SELLER_ITEMS_TABLE_PRICE_RULE_KEY_NAME = "PriceRule";
    public static final String SELLER_ITEMS_TABLE_OFFER_TYPE_KEY_NAME = "OfferType";
    public static final String SELLER_ITEMS_TABLE_QUANTITY_TIER_KEY_NAME = "QuantityTier";


}
