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

    // Generate FBA Inbound V0 API client
    public static io.swagger.client.api.fbav0.FbaInboundApi getFbaInboundV0Api(String regionCode, String refreshToken)
            throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);
        LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials, refreshToken);

        String spApiEndpoint = getSpApiEndpoint(regionCode);

        io.swagger.client.api.fbav0.FbaInboundApi fbaInboundApiv0 = new io.swagger.client.api.fbav0.FbaInboundApi.Builder()
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(spApiEndpoint)
                .build();

        // Set User-Agent
        setUserAgent(fbaInboundApiv0.getApiClient());
        return fbaInboundApiv0;
    }

    // Generate FBA Inbound V2024 API client
    public static io.swagger.client.api.fbav2024.FbaInboundApi getFbaInboundV2024Api(String regionCode, String refreshToken)
            throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);
        LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials, refreshToken);

        String spApiEndpoint = getSpApiEndpoint(regionCode);

        io.swagger.client.api.fbav2024.FbaInboundApi fbaInboundApi = new io.swagger.client.api.fbav2024.FbaInboundApi.Builder()
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(spApiEndpoint)
                .build();

        // Set User-Agent
        setUserAgent(fbaInboundApi.getApiClient());
        return fbaInboundApi;
    }

    // Generic method to get FBA Inbound v2024 API instance
    public static io.swagger.client.api.fbav2024.FbaInboundApi getFbaInboundApiInstance(ApiCredentialsProvider provider) throws Exception {
        ApiCredentials credentials = provider.getApiCredentials();
        return getFbaInboundV2024Api(credentials.getRegionCode(), credentials.getRefreshToken());
    }

    // Generic method to get FBA Inbound v0 API instance
    public static io.swagger.client.api.fbav0.FbaInboundApi getFbaInboundV0Api(ApiCredentialsProvider provider) throws Exception {
        ApiCredentials credentials = provider.getApiCredentials();
        return getFbaInboundV0Api(credentials.getRegionCode(), credentials.getRefreshToken());
    }

    private static LWAAuthorizationCredentials getLWAAuthorizationCredentials(AppCredentials appCredentials, String refreshToken) {
        return LWAAuthorizationCredentials.builder()
                .clientId(appCredentials.getClientId())
                .clientSecret(appCredentials.getClientSecret())
                .endpoint(LWA_ENDPOINT)
                .refreshToken(refreshToken)
                .build();
    }

    // Get SP-API endpoint based on region code
    private static String getSpApiEndpoint(String regionCode) {
        if (!VALID_SP_API_REGION_CONFIG.containsKey(regionCode)) {
            String msg = String.format("Region Code %s is not valid. Value must be one of %s",
                    regionCode,
                    VALID_SP_API_REGION_CONFIG.keySet());

            throw new IllegalArgumentException(msg);
        }
        return VALID_SP_API_REGION_CONFIG.get(regionCode);
    }

    // Get secret from AWS Secrets Manager
    private static String getSecretString(String secretId) {
        SecretsManagerClient client = SecretsManagerClient.builder()
                .build();
        GetSecretValueRequest request = GetSecretValueRequest.builder()
                .secretId(secretId)
                .build();

        GetSecretValueResponse response = client.getSecretValue(request);
        return response.secretString();
    }

    //Set user agent
    private static void setUserAgent(ApiClient apiClient) {
        if (!OPT_OUT) {
            apiClient.setUserAgent("FBA SPD PCP Sample App/1.0/Java");
        }
    }
}