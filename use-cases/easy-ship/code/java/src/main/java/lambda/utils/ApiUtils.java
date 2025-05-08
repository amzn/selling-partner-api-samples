/*
 * Util class with generic Authorization and Authentication logic
 * Includes Catalog Items API client creation. Ref.: `getCatalogItemsApi(String regionCode, String refreshToken)`
 * Extend this class to generate API clients for other API sections as needed
 */

package lambda.utils;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import com.amazon.SellingPartnerAPIAA.LWAClientScopes;
import io.swagger.client.api.*;
import io.swagger.client.ApiClient;
import lambda.utils.interfaces.ApiCredentialsProvider;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;
import com.google.gson.Gson;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

import static lambda.utils.Constants.LWA_ENDPOINT;
import static lambda.utils.Constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.VALID_SP_API_REGION_CONFIG;
import static lambda.utils.Constants.LWA_NOTIFICATIONS_SCOPE;

public class ApiUtils {
    // Set OPT_OUT = True to disable User-Agent tracking
    public static final boolean OPT_OUT = false;

    /***
     * Common methods
     */

    private static LWAAuthorizationCredentials getLWAAuthorizationCredentials (AppCredentials appCredentials, String refreshToken) {
        return LWAAuthorizationCredentials.builder()
                .clientId(appCredentials.getClientId())
                .clientSecret(appCredentials.getClientSecret())
                .endpoint(LWA_ENDPOINT)
                .refreshToken(refreshToken)
                .build();
    }

    private static LWAAuthorizationCredentials getGrantlessLWAAuthorizationCredentials(AppCredentials appCredentials) {
        Set<String> scopesSet = new HashSet<>();
        scopesSet.add(LWA_NOTIFICATIONS_SCOPE);

        return LWAAuthorizationCredentials.builder()
                .clientId(appCredentials.getClientId())
                .clientSecret(appCredentials.getClientSecret())
                .endpoint(LWA_ENDPOINT)
                .scopes(new LWAClientScopes(scopesSet))
                .build();
    }

    //Get SP-API endpoint based on region code
    private static String getSpApiEndpoint(String regionCode) {
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

    //Set user-agent function
    private static void setUserAgent(ApiClient api) {
        if (!OPT_OUT) {
            System.out.println("Setting User-Agent");
            api.setUserAgent("Dummy Sample App/1.0/Java");
        }
    }

    private static LWAAuthorizationCredentials getLwaAuthorizationCredentials(String refreshToken) throws IOException {    Gson gson = new Gson();
        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        AppCredentials appCredentials = gson.fromJson(appCredentialsSecret, AppCredentials.class);
        return getLWAAuthorizationCredentials(appCredentials, refreshToken);
    }

    //Generate EasyShip API client
    public static EasyShipApi getEasyShipApi(ApiCredentialsProvider provider) throws Exception {
        ApiCredentials credentials = provider.getApiCredentials();

        EasyShipApi easyhipApi = new EasyShipApi.Builder()
                .lwaAuthorizationCredentials(getLwaAuthorizationCredentials(credentials.getRefreshToken()))
                .endpoint(getSpApiEndpoint(credentials.getRegionCode()))
                .build();

        setUserAgent(easyhipApi.getApiClient());
        return easyhipApi;
    }

    //Generate FeedsApi API client
    public static FeedsApi getFeedsApi(ApiCredentialsProvider provider) throws Exception {
        ApiCredentials credentials = provider.getApiCredentials();

        FeedsApi feedsApi = new FeedsApi.Builder()
                .lwaAuthorizationCredentials(getLwaAuthorizationCredentials(credentials.getRefreshToken()))
                .endpoint(getSpApiEndpoint(credentials.getRegionCode()))
                .build();

        setUserAgent(feedsApi.getApiClient());
        return feedsApi;
    }

    //Generate ReportsApi API client
    public static ReportsApi getReportsApi(ApiCredentialsProvider provider) throws Exception {
        ApiCredentials credentials = provider.getApiCredentials();

        ReportsApi reportsApi = new ReportsApi.Builder()
                .lwaAuthorizationCredentials(getLwaAuthorizationCredentials(credentials.getRefreshToken()))
                .endpoint(getSpApiEndpoint(credentials.getRegionCode()))
                .build();

        setUserAgent(reportsApi.getApiClient());
        return reportsApi;
    }

    //Generate OrdersV0 API client
    public static OrdersV0Api getOrdersV0Api(ApiCredentialsProvider provider) throws Exception {
        ApiCredentials credentials = provider.getApiCredentials();

        OrdersV0Api ordersV0Api = new OrdersV0Api.Builder()
                .lwaAuthorizationCredentials(getLwaAuthorizationCredentials(credentials.getRefreshToken()))
                .endpoint(getSpApiEndpoint(credentials.getRegionCode()))
                .build();

        setUserAgent(ordersV0Api.getApiClient());
        return ordersV0Api;
    }

    //Generate Notifications API client
    public static NotificationsApi getNotificationsApi(String regionCode, String refreshToken, boolean isGrantlessOperation)
            throws Exception{

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        Gson gson = new Gson();
        AppCredentials appCredentials = gson.fromJson(appCredentialsSecret, AppCredentials.class);


        LWAAuthorizationCredentials lwaAuthorizationCredentials;
        if (isGrantlessOperation) {
            lwaAuthorizationCredentials = getGrantlessLWAAuthorizationCredentials(appCredentials);
        } else {
            lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials, refreshToken);
        }

        String spApiEndpoint = getSpApiEndpoint(regionCode);

        NotificationsApi notificationsApi = new NotificationsApi.Builder()
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(spApiEndpoint)
                .build();
        setUserAgent(notificationsApi.getApiClient());

        return notificationsApi;
    }
}
