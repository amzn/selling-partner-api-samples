package lambda.utils;

import com.amazon.SellingPartnerAPIAA.AWSAuthenticationCredentials;
import com.amazon.SellingPartnerAPIAA.AWSAuthenticationCredentialsProvider;
import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import com.amazon.SellingPartnerAPIAA.LWAClientScopes;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.client.api.MerchantFulfillmentApi;
import io.swagger.client.api.NotificationsApi;
import io.swagger.client.api.OrdersV0Api;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

import java.util.HashSet;
import java.util.Set;

import static lambda.utils.Constants.IAM_USER_CREDENTIALS_SECRET_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.LWA_ENDPOINT;
import static lambda.utils.Constants.LWA_NOTIFICATIONS_SCOPE;
import static lambda.utils.Constants.ROLE_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.VALID_SP_API_REGION_CONFIG;

public class ApiUtils {

    //Generate MFN API client
    public static MerchantFulfillmentApi getMFNApi (String regionCode, String refreshToken)
            throws Exception{
        RegionConfig regionConfig = getRegionConfig(regionCode);

        ObjectMapper mapper = new ObjectMapper();

        String iamUserCredentialsSecret = getSecretString(System.getenv(IAM_USER_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        IAMUserCredentials iamUserCredentials = mapper.readValue(iamUserCredentialsSecret, IAMUserCredentials.class);
        AWSAuthenticationCredentials awsAuthenticationCredentials = getAWSAuthenticationCredentials(regionConfig, iamUserCredentials);

        AWSAuthenticationCredentialsProvider awsAuthenticationCredentialsProvider = getAWSAuthenticationCredentialsProvider();

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);
        LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials, refreshToken);

        return new MerchantFulfillmentApi.Builder()
                .awsAuthenticationCredentials(awsAuthenticationCredentials)
                .awsAuthenticationCredentialsProvider(awsAuthenticationCredentialsProvider)
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(regionConfig.getSpApiEndpoint())
                .build();
    }

    //Generate Orders API client
    public static OrdersV0Api getOrdersApi (String regionCode, String refreshToken)
            throws Exception{
        RegionConfig regionConfig = getRegionConfig(regionCode);

        ObjectMapper mapper = new ObjectMapper();

        String iamUserCredentialsSecret = getSecretString(System.getenv(IAM_USER_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        IAMUserCredentials iamUserCredentials = mapper.readValue(iamUserCredentialsSecret, IAMUserCredentials.class);
        AWSAuthenticationCredentials awsAuthenticationCredentials = getAWSAuthenticationCredentials(regionConfig, iamUserCredentials);

        AWSAuthenticationCredentialsProvider awsAuthenticationCredentialsProvider = getAWSAuthenticationCredentialsProvider();

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);
        LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials, refreshToken);

        return new OrdersV0Api.Builder()
                .awsAuthenticationCredentials(awsAuthenticationCredentials)
                .awsAuthenticationCredentialsProvider(awsAuthenticationCredentialsProvider)
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(regionConfig.getSpApiEndpoint())
                .build();
    }

    //Generate Notifications API client
    public static NotificationsApi getNotificationsApi (String regionCode, String refreshToken, boolean isGrantlessOperation)
            throws Exception{
        RegionConfig regionConfig = getRegionConfig(regionCode);

        ObjectMapper mapper = new ObjectMapper();

        String iamUserCredentialsSecret = getSecretString(System.getenv(IAM_USER_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        IAMUserCredentials iamUserCredentials = mapper.readValue(iamUserCredentialsSecret, IAMUserCredentials.class);
        AWSAuthenticationCredentials awsAuthenticationCredentials = getAWSAuthenticationCredentials(regionConfig, iamUserCredentials);

        AWSAuthenticationCredentialsProvider awsAuthenticationCredentialsProvider = getAWSAuthenticationCredentialsProvider();

        String appCredentialsSecret = getSecretString(System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        AppCredentials appCredentials = mapper.readValue(appCredentialsSecret, AppCredentials.class);

        LWAAuthorizationCredentials lwaAuthorizationCredentials;
        if (isGrantlessOperation) {
            lwaAuthorizationCredentials = getGrantlessLWAAuthorizationCredentials(appCredentials);
        } else {
            lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials, refreshToken);
        }

        return new NotificationsApi.Builder()
                .awsAuthenticationCredentials(awsAuthenticationCredentials)
                .awsAuthenticationCredentialsProvider(awsAuthenticationCredentialsProvider)
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(regionConfig.getSpApiEndpoint())
                .build();
    }

    private static AWSAuthenticationCredentials getAWSAuthenticationCredentials(RegionConfig regionConfig, IAMUserCredentials iamUserCredentials) {
        return AWSAuthenticationCredentials.builder()
                .region(regionConfig.getAwsRegion())
                .accessKeyId(iamUserCredentials.getAccessKeyId())
                .secretKey(iamUserCredentials.getSecretKey())
                .build();
    }

    private static AWSAuthenticationCredentialsProvider getAWSAuthenticationCredentialsProvider () {
        return AWSAuthenticationCredentialsProvider.builder()
                .roleArn(System.getenv(ROLE_ARN_ENV_VARIABLE))
                .roleSessionName("sp-api-java-app")
                .build();
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
}
