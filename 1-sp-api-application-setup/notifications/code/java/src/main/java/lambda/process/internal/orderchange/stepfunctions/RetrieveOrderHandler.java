package lambda.process.internal.orderchange.stepfunctions;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import lambda.common.ClientCredentials;
import lambda.utils.OrderProcessUtils;
import software.amazon.spapi.models.orders.v0.GetOrderItemsResponse;
import software.amazon.spapi.models.orders.v0.GetOrderResponse;
import software.amazon.spapi.models.orders.v0.OrderItem;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

import static lambda.common.Constants.*;
import static lambda.utils.DBUtils.getClientCredentialsFromDynamoDB;

public class RetrieveOrderHandler implements RequestHandler<Map<String, Object>, Map<String, Object>> {

    private static final Gson gson = new Gson();

    /**
     * Retrieves order information based on the input from Step Functions and
     * returns the processed result as a new payload.
     *
     * @param input   Input from the previous Step Function state (as a Map).
     * @param context Lambda execution context.
     * @return Map<String, Object> to pass on to the next Step Function state.
     */
    public Map<String, Object> handleRequest(Map<String, Object> input, Context context) {
        LambdaLogger logger = context.getLogger();

        logger.log("RetrieveOrderHandler invoked at: " + ZonedDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        logger.log("Received input: " + input);

        // Get Parameter
        String amazonOrderId = (String)input.get("AmazonOrderId");
        String subscriptionId = (String)input.get("SubscriptionId");

        try {
            String combinedJson = OrderProcessUtils.buildPayloadWithCredentialsAndOrder(subscriptionId, amazonOrderId, logger);

            if (combinedJson == null) {
                throw new RuntimeException("Failed to retrieve order information via API. AmazonOrderId: " + amazonOrderId);
            }
            logger.log("Combined JSON successfully prepared for AmazonOrderId: " + amazonOrderId);
            // Generate message and set to next parameter
            enrichInputWithMessageContents(combinedJson, input, logger);
            // Set Credentials
            setCredentialsToParameter(subscriptionId, input);
        } catch (Exception e) {
            throw new RuntimeException("Failed to prepare combined JSON: " + e.getMessage(), e);
        }
        return input;
    }

    /**
     * Retrieves the client credentials associated with the given subscriptionId from DynamoDB,
     * and inserts them into the Step Functions input map under a predefined key.
     *
     * @param subscriptionId The subscription ID used to retrieve credentials from DynamoDB.
     * @param input The Step Functions input map to which the retrieved credentials will be added.
     * @throws RuntimeException if the credentials could not be retrieved (i.e., null result).
     */
    private void setCredentialsToParameter(String subscriptionId, Map<String, Object> input) {
        ClientCredentials credentials = getClientCredentialsFromDynamoDB(subscriptionId);
        if (credentials == null) {
            throw new RuntimeException("Failed to retrieve client credentials for subscriptionId: " + subscriptionId);
        }
        input.put(STEP_FUNCTION_INPUT_KEY_CREDENTIAL, credentials);
    }

    /**
     * Parses the combined order and item JSON data to extract order details and generate
     * a human-readable subject and message string. These values are then inserted into
     * the Step Functions input map for use in subsequent states (e.g., notification sending).
     *
     * The generated message includes:
     * - AmazonOrderId
     * - OrderStatus
     * - OrderTotal
     * - A comma-separated list of item SKUs
     *
     * @param combinedJson The JSON string that combines order and order item details,
     *                     typically obtained from SP-API responses.
     * @param input The Step Functions input map to enrich with "Subject" and "Message" keys.
     * @param logger The LambdaLogger used to log debug information during execution.
     */
    public void enrichInputWithMessageContents(String combinedJson, Map<String, Object> input, LambdaLogger logger) {

        JsonObject root = JsonParser.parseString(combinedJson).getAsJsonObject();

        GetOrderResponse orderResponse = gson.fromJson(root.getAsJsonObject(COMBINED_ORDER_JSON_KEY_ORDER), GetOrderResponse.class);
        GetOrderItemsResponse orderItemsResponse = gson.fromJson(root.getAsJsonObject(COMBINED_ORDER_JSON_KEY_ORDER_ITEM), GetOrderItemsResponse.class);

        List<String> skuList = orderItemsResponse.getPayload().getOrderItems().stream()
                .map(OrderItem::getSellerSKU)
                .collect(Collectors.toList());

        String items = String.join(",", skuList);

        // Generate subject and message
        String subject = "You have new Order!! Order ID:  " + orderResponse.getPayload().getAmazonOrderId();
        String message = String.format(
                "Your order detail.\nOrder ID: %s\nOrderStatus: %s\nOrderTotal: %s\nItems:\n%s",
                orderResponse.getPayload().getAmazonOrderId(),
                orderResponse.getPayload().getOrderStatus(),
                orderResponse.getPayload().getOrderTotal().getAmount(),
                items
        );

        logger.log("Generated message:\n" + message);

        input.put(STEP_FUNCTION_INPUT_KEY_SUBJECT, subject);
        input.put(STEP_FUNCTION_INPUT_KEY_MESSAGE, message);
    }
}
