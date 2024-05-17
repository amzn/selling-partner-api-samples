/*
 * Util class with generic Authorization and Authentication logic
 * Includes Catalog Items API client creation. Ref.: `getCatalogItemsApi(String regionCode, String refreshToken)`
 * Extend this class to generate API clients for other API sections as needed
 */

package lambda.utils;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import com.amazon.SellingPartnerAPIAA.LWAClientScopes;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.client.api.ListingsApi;
import io.swagger.client.api.NotificationsApi;
import io.swagger.client.api.ProductPricingApi;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

import java.util.HashSet;
import java.util.Set;

import static lambda.utils.Constants.LWA_ENDPOINT;
import static lambda.utils.Constants.LWA_NOTIFICATIONS_SCOPE;
import static lambda.utils.Constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.VALID_SP_API_REGION_CONFIG;

public class ApiUtils {

    //Generate Product Pricing API client
    public static ProductPricingApi getProductPricingApi(String regionCode, String refreshToken)
            throws Exception{
        ObjectMapper mapper = new ObjectMapper();

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);
        LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials, refreshToken);

        String spApiEndpoint = getSpApiEndpoint(regionCode);

        ProductPricingApi productPricingApi = new ProductPricingApi.Builder()
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(spApiEndpoint)
                .build();
        productPricingApi.getApiClient().setUserAgent("Pricing Sample App/1.0/Java");

        return productPricingApi;
    }

    //Generate Listings Items API client
    public static ListingsApi getListingsApi(String regionCode, String refreshToken)
            throws Exception{
        ObjectMapper mapper = new ObjectMapper();

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);
        LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials, refreshToken);

        String spApiEndpoint = getSpApiEndpoint(regionCode);
        
        ListingsApi listingsApi = new ListingsApi.Builder()
            .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
            .endpoint(spApiEndpoint)
            .build();
        listingsApi.getApiClient().setUserAgent("Pricing Sample App/1.0/Java");

        return listingsApi;
    }

    //Generate Notifications API client
    public static NotificationsApi getNotificationsApi(String regionCode, String refreshToken, boolean isGrantlessOperation)
            throws Exception{
        ObjectMapper mapper = new ObjectMapper();

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);

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

        notificationsApi.getApiClient().setUserAgent("Pricing Sample App/1.0/Java");

        return notificationsApi;
    }

    private static LWAAuthorizationCredentials getLWAAuthorizationCredentials(AppCredentials appCredentials, String refreshToken) {
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
}
