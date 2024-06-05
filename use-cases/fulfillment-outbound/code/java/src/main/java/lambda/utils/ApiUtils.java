package lambda.utils;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import com.amazon.SellingPartnerAPIAA.LWAClientScopes;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.client.api.FbaOutboundApi;
import io.swagger.client.api.NotificationsApi;
import io.swagger.client.ApiClient;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;
import com.amazonaws.services.lambda.runtime.LambdaLogger;

import static lambda.utils.Constants.LWA_ENDPOINT;
import static lambda.utils.Constants.LWA_NOTIFICATIONS_SCOPE;
import static lambda.utils.Constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.VALID_SP_API_REGION_CONFIG;
import com.amazonaws.services.lambda.runtime.Context;

import java.util.Set;
import java.util.HashSet;

public class ApiUtils {
    // Set OPT_OUT = true to disable User-Agent tracking
    public static final boolean OPT_OUT = false;

    //Generate FBA Outbound API client
    public static FbaOutboundApi getFbaOutboundApi (String regionCode, String refreshToken, Context context)
            throws Exception{

        RegionConfig regionConfig = getRegionConfig(regionCode);
        ObjectMapper mapper = new ObjectMapper();

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);
        LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials, refreshToken);

        FbaOutboundApi fbaOutboundApi = new FbaOutboundApi.Builder()
            .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
            .endpoint(regionConfig.getSpApiEndpoint())
            .build();
        setUserAgent(fbaOutboundApi.getApiClient());

        return fbaOutboundApi;
    }

    //Generate Notifications API client
    public static NotificationsApi getNotificationsApi (String regionCode, String refreshToken, boolean isGrantlessOperation)
            throws Exception{

        RegionConfig regionConfig = getRegionConfig(regionCode);
        ObjectMapper mapper = new ObjectMapper();

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);

        LWAAuthorizationCredentials lwaAuthorizationCredentials;
        if (isGrantlessOperation) {
            lwaAuthorizationCredentials = getGrantlessLWAAuthorizationCredentials(appCredentials);
        } else {
            lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials, refreshToken);
        }

        NotificationsApi notificationsApi = new NotificationsApi.Builder()
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(spApiEndpoint)
                .build();
        setUserAgent(notificationsApi.getApiClient());

        return notificationsApi;
    }

    private static LWAAuthorizationCredentials getLWAAuthorizationCredentials (AppCredentials appCredentials, String refreshToken) {
        return LWAAuthorizationCredentials.builder()
                .clientId(appCredentials.getClientId())
                .clientSecret(appCredentials.getClientSecret())
                .endpoint(LWA_ENDPOINT)
                .refreshToken(refreshToken)
                .build();
    }

    private static LWAAuthorizationCredentials getGrantlessLWAAuthorizationCredentials (AppCredentials appCredentials) {
        Set<String> scopesSet = new HashSet<>();
        scopesSet.add(LWA_NOTIFICATIONS_SCOPE);

        return LWAAuthorizationCredentials.builder()
                .clientId(appCredentials.getClientId())
                .clientSecret(appCredentials.getClientSecret())
                .endpoint(LWA_ENDPOINT)
                .scopes(new LWAClientScopes(scopesSet))
                .build();
    }


    //Get regional configuration (AWS region and SP-API endpoint) based on region code
    private static RegionConfig getRegionConfig(String regionCode) {
        if (!VALID_SP_API_REGION_CONFIG.containsKey(regionCode)) {
            String msg = String.format("Region Code %s is not valid. Value must be one of %s",
                    regionCode,
                    VALID_SP_API_REGION_CONFIG.keySet());

            throw new IllegalArgumentException(msg);
        }

        return VALID_SP_API_REGION_CONFIG.get(regionCode);
    }

    //Get secret from AWS Secrets Manager
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
    private static void setUserAgent(ApiClient api) {
        if (!OPT_OUT) {
            System.out.println("Setting User-Agent");
            api.setUserAgent("Fulfillment Outbound Sample App/1.0/Java");
        }
    }
}
