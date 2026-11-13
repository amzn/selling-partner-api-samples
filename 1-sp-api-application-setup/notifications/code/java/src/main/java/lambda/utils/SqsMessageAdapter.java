package lambda.utils;

import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import software.amazon.awssdk.services.sqs.model.Message;

import java.util.Map;


public class SqsMessageAdapter {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Converts an AWS SDK v2 {@link software.amazon.awssdk.services.sqs.model.Message}
     * into a Lambda-compatible {@link com.amazonaws.services.lambda.runtime.events.SQSEvent.SQSMessage}.
     * <p>
     * This utility method is useful when working with raw SQS messages retrieved using
     * AWS SDK v2 in contexts that expect Lambda event structures (e.g., when reprocessing DLQ messages).
     *
     * @param sdkMessage The raw SQS message from AWS SDK v2.
     * @return A Lambda-formatted {@link SQSEvent.SQSMessage} object with equivalent body, messageId, and receiptHandle.
     */
    public static SQSEvent.SQSMessage toLambdaSQSMessage(Message sdkMessage) {
        SQSEvent.SQSMessage lambdaMessage = new SQSEvent.SQSMessage();
        lambdaMessage.setBody(sdkMessage.body());
        lambdaMessage.setMessageId(sdkMessage.messageId());
        lambdaMessage.setReceiptHandle(sdkMessage.receiptHandle());
        return lambdaMessage;
    }

    /**
     * Attempts to extract the {@code "detail"} field from an EventBridge-formatted message body.
     * <p>
     * This method checks if the provided message body is a JSON object containing a top-level
     * {@code "detail"} key, which is typical in AWS EventBridge events. If found, it returns
     * the JSON string of the {@code "detail"} field. Otherwise, it returns the original body.
     * <p>
     * This is useful when handling messages from a unified source (e.g., SQS or Lambda) that may
     * contain either plain payloads or full EventBridge event envelopes.
     *
     * @param body   The raw JSON message body as a string.
     * @param logger The Lambda logger used for debugging and tracing.
     * @return The extracted {@code "detail"} JSON string if present, otherwise the original body string.
     */
    public static String extractDetailIfEventBridge(String body, LambdaLogger logger) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(body, Map.class);
            if (parsed.containsKey("detail")) {
                logger.log("Detected EventBridge format, extracting 'detail' field.");
                Object detail = parsed.get("detail");
                return objectMapper.writeValueAsString(detail);
            } else {
                logger.log("Not EventBridge format, sending body as-is.");
                return body;
            }
        } catch (Exception e) {
            logger.log("Failed to parse message as JSON, sending body as-is. Error: " + e.getMessage());
            return body;
        }
    }
}
