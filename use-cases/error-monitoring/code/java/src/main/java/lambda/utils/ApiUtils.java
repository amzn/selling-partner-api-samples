/*
 * Util class with generic Authorization and Authentication logic
 * Includes Catalog Items API client creation. Ref.: `getCatalogItemsApi(String regionCode, String refreshToken)`
 * Extend this class to generate API clients for other API sections as needed
 */

package lambda.utils;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.client.api.CatalogApi;
import io.swagger.client.api.SellersApi;
import io.swagger.client.api.ListingsApi;
import io.swagger.client.api.ReportsApi;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

import static lambda.utils.Constants.LWA_ENDPOINT;
import static lambda.utils.Constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.VALID_SP_API_REGION_CONFIG;

public class ApiUtils {

    //Generate Catalog Items API client
    public static CatalogApi catalogItemsApi (String regionCode, String refreshToken)
            throws Exception{
        ObjectMapper mapper = new ObjectMapper();

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
       AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);
        LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials,refreshToken);

        String spApiEndpoint = getSpApiEndpoint(regionCode);

        return new CatalogApi.Builder()
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(spApiEndpoint)
                .build();
    }

    //Generate Sellers API client
    public static SellersApi sellersApi (String regionCode, String refreshToken)
            throws Exception{
        ObjectMapper mapper = new ObjectMapper();

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);
        LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials,refreshToken);

        String spApiEndpoint = getSpApiEndpoint(regionCode);

        return new SellersApi.Builder()
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(spApiEndpoint)
                .build();
    }

    //Generate Listing API client
    public static ListingsApi listingsApi (String regionCode, String refreshToken)
            throws Exception{
        ObjectMapper mapper = new ObjectMapper();

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);
        LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials,refreshToken);

        String spApiEndpoint = getSpApiEndpoint(regionCode);

        return new ListingsApi.Builder()
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(spApiEndpoint)
                .build();
    }

    //Generate Reports API client
    public static ReportsApi reportsApi (String regionCode, String refreshToken)
            throws Exception{
        ObjectMapper mapper = new ObjectMapper();

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);
        LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials,refreshToken);

        String spApiEndpoint = getSpApiEndpoint(regionCode);

        return new ReportsApi.Builder()
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(spApiEndpoint)
                .build();
    }

    // Get LWA Auth Credentials
    private static LWAAuthorizationCredentials getLWAAuthorizationCredentials (AppCredentials appCredentials, String refreshToken) {
        return LWAAuthorizationCredentials.builder()
                .clientId(appCredentials.getClientId())
                .clientSecret(appCredentials.getClientSecret())
                .endpoint(LWA_ENDPOINT)
                .refreshToken(refreshToken)
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
