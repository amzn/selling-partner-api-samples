using System;
using System.Collections;
using System.Collections.Generic;

namespace spApiCsharpApp
{
    public class Constants
    {      
        //Region configuration
        public static String NaRegionCode = "NA";
        public static String SpApiNaEndpoint = "https://sellingpartnerapi-na.amazon.com";
        public static String EuRegionCode = "EU";
        public static String SpApiEuEndpoint = "https://sellingpartnerapi-eu.amazon.com";
        public static String FeRegionCode = "FE";
        public static String SpApiFeEndpoint = "https://sellingpartnerapi-fe.amazon.com";
        public static String SandboxRegionCode = "SANDBOX";
        public static String SpApiNaSandboxEndpoint = "https://sandbox.sellingpartnerapi-na.amazon.com";


        //Region to endpoint mapping
        public static Dictionary<String, String> RegionEndpointMapping = new Dictionary<string, string> {
            { NaRegionCode,SpApiNaEndpoint },
            { EuRegionCode,SpApiEuEndpoint },
            { FeRegionCode,SpApiFeEndpoint },
            { SandboxRegionCode,SpApiNaSandboxEndpoint }    };

        //Login With Amazon Configuration
        public static String LWA_ENDPOINT = "https://api.amazon.com/auth/o2/token";

        //Lambda Environment Variables        
        public static String SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE = "SP_API_APP_CREDENTIALS_SECRET_ARN";        
        public static String ORDERS_TABLE_NAME_ENV_VARIABLE = "ORDERS_TABLE_NAME";
        public static String ORDER_ITEMS_TABLE_NAME_ENV_VARIABLE = "ORDER_ITEMS_TABLE_NAME";
        public static String SNS_TOPIC_ARN_ENV_VARIABLE = "NOTIFICATION_SNS_TOPIC_ARN";
        public static String LABELS_S3_BUCKET_NAME_ENV_VARIABLE = "LABELS_S3_BUCKET_NAME";

        //Generic Lambda Input Parameters
        public static String REGION_CODE_KEY_NAME = "regionCode";
        public static String ORDER_ACKNOWLEDGEMENT_CODE = "00";
        public static String ORDER_ACKNOWLEDGEMENT_DESCRIPTION = "Shipping 100 percent of ordered product";
        public static String SHIP_LABEL_API_RESTRICTED_RESOURCE_PATH = "/vendor/directFulfillment/shipping/2021-12-28/shippingLabels/{orderNumber}";
        public static String NEW_ORDER_STATUS = "NEW";
        public static String ASSIGNED_ORDER_STATUS = "ASSIGNED";
        public static String ACKNOWLEDGED_ORDER_STATUS = "ACKNOWLEDGED";
        public static String SHIPPED_ORDER_STATUS = "SHIPPED";
    }
}

