package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.ApiException;
import io.swagger.client.api.NotificationsApi;
import io.swagger.client.model.notifications.*;


import java.util.Map;
import java.util.UUID;

import static io.swagger.client.model.notifications.EventFilter.EventFilterTypeEnum.ORDER_CHANGE;
import static lambda.utils.ApiUtils.getNotificationsApi;
import static lambda.utils.Constants.NOTIFICATION_TYPE_KEY_NAME;
import static lambda.utils.Constants.REFRESH_TOKEN_KEY_NAME;
import static lambda.utils.Constants.REGION_CODE_KEY_NAME;
import static lambda.utils.Constants.SQS_QUEUE_ARN_ENV_VARIABLE;

public class SubscribeNotificationsHandler implements RequestHandler<Map<String, String>, String> {

    public String handleRequest(Map<String, String> event, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("SubscribeNotifications Lambda started");

        String regionCode = System.getenv(REGION_CODE_KEY_NAME);
        String refreshToken = System.getenv(REFRESH_TOKEN_KEY_NAME);
        String notificationType = event.get(NOTIFICATION_TYPE_KEY_NAME);

        String destinationId = "";
        try {
            destinationId = createDestination(regionCode);
            logger.log(String.format("Destination created - Destination Id: %s", destinationId));
        } catch (Exception e) {
            throw new InternalError("Create destination failed", e);
        }

        try {
            String subscriptionId = createSubscription(regionCode, refreshToken, notificationType, destinationId);
            logger.log(String.format("Subscription created - Subscription Id: %s", subscriptionId));

            return String.format("Destination Id: %s - Subscription Id: %s",
                    destinationId,
                    subscriptionId);
        } catch (Exception e) {
            throw new InternalError("Create subscription failed", e);
        }
    }

    private String createDestination(String regionCode) throws Exception {
        String sqsQueueArn = System.getenv(SQS_QUEUE_ARN_ENV_VARIABLE);

        SqsResource sqsResource = new SqsResource();
        sqsResource.setArn(sqsQueueArn);

        DestinationResourceSpecification resourceSpec = new DestinationResourceSpecification();
        resourceSpec.setSqs(sqsResource);

        CreateDestinationRequest request = new CreateDestinationRequest();
        request.setName(UUID.randomUUID().toString());
        request.setResourceSpecification(resourceSpec);

        // Initialize the Notifications API client using a grantless notifications scope
        NotificationsApi notificationsApi = getNotificationsApi(regionCode, null, true);

        String destinationId = "";
        try {
            CreateDestinationResponse createDestinationResponse = notificationsApi.createDestination(request);
            destinationId = createDestinationResponse.getPayload().getDestinationId();
        } catch (ApiException e) {
            //Destination already exists
            if (e.getCode() == 409) {
                GetDestinationsResponse getDestinationsResponse = notificationsApi.getDestinations();

                Destination sqsDestination = getDestinationsResponse.getPayload().stream()
                        .filter(destination -> destination.getResource().getSqs() != null)
                        .filter(destination -> sqsQueueArn.equals(destination.getResource().getSqs().getArn()))
                        .findFirst()
                        .get();

                destinationId = sqsDestination.getDestinationId();
            } else {
                throw e;
            }
        }

        return destinationId;
    }

    private String createSubscription(String regionCode, String refreshToken, String notificationType, String destinationId)
            throws Exception {

        CreateSubscriptionRequest request = new CreateSubscriptionRequest();
        ProcessingDirective processingDirective = new ProcessingDirective();
        EventFilter eventFilter = new EventFilter().eventFilterType(ORDER_CHANGE);
        processingDirective.setEventFilter(eventFilter);
        request.setDestinationId(destinationId);
        request.setPayloadVersion("1.0");
        request.setProcessingDirective(processingDirective);

        NotificationsApi notificationsApi = getNotificationsApi(regionCode, refreshToken, false);

        String subscriptionId = "";
        try {
            CreateSubscriptionResponse response = notificationsApi.createSubscription(request, notificationType);
            subscriptionId = response.getPayload().getSubscriptionId();
        } catch (ApiException e) {
            //Subscription already exists
            if (e.getCode() == 409) {
                GetSubscriptionResponse getSubscriptionResponse = notificationsApi.getSubscription(notificationType, null);
                subscriptionId = getSubscriptionResponse.getPayload().getSubscriptionId();
            } else {
                throw e;
            }
        }

        return subscriptionId;
    }
}
