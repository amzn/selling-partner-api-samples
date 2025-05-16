package lambda.utils;


import com.amazonaws.services.lambda.runtime.LambdaLogger;
import software.amazon.awssdk.services.eventbridge.EventBridgeClient;
import software.amazon.awssdk.services.eventbridge.model.PutEventsRequest;
import software.amazon.awssdk.services.eventbridge.model.PutEventsRequestEntry;
import software.amazon.awssdk.services.eventbridge.model.PutEventsResponse;
import software.amazon.awssdk.services.eventbridge.model.PutEventsResultEntry;
import com.amazonaws.services.sqs.AmazonSQS;
import com.amazonaws.services.sqs.AmazonSQSClientBuilder;
import com.amazonaws.services.sqs.model.SendMessageRequest;

import static lambda.common.Constants.*;

public class AwsPublisherUtils {

    /**
     * Sends the given message body to an Amazon SQS queue defined by environment variable.
     * <p>
     * This method retrieves the SQS queue URL from the environment variable {@code TARGET_SQS_URL},
     * constructs a {@link SendMessageRequest} using the provided message body, and sends it using
     * the default {@link AmazonSQS} client.
     * <p>
     * Environment Variables:
     * - {@code TARGET_SQS_URL}: The full URL of the SQS queue to which the message will be sent.
     *
     * @param messageBody The message payload to be sent to the SQS queue (as plain text or JSON string)
     * @param logger The Lambda logger for logging messages and errors
     * @throws RuntimeException If the {@code TARGET_SQS_URL} environment variable is not set or message sending fails
     */
    public static void sendToSQS(String messageBody, LambdaLogger logger) {
        String queueUrl = System.getenv(TARGET_SQS_URL_ENV_VARIABLE);
        AmazonSQS sqs = AmazonSQSClientBuilder.defaultClient();
        sqs.sendMessage(new SendMessageRequest(queueUrl, messageBody));
        logger.log("Event message was successfully sent.");
    }

    /**
     * Sends a SP-API notification payload to an Amazon EventBridge event bus.
     * The method constructs an EventBridge event with a dynamically set {@code detailType}
     * based on the {@code NOTIFICATION_TYPE} environment variable. This allows downstream
     * services to filter events by notification type (e.g., "SP-API::ORDER_CHANGE").
     * Behavior:
     * - Retrieves the EventBridge event bus name from the {@code TARGET_EVENT_BUS_ARN} environment variable.
     * - Retrieves the notification type from the {@code NOTIFICATION_TYPE} environment variable.
     * - Sends the message payload as the {@code detail} field in the event.
     * - Logs the result or any errors encountered during publishing.
     * Required environment variables:
     * - {@code TARGET_EVENT_BUS_ARN}: The ARN or name of the EventBridge bus to which the event will be sent.
     * - {@code NOTIFICATION_TYPE}: The SP-API notification type used to construct the {@code detailType} field.
     * Example detailType: {@code SP-API::ORDER_CHANGE}
     *
     * @param messageBody The JSON string payload to send as the {@code detail} of the EventBridge event.
     * @param logger The Lambda logger for logging messages and errors
     */
    public static void sendToEventBridge(String messageBody, LambdaLogger logger) {
        String eventBusName = System.getenv(TARGET_EVENT_BUS_ARN_ENV_VARIABLE);
        String notificationType = System.getenv(NOTIFICATION_TYPE_ENV_VARIABLE);
        try (EventBridgeClient eventBridge = EventBridgeClient.create()) {

            PutEventsRequestEntry entry = PutEventsRequestEntry.builder()
                    .detailType("SP-API::" + notificationType)
                    .detail(messageBody)
                    .eventBusName(eventBusName)
                    .source("custom.spapi.notifications")
                    .build();

            PutEventsRequest request = PutEventsRequest.builder()
                    .entries(entry)
                    .build();

            PutEventsResponse response = eventBridge.putEvents(request);

            for (PutEventsResultEntry resultEntry : response.entries()) {
                if (resultEntry.eventId() != null) {
                    logger.log("Event sent with ID: " + resultEntry.eventId());
                } else {
                    logger.log("Failed to send event: " + resultEntry.errorMessage());
                }
            }

        } catch (Exception e) {
            logger.log("Error sending to EventBridge: " + e.getMessage());
        }
    }
}
