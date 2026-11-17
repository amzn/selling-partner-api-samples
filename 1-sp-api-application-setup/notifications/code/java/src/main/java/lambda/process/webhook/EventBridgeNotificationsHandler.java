package lambda.process.webhook;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lambda.utils.WebHookUtils;

import java.util.Map;



/**
 * Handler for forwarding SP-API notifications received via Amazon EventBridge to a Webhook endpoint.
 * This sample class demonstrates how to process EventBridge events in AWS Lambda and forward
 * the event's "detail" field as the notification payload.
 * Behavior:
 * - Parses the incoming EventBridge event (as a Map)
 * - Extracts the "detail" field from the event
 * - Serializes the detail into JSON and sends it to the WebHook URL defined by the WEB_HOOK_URL environment variable
 * - Optionally includes authorization headers if defined
 * Required environment variables:
 * - WEB_HOOK_URL: Target webhook URL
 * - WEB_HOOK_AUTH_TOKEN (optional): Token for authentication
 * - WEB_HOOK_AUTH_HEADER_NAME (optional): Header name for token (e.g., "Authorization")
 * This class is intended as a reusable sample for EventBridge-based notification processing.
 */
public class EventBridgeNotificationsHandler implements RequestHandler<Map<String, Object>, String> {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public String handleRequest(Map<String, Object> input, Context context) {
        LambdaLogger logger = context.getLogger();
        try {
            logger.log("ProcessNotification Input payload: " + objectMapper.writeValueAsString(input) + "\n");
        } catch (JsonProcessingException e) {
            logger.log("Failed to serialize input: " + e.getMessage());
            throw new RuntimeException("Failed to serialize input payload.", e);
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> detail = (Map<String, Object>) input.get("detail");
            if (detail != null) {
                String payloadJson = objectMapper.writeValueAsString(detail);
                logger.log("Sending notification: " + payloadJson);

                WebHookUtils.sendWebhookRequest(payloadJson);

                logger.log("Webhook sent successfully.");
            } else {
                logger.log("No 'detail' field found in the event.");
                throw new RuntimeException("Event missing 'detail' field.");
            }
        } catch (Exception e) {
            logger.log("Failed to send webhook: " + e.getMessage());
            throw new RuntimeException("Processing failed for EventBridge event.", e);
        }
        return "Finished processing incoming notifications";
    }
}