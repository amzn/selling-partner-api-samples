package lambda.utils;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import com.amazon.SellingPartnerAPIAA.LWAClientScopes;
import io.swagger.client.ApiClient;
import io.swagger.client.api.ApplicationsApi;
import io.swagger.client.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

import java.io.IOException;
import java.util.HashSet;
import java.util.Set;
import com.fasterxml.jackson.databind.ObjectMapper;

import static lambda.utils.Constants.LWA_ENDPOINT;
import static lambda.utils.Constants.LWA_NOTIFICATIONS_SCOPE;
import static lambda.utils.Constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.VALID_SP_API_REGION_CONFIG;

public class ApiUtils {
    private static final Logger logger = LoggerFactory.getLogger(ApiUtils.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    public static ApplicationsApi getApplicationsApi(String regionCode, boolean isGrantlessOperation) throws ApiException, IOException {
        AppCredentials appCredentials = getApplicationCredentials();

        logger.info("Constructing LWA authorization credentials...");
        LWAAuthorizationCredentials lwaAuthorizationCredentials = isGrantlessOperation
                ? getGrantlessLWAAuthorizationCredentials(appCredentials)
                : null;

        logger.info("Retrieving SP-API endpoint for region code: {}", regionCode);
        String spApiEndpoint = getSpApiEndpoint(regionCode);

        logger.info("Building ApplicationsApi instance...");
        ApplicationsApi applicationsApi = new ApplicationsApi.Builder()
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(spApiEndpoint)
                .build();

        applicationsApi.getApiClient().setUserAgent("LWA Secret Rotation Sample App/1.0/Java");

        return applicationsApi;
    }

    public static AppCredentials getApplicationCredentials() {
        logger.info("Retrieving application credentials from Secrets Manager...");
        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        try {
            return objectMapper.readValue(appCredentialsSecret, AppCredentials.class);
        } catch (IOException e) {
            logger.error("Error reading application credentials from Secrets Manager", e);
            throw new RuntimeException("Error reading application credentials from Secrets Manager", e);
        }
    }

    private static LWAAuthorizationCredentials getGrantlessLWAAuthorizationCredentials(AppCredentials appCredentials) {
        logger.info("Constructing grantless LWA authorization credentials...");
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
            logger.error(msg);
            throw new IllegalArgumentException(msg);
        }

        return VALID_SP_API_REGION_CONFIG.get(regionCode);
    }

    //Get secret from AWS Secrets Manager
    private static String getSecretString(String secretId) {
        try {
            logger.info("Retrieving secret from Secrets Manager...");
            SecretsManagerClient client = SecretsManagerClient.builder()
                    .build();
            GetSecretValueRequest request = GetSecretValueRequest.builder()
                    .secretId(secretId)
                    .build();

            GetSecretValueResponse response = client.getSecretValue(request);
            return response.secretString();
        } catch (Exception e) {
            logger.error("Error retrieving secret from Secrets Manager", e);
            throw new RuntimeException("Error retrieving secret from Secrets Manager", e);
        }
    }
}