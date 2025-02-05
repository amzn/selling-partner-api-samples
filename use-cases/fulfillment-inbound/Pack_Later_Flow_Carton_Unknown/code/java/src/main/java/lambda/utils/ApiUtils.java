 /*
  * Util class with generic Authorization and Authentication logic
  * Extend this class to generate API clients for other API sections as needed
  */

 package lambda.utils;

 import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
 import com.fasterxml.jackson.databind.ObjectMapper;
 import io.swagger.client.ApiClient;
 import lambda.utils.interfaces.ApiCredentialsProvider;
 import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
 import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
 import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

 import static lambda.utils.Constants.*;

 public class ApiUtils {

     // Set OPT_OUT = true to disable User-Agent tracking
     public static final boolean OPT_OUT = false;

     // Singleton instances
     private static io.swagger.client.api.fbav0.FbaInboundApi fbaInboundV0ApiInstance;
     private static io.swagger.client.api.fbav2024.FbaInboundApi fbaInboundv2024ApiInstance;

     // Track current credentials to ensure Singleton consistency
     private static String currentV0RegionCode;
     private static String currentV0RefreshToken;
     private static String currentV2024RegionCode;
     private static String currentV2024RefreshToken;

     // Generate FBA Inbound V0 API client
     public static synchronized io.swagger.client.api.fbav0.FbaInboundApi getFbaInboundV0Api(String regionCode, String refreshToken) throws Exception {
         if (fbaInboundV0ApiInstance == null || !regionCode.equals(currentV0RegionCode) || !refreshToken.equals(currentV0RefreshToken)) {
             currentV0RegionCode = regionCode;
             currentV0RefreshToken = refreshToken;
             fbaInboundV0ApiInstance = createFbaInboundV0Api(regionCode, refreshToken);

             if (fbaInboundV0ApiInstance == null) {
                 throw new IllegalStateException("Failed to create FBA Inbound V0 API client. Please check your credentials and region code.");
             }
         }
         return fbaInboundV0ApiInstance;
     }

     // Generate FBA Inbound V2024 API client
     public static synchronized io.swagger.client.api.fbav2024.FbaInboundApi getFbaInboundv2024Api(String regionCode, String refreshToken) throws Exception {
         if (fbaInboundv2024ApiInstance == null || !regionCode.equals(currentV2024RegionCode) || !refreshToken.equals(currentV2024RefreshToken)) {
             currentV2024RegionCode = regionCode;
             currentV2024RefreshToken = refreshToken;
             fbaInboundv2024ApiInstance = createFbaInboundv2024Api(regionCode, refreshToken);

             if (fbaInboundv2024ApiInstance == null) {
                 throw new IllegalStateException("Failed to create FBA Inbound V2024 API client. Please check your credentials and region code.");
             }
         }
         return fbaInboundv2024ApiInstance;
     }

     // Generic method to get FBA Inbound V2024 API instance
     public static io.swagger.client.api.fbav2024.FbaInboundApi getFbaInboundv2024Api(ApiCredentialsProvider provider) throws Exception {
         ApiCredentials credentials = provider.getApiCredentials();
         return getFbaInboundv2024Api(credentials.getRegionCode(), credentials.getRefreshToken());
     }

     // Generic method to get FBA Inbound V0 API instance
     public static io.swagger.client.api.fbav0.FbaInboundApi getFbaInboundV0Api(ApiCredentialsProvider provider) throws Exception {
         ApiCredentials credentials = provider.getApiCredentials();
         return getFbaInboundV0Api(credentials.getRegionCode(), credentials.getRefreshToken());
     }

     private static io.swagger.client.api.fbav0.FbaInboundApi createFbaInboundV0Api(String regionCode, String refreshToken) throws Exception {
         ObjectMapper mapper = new ObjectMapper();
         String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
         AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);
         LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials, refreshToken);
         String spApiEndpoint = getSpApiEndpoint(regionCode);

         io.swagger.client.api.fbav0.FbaInboundApi fbaInboundApiv0 = new io.swagger.client.api.fbav0.FbaInboundApi.Builder()
                 .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                 .endpoint(spApiEndpoint)
                 .build();

         setUserAgent(fbaInboundApiv0.getApiClient());
         return fbaInboundApiv0;
     }

     private static io.swagger.client.api.fbav2024.FbaInboundApi createFbaInboundv2024Api(String regionCode, String refreshToken) throws Exception {
         ObjectMapper mapper = new ObjectMapper();
         String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
         AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);
         LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials, refreshToken);
         String spApiEndpoint = getSpApiEndpoint(regionCode);

         io.swagger.client.api.fbav2024.FbaInboundApi fbaInboundApi = new io.swagger.client.api.fbav2024.FbaInboundApi.Builder()
                 .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                 .endpoint(spApiEndpoint)
                 .build();

         setUserAgent(fbaInboundApi.getApiClient());
         return fbaInboundApi;
     }

     private static LWAAuthorizationCredentials getLWAAuthorizationCredentials(AppCredentials appCredentials, String refreshToken) {
         return LWAAuthorizationCredentials.builder()
                 .clientId(appCredentials.getClientId())
                 .clientSecret(appCredentials.getClientSecret())
                 .endpoint(LWA_ENDPOINT)
                 .refreshToken(refreshToken)
                 .build();
     }

     private static String getSpApiEndpoint(String regionCode) {
         if (!VALID_SP_API_REGION_CONFIG.containsKey(regionCode)) {
             String msg = String.format("Region Code %s is not valid. Value must be one of %s", regionCode, VALID_SP_API_REGION_CONFIG.keySet());
             throw new IllegalArgumentException(msg);
         }
         return VALID_SP_API_REGION_CONFIG.get(regionCode);
     }

     private static String getSecretString(String secretId) {
         SecretsManagerClient client = SecretsManagerClient.builder().build();
         GetSecretValueRequest request = GetSecretValueRequest.builder().secretId(secretId).build();
         GetSecretValueResponse response = client.getSecretValue(request);
         return response.secretString();
     }

     private static void setUserAgent(ApiClient apiClient) {
         if (!OPT_OUT) {
             apiClient.setUserAgent("FBA SPD nPCP Sample App/1.0/Java");
         }
     }
 }