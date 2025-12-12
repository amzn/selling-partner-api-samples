package notifications;

import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.notifications.v1.NotificationsApi;
import software.amazon.spapi.models.notifications.v1.*;
import util.Recipe;
import util.Constants;

import com.amazon.SellingPartnerAPIAA.LWAException;

/**
 * Code Recipe to create a notification destination
 * Steps:
 * 1. Create destination for SQS queue or EventBridge
 * 2. Handle destination already exists (409 conflict)
 */
public class CreateDestinationRecipe extends Recipe {

    private static final String SQS_QUEUE_ARN = "arn:aws:sqs:us-east-1:123456789012:sqs_queue_example"; // Set to SQS ARN or null
    private static final String EVENTBRIDGE_NAME = "example_event_bridge"; // Set to EventBridge name or null
    private static final String EVENTBRIDGE_REGION = "us-east-1";
    private static final String EVENTBRIDGE_ACCOUNT_ID = "123456789012";
    
    private NotificationsApi notificationsApi;

    @Override
    protected void start() {
        initializeNotificationsApi();
        String destinationId = createDestination();
        System.out.println("✅ Destination Id: " + destinationId);
    }

    private void initializeNotificationsApi() {
        notificationsApi = new NotificationsApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        System.out.println("Notifications API client initialized");
    }

    private String createDestination() {
        if (SQS_QUEUE_ARN == null && EVENTBRIDGE_NAME == null) {
            throw new RuntimeException("Either SQS_QUEUE_ARN or EVENTBRIDGE_NAME must be set");
        }
        
        DestinationResourceSpecification resourceSpec = new DestinationResourceSpecification();
        
        if (SQS_QUEUE_ARN != null) {
            SqsResource sqsResource = new SqsResource();
            sqsResource.setArn(SQS_QUEUE_ARN);
            resourceSpec.setSqs(sqsResource);
        }
        
        if (EVENTBRIDGE_NAME != null) {
            EventBridgeResourceSpecification eventBridge = new EventBridgeResourceSpecification();
            eventBridge.setRegion(EVENTBRIDGE_REGION);
            eventBridge.setAccountId(EVENTBRIDGE_ACCOUNT_ID);
            resourceSpec.setEventBridge(eventBridge);
        }
        
        CreateDestinationRequest request = new CreateDestinationRequest();
        request.setName("sp-api-destination");
        request.setResourceSpecification(resourceSpec);

        try {
            CreateDestinationResponse response = notificationsApi.createDestination(request);
            String destId = response.getPayload().getDestinationId();
            System.out.println("✅ Destination created - Destination Id: " + destId);
            return destId;
        } catch (ApiException e) {
            if (e.getCode() == 409) {
                System.out.println("⚠️ Destination already exists, retrieving existing destination");
                return getExistingDestination();
            }
            throw new RuntimeException("Failed to create destination", e);
        } catch (LWAException e) {
            throw new RuntimeException("Failed to create destination", e);
        }
    }

    private String getExistingDestination() {
        try {
            GetDestinationsResponse response = notificationsApi.getDestinations();
            for (Destination destination : response.getPayload()) {
                boolean sqsMatches = SQS_QUEUE_ARN == null || 
                    (destination.getResource().getSqs() != null && 
                     SQS_QUEUE_ARN.equals(destination.getResource().getSqs().getArn()));
                
                boolean eventBridgeMatches = EVENTBRIDGE_NAME == null || 
                    (destination.getResource().getEventBridge() != null &&
                     EVENTBRIDGE_ACCOUNT_ID.equals(destination.getResource().getEventBridge().getAccountId()));
                
                if (sqsMatches && eventBridgeMatches) {
                    String destId = destination.getDestinationId();
                    System.out.println("✅ Found existing destination - Destination Id: " + destId);
                    return destId;
                }
            }
            throw new RuntimeException("Destination not found");
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to get destinations", e);
        }
    }
}
