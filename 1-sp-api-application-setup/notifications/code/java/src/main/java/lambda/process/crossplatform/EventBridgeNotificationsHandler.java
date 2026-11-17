package lambda.process.crossplatform;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lambda.common.NotificationDestinationType;
import lambda.utils.CrossPlatformUtils;

import java.util.Map;

import static lambda.common.Constants.*;


/**
 * Sample Lambda handler for forwarding SP-API notifications received via EventBridge
 * to a cross-platform destination such as AWS EventBridge, SQS, or GCP Pub/Sub.
 * This class demonstrates:
 * - Handling AWS EventBridge events in Lambda (as Map<String, Object>)
 * - Extracting the "detail" field from the EventBridge event
 * - Serializing and forwarding the extracted payload to a destination defined by environment variable
 * Behavior:
 * - Reads the CROSS_PLATFORM_DESTINATION_TYPE environment variable to determine the destination
 * - Extracts the "detail" section of the EventBridge event
 * - Sends the serialized detail payload to the specified target via CrossPlatformUtils
 * Required environment variable:
 * - CROSS_PLATFORM_DESTINATION_TYPE: The destination type ("AWS_SQS", "AWS_EVENTBRIDGE", "GCP_PUBSUB", etc.)
 * Intended as a reusable and extensible sample for event forwarding pipelines using EventBridge as the trigger.
 */
public class EventBridgeNotificationsHandler implements RequestHandler<Map<String, Object>, String> {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public String handleRequest(Map<String, Object> input, Context context) {
        LambdaLogger logger = context.getLogger();

        String destinationEnv = System.getenv(CROSS_PLATFORM_DESTINATION_TYPE_ENV_VARIABLE);

        try {
            logger.log("ProcessNotification Input payload: " + objectMapper.writeValueAsString(input) + "\n");
        } catch (JsonProcessingException e) {
            logger.log("Failed to serialize input: " + e.getMessage());
            throw new RuntimeException("Failed to serialize input payload.", e);
        }

        NotificationDestinationType destinationType;
        try {
            destinationType = NotificationDestinationType.fromString(destinationEnv);
        } catch (IllegalArgumentException e) {
            logger.log("Invalid DESTINATION_TYPE: " + destinationEnv);
            throw new RuntimeException("Invalid CROSS_PLATFORM_DESTINATION_TYPE environment variable: " + destinationEnv, e);
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> detail = (Map<String, Object>) input.get("detail");

            if (detail != null) {
                String payloadJson = objectMapper.writeValueAsString(detail);
                logger.log("Sending notification: " + payloadJson);

                CrossPlatformUtils.publishCrossPlatform(logger, destinationType, payloadJson);
            } else {
                logger.log("No 'detail' field found in the event.");
                throw new RuntimeException("Event missing 'detail' field.");
            }
        } catch (Exception e) {
            logger.log("Failed to forward notification: " + e.getMessage());
            throw new RuntimeException("Processing failed during forwarding.", e);
        }

        return "Finished processing incoming notifications";
    }
}
