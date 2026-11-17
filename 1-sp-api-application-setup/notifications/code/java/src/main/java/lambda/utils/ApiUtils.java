package lambda.utils;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationSigner;
import com.amazon.SellingPartnerAPIAA.LWAClientScopes;
import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import lambda.common.AppCredentials;
import software.amazon.spapi.ApiClient;
import software.amazon.spapi.api.notifications.v1.NotificationsApi;

import java.util.Set;

import software.amazon.spapi.api.orders.v0.OrdersV0Api;

import static lambda.common.Constants.*;

public class ApiUtils {

    /**
     * Returns the SP-API (Selling Partner API) endpoint URL corresponding to the given region code.
     *
     * <p>This method looks up the endpoint from a predefined map of valid region codes.
     * If the provided region code is not supported, an {@link IllegalArgumentException} is thrown.</p>
     *
     * @param regionCode The region code for which the SP-API endpoint is requested (e.g., "NA", "EU", "FE")
     * @return The corresponding SP-API endpoint URL as a string
     * @throws IllegalArgumentException if the provided region code is not defined in {@code VALID_SP_API_REGION_CONFIG}
     */
    public static String getSpApiEndpoint(String regionCode) {
        if (!VALID_SP_API_REGION_CONFIG.containsKey(regionCode)) {
            throw new IllegalArgumentException(String.format(
                    "Region Code %s is invalid. Must be one of %s", regionCode, VALID_SP_API_REGION_CONFIG.keySet()));
        }
        return VALID_SP_API_REGION_CONFIG.get(regionCode);
    }


    /**
     * Builds and returns a configured {@link NotificationsApi} client instance for the Selling Partner API (SP-API).
     *
     * <p>This method supports both grantless (application-only) and authorized (seller-specific) flows.
     * Based on the {@code isGrantless} flag, it sets up the appropriate LWA (Login With Amazon) credentials:</p>
     *
     * <ul>
     *   <li>If {@code isGrantless} is {@code true}, the client is configured with application-level credentials and scope.</li>
     *   <li>If {@code isGrantless} is {@code false}, the client is configured with a refresh token for seller authorization.</li>
     * </ul>
     *
     * @param refreshToken The refresh token for seller authorization (used only if {@code isGrantless} is false)
     * @param regionCode The region code (e.g., "NA", "EU", "FE") used to determine the SP-API endpoint
     * @param credentials The application credentials (clientId and clientSecret) required for LWA
     * @param isGrantless Flag indicating whether to use grantless flow or seller-authorized flow
     * @return A configured instance of {@link NotificationsApi} for making SP-API notification calls
     * @throws IllegalArgumentException if the region code is invalid
     */
    public static NotificationsApi buildNotificationsApi(String refreshToken, String regionCode, AppCredentials credentials, boolean isGrantless) {
        String endpoint = getSpApiEndpoint(regionCode);

        LWAAuthorizationCredentials lwaCredentials = isGrantless ?
                LWAAuthorizationCredentials.builder()
                        .clientId(credentials.getClientId())
                        .clientSecret(credentials.getClientSecret())
                        .endpoint(LWA_ENDPOINT)
                        .scopes(new LWAClientScopes(Set.of(LWA_NOTIFICATIONS_SCOPE)))
                        .build()
                :
                LWAAuthorizationCredentials.builder()
                        .clientId(credentials.getClientId())
                        .clientSecret(credentials.getClientSecret())
                        .endpoint(LWA_ENDPOINT)
                        .refreshToken(refreshToken)
                        .build();

        ApiClient apiClient = new ApiClient();
        apiClient.setBasePath(endpoint);
        apiClient.setLWAAuthorizationSigner(new LWAAuthorizationSigner(lwaCredentials));
        apiClient.setUserAgent("Notifications Sample App/1.0/Java");

        return new NotificationsApi(apiClient);
    }

    /**
     * Creates and configures an instance of {@link OrdersV0Api} for accessing Amazon SP-API Orders V0 endpoints.
     *
     * <p>This method constructs the API client using the provided refresh token, region code, and
     * application credentials. It sets up LWA (Login With Amazon) authorization using the given credentials.</p>
     *
     * @param refreshToken The Selling Partner API refresh token associated with the seller account.
     * @param regionCode The SP-API region code (e.g., "NA", "EU", "FE") used to determine the API endpoint.
     * @param credentials The application credentials including Client ID and Client Secret.
     * @return A configured instance of {@link OrdersV0Api} ready to make API calls.
     * @throws Exception if the API client could not be built due to missing credentials or invalid input.
     */
    public static OrdersV0Api getOrdersV0Api(String refreshToken, String regionCode, AppCredentials credentials) throws Exception {
        String endpoint = getSpApiEndpoint(regionCode);

        LWAAuthorizationCredentials lwaCredentials =
                LWAAuthorizationCredentials.builder()
                .clientId(credentials.getClientId())
                .clientSecret(credentials.getClientSecret())
                .endpoint(LWA_ENDPOINT)
                .refreshToken(refreshToken)
                .build();

        ApiClient apiClient = new ApiClient();
        apiClient.setBasePath(endpoint);
        apiClient.setLWAAuthorizationSigner(new LWAAuthorizationSigner(lwaCredentials));
        apiClient.setUserAgent("Notifications Sample App/1.0/Java");

        return new OrdersV0Api(apiClient);
    }
}
