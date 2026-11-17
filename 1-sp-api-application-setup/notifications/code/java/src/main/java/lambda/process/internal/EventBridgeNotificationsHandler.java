package lambda.process.internal;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;


public class EventBridgeNotificationsHandler implements RequestHandler<Map<String, Object>, String> {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public String handleRequest(Map<String, Object> input, Context context) {
        LambdaLogger logger = context.getLogger();
        try {
            logger.log("ProcessNotification Input payload: " + objectMapper.writeValueAsString(input) + "\n");
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize input payload.", e);
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> detail = (Map<String, Object>) input.get("detail");
        if (detail != null) {
            String payloadJson = null;
            try {
                payloadJson = objectMapper.writeValueAsString(detail);
            } catch (JsonProcessingException e) {
                throw new RuntimeException("Processing failed for EventBridge event: " + input.toString(), e);
            }
            logger.log("Received notification: " + payloadJson);
        } else {
            logger.log("No 'detail' field found in the event.");
            throw new RuntimeException("Event missing 'detail' field.");
        }
        return "Finished processing incoming notifications";
    }
}