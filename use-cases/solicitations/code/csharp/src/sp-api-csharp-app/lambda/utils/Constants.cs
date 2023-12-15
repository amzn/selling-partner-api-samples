using System;
using System.Collections;
using System.Collections.Generic;

namespace SpApiCsharpApp
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
        public static String LwaEndpoint = "https://api.amazon.com/auth/o2/token";
        public static String LwaNotificationsScope = "sellingpartnerapi::notifications";

        //Lambda Environment Variables
        public static String SpApiAppCredentialsSecretArnEnvVariable = "SP_API_APP_CREDENTIALS_SECRET_ARN";
        public static String RoleArnEnvVariable = "ROLE_ARN";
        public static String SqsQueueArnEnvVariable = "SQS_QUEUE_ARN";

        //Generic Lambda Input Parameters
        public static String RegionCodeKeyName = "RegionCode";
        public static String RefreshTokenKeyName = "REFRESH_TOKEN";
        public static Dictionary<String, String> MarketplaceIdToRegionCodeMapping = new Dictionary<string, string>() {
            { "A2EUQ1WTGCTBG2",NaRegionCode },
            { "ATVPDKIKX0DER", NaRegionCode },
            { "A1AM78C64UM0Y8", NaRegionCode },
            { "A2Q3Y263D00KWC", NaRegionCode },
            { "A1RKKUPIHCS9HS", EuRegionCode },
            { "A1F83G8C2ARO7P", EuRegionCode },
            { "A13V1IB3VIYZZH", EuRegionCode},
            { "AMEN7PMS3EDWL", EuRegionCode},
            { "A1805IZSGTT6HS", EuRegionCode},
            { "A1PA6795UKMFR9", EuRegionCode},
            { "APJ6JRA9NG5V4", EuRegionCode},
            { "A2NODRKZP88ZB9", EuRegionCode},
            { "AE08WJ6YKNBMC", EuRegionCode},
            { "A1C3SOZRARQ6R3", EuRegionCode},
            { "ARBP9OOSHTCHU", EuRegionCode},
            { "A33AVAJ2PDY3EV", EuRegionCode},
            { "A17E79C6D8DWNP", EuRegionCode},
            { "A2VIGQ35RCS4UG", EuRegionCode},
            { "A21TJRUUN4KGV", EuRegionCode},
            { "A19VAU5U5O7RUS", FeRegionCode},
            { "A39IBJ37TRP1C6", FeRegionCode},
            { "A1VC38T7YXB528", FeRegionCode}
        };

        //Solicitations API constants
        public static String ActionProductReviewSellerFeedback = "productReviewAndSellerFeedback";
        public static String SolicitationsSchedulerRoleArnEnvVariable = "SOLICITATIONS_SCHEDULER_ROLE_ARN";
        public static String SolicitationsStateMachineArnEnvVariable = "SOLICITATIONS_STATE_MACHINE_ARN";

        //Notifications API constants
        public static String NotificationTypeOrderChange = "ORDER_CHANGE";
        public static String OrderChangeNotificationStatusShipped = "Shipped";

    }
}

