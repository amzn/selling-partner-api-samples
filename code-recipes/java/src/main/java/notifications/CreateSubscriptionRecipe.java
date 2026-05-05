package notifications;

import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.notifications.v1.NotificationsApi;
import software.amazon.spapi.models.notifications.v1.*;
import util.Recipe;
import util.Constants;

import com.amazon.SellingPartnerAPIAA.LWAException;

/**
 * Code Recipe to create a notification subscription
 * Steps:
 * 1. Create subscription for notification type
 * 2. Handle subscription already exists (409 conflict)
 */
public class CreateSubscriptionRecipe extends Recipe {

    private static final String NOTIFICATION_TYPE = "ORDER_CHANGE";
    private static final String DESTINATION_ID = "dest-12345-abcde-67890";
    
    private NotificationsApi notificationsApi;

    @Override
    protected void start() {
        initializeNotificationsApi();
        String subscriptionId = createSubscription();
        System.out.println("✅ Subscription Id: " + subscriptionId);
    }

    private void initializeNotificationsApi() {
        notificationsApi = new NotificationsApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        System.out.println("Notifications API client initialized");
    }

    private String createSubscription() {
        CreateSubscriptionRequest request = new CreateSubscriptionRequest();
        request.setPayloadVersion("1.0");
        request.setDestinationId(DESTINATION_ID);

        try {
            CreateSubscriptionResponse response = notificationsApi.createSubscription(request, NOTIFICATION_TYPE);
            String subId = response.getPayload().getSubscriptionId();
            System.out.println("✅ Subscription created - Subscription Id: " + subId);
            return subId;
        } catch (ApiException e) {
            if (e.getCode() == 409) {
                System.out.println("⚠️ Subscription already exists, retrieving existing subscription");
                return getExistingSubscription();
            }
            throw new RuntimeException("Failed to create subscription", e);
        } catch (LWAException e) {
            throw new RuntimeException("Failed to create subscription", e);
        }
    }

    private String getExistingSubscription() {
        try {
            GetSubscriptionResponse response = notificationsApi.getSubscription(NOTIFICATION_TYPE, null);
            String subId = response.getPayload().getSubscriptionId();
            System.out.println("✅ Found existing subscription - Subscription Id: " + subId);
            return subId;
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to get subscription", e);
        }
    }
}
