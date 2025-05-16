package lambda.utils;

import com.amazon.SellingPartnerAPIAA.LWAException;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import lambda.common.AppCredentials;
import lambda.common.ClientCredentials;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.orders.v0.OrdersV0Api;
import software.amazon.spapi.models.orders.v0.GetOrderItemsResponse;
import software.amazon.spapi.models.orders.v0.GetOrderResponse;
import java.util.*;

import static lambda.common.Constants.*;
import static lambda.utils.DBUtils.getClientCredentialsFromDynamoDB;

public class OrderProcessUtils {

    private static final Gson gson = new Gson();


    /**
     * Determines whether the given SP-API ORDER_CHANGE notification should be processed,
     * based on predefined filtering criteria.
     * This method applies the following conditions:
     * <ul>
     *   <li>The {@code NotificationType} must be {@code "ORDER_CHANGE"}.</li>
     *   <li>The {@code NotificationLevel} must be {@code "OrderLevel"}.</li>
     *   <li>The {@code OrderStatus} must not be {@code "Pending"}.</li>
     * </ul>
     *
     * If any of the above conditions are not met, the method logs the reason and returns {@code false}.
     * This is used to prevent processing of irrelevant or premature notifications.
     *
     * @param body   The parsed JSON object representing the SP-API notification payload.
     * @param logger The Lambda logger used to output diagnostic messages.
     * @return {@code true} if the notification meets all processing criteria; {@code false} otherwise.
     */
    public static boolean shouldProcessOrderNotification(JsonObject body, LambdaLogger logger) {
        // Only process the notification if it is of type 'ORDER_CHANGE'
        String notificationType = body.get("NotificationType").getAsString();
        if (!NOTIFICATION_TYPE_ORDER_CHANGE.equals(notificationType)) {
            logger.log(String.format("Notification type %s skipped", notificationType));
            return false;
        }

        // Only process the notification is OrderLevel
        String notificationLevel = body.getAsJsonObject("Payload")
                .getAsJsonObject("OrderChangeNotification")
                .get("NotificationLevel").getAsString();
        if (!NOTIFICATION_LEVEL_ORDER_LEVEL.equals(notificationLevel)) {
            logger.log(String.format("Notification level %s skipped", notificationLevel));
            return false;
        }

        // Skip if orderStatus is Pending
        String orderStatus = body.getAsJsonObject("Payload")
                .getAsJsonObject("OrderChangeNotification")
                .getAsJsonObject("Summary")
                .get("OrderStatus").getAsString();
        if (NOTIFICATION_IGNORE_ORDER_STATUS.equals(orderStatus)) {
            logger.log("Skip sending notification because orderStatus is still Pending... ");
            return false;
        }

        return true;
    }

    /**
     * Builds a unified notification payload by retrieving order and order item details
     * from the SP-API OrdersV0 API using the {@code AmazonOrderId} extracted from the SQS message.
     * The resulting payload includes:
     * <ul>
     *   <li>The full {@link GetOrderResponse} returned by {@code getOrder}</li>
     *   <li>The {@link GetOrderItemsResponse} returned by {@code getOrderItems}</li>
     *   <li>The original message body for traceability</li>
     * </ul>
     *
     * This method is intended to enrich the SP-API ORDER_CHANGE notification with order details
     * prior to forwarding to downstream consumers (e.g., webhook or cross-platform destination).
     *
     * @param amazonOrderId The SQS message containing the raw ORDER_CHANGE notification
     * @param orderApi An instance of {@link OrdersV0Api} used to retrieve order data
     * @param logger The Lambda logger used for diagnostic logging
     * @return A JSON string containing the enriched notification payload
     * @throws LWAException If authorization with Login With Amazon (LWA) fails
     * @throws ApiException If the SP-API call to retrieve order or items fails
     */
    public static String buildOrderNotificationMessage(String amazonOrderId, OrdersV0Api orderApi, LambdaLogger logger) throws LWAException, ApiException {
        // Retrieve Order/OrderItem Information by amazonOrderId via OrderAPI
        // API calls to retrieve order and order items
        GetOrderResponse orderResponse = orderApi.getOrder(amazonOrderId);
        logger.log("Order Response : " + new Gson().toJson(orderResponse));

        GetOrderItemsResponse orderItemsResponse = orderApi.getOrderItems(amazonOrderId, null);
        logger.log("Order Items Response : " + new Gson().toJson(orderItemsResponse));

        Map<String, Object> combinedData = new HashMap<>();
        combinedData.put(COMBINED_ORDER_JSON_KEY_ORDER, orderResponse);
        combinedData.put(COMBINED_ORDER_JSON_KEY_ORDER_ITEM, orderItemsResponse);

        return gson.toJson(combinedData);
    }

    /**
     * Prepares an enriched notification payload by performing validation and data augmentation
     * for SP-API ORDER_CHANGE notifications received via SQS.
     * This method performs the following operations:
     * <ol>
     *   <li>Parses the incoming message body and handles double-encoded JSON if necessary</li>
     *   <li>Filters out notifications that do not meet processing criteria (via {@code shouldProcessOrderNotification})</li>
     *   <li>Retrieves seller credentials from DynamoDB using the {@code SubscriptionId} from the notification</li>
     *   <li>Uses the retrieved credentials to call the SP-API OrdersV0 API and enrich the notification with order details</li>
     * </ol>
     *
     * If the notification should not be processed, {@code null} is returned.
     *
     * @param message The SQS message containing the raw SP-API notification
     * @param logger The Lambda logger for logging diagnostic information
     * @return A JSON string of the enriched payload, or {@code null} if the notification was skipped
     * @throws Exception If any parsing, credential retrieval, or SP-API call fails
     */
    public static String prepareNotificationPayload(SQSEvent.SQSMessage message, LambdaLogger logger) throws Exception {
        JsonElement parsed = JsonParser.parseString(message.getBody());
        if (parsed.isJsonPrimitive()) {
            parsed = JsonParser.parseString(parsed.getAsString());
        }
        JsonObject body = parsed.getAsJsonObject();

        // Check the condition of ORDER_CHANGE notification
        if (!shouldProcessOrderNotification(body, logger)) {
            return null;
        }

        // Get AmazonOrderId
        String amazonOrderId = body
                .getAsJsonObject("Payload")
                .getAsJsonObject("OrderChangeNotification")
                .get("AmazonOrderId")
                .getAsString();

        String subscriptionId = body
                .getAsJsonObject("NotificationMetadata")
                .get("SubscriptionId")
                .getAsString();

        // Build the notification content using retrieved credentials and order data
        return buildPayloadWithCredentialsAndOrder(subscriptionId, amazonOrderId, logger);
    }

    /**
     * Retrieves client credentials and builds a detailed order notification payload.
     *
     * @param body    The parsed notification body from the message.
     * @param logger  LambdaLogger for logging context.
     * @return A JSON string representing the enriched order notification.
     * @throws Exception if retrieval or API call fails.
     */
    public static String buildPayloadWithCredentialsAndOrder(String subscriptionId, String amazonOrderId, LambdaLogger logger) throws Exception {
        // Retrieve ClientCredentials from DynamoDB (ARN) -> Secret Manager by subscriptionId
        ClientCredentials credentials = getClientCredentialsFromDynamoDB(subscriptionId);
        AppCredentials appCredentials = new AppCredentials(credentials.getClientId(), credentials.getClientSecret());

        // Get order information to append to the message
        OrdersV0Api orderApi = ApiUtils.getOrdersV0Api(
                credentials.getRefreshToken(),
                credentials.getRegionCode(),
                appCredentials
        );

        return buildOrderNotificationMessage(amazonOrderId, orderApi, logger);
    }


    /**
     * Evaluates whether a given order notification should trigger further processing.
     * <p>
     * This method is intended to implement business logic for filtering notifications based on:
     * <ul>
     *   <li>Duplicate detection (e.g., checking if the AmazonOrderId has already been processed)</li>
     *   <li>Order status filtering (e.g., only proceed if the status is "Shipped")</li>
     *   <li>Other custom rules (e.g., region, flags, or seller-specific policies)</li>
     * </ul>
     *
     * @param body   The parsed JSON object representing the notification message payload.
     * @param logger The LambdaLogger for writing diagnostic logs.
     * @return {@code true} if the message should be processed; {@code false} if it should be skipped.
     */
    public static boolean shouldTriggerProcessing(JsonObject body, LambdaLogger logger) {
        try {

            /*
             Extracts AmazonOrderId and OrderStatus from the message payload.

             This method should implement processing criteria such as:
             - Skipping duplicate orders (e.g., by checking DynamoDB or cache)
             - Filtering by OrderStatus (e.g., only process if status is "Shipped")
             - Any other business-specific rules (e.g., region, priority flags)

             Return true to trigger further processing (e.g., start Step Functions),
             or false to skip this notification.

             This ensures only new and relevant order notifications are processed.
            */

            return true;

        } catch (Exception e) {
            logger.log("Failed to evaluate processing criteria: " + e.getMessage());
            return false;
        }
    }

    /**
     * Parses the body of an SQS message into a JsonObject.
     * Automatically handles double-encoded JSON strings.
     *
     * @param message The SQS message to parse.
     * @return Parsed JsonObject representing the message body.
     * @throws IllegalArgumentException if the body is not valid JSON.
     */
    public static JsonObject parseSqsMessageBody(SQSEvent.SQSMessage message) {
        JsonElement parsed = JsonParser.parseString(message.getBody());

        // Handle case where body is a JSON string (double-encoded)
        if (parsed.isJsonPrimitive() && parsed.getAsJsonPrimitive().isString()) {
            parsed = JsonParser.parseString(parsed.getAsString());
        }

        return parsed.getAsJsonObject();
    }

    /**
     * Extracts required fields from a custom SP-API OrderChangeNotification message payload
     * and builds a map suitable for use as Step Functions input.
     * <p>
     * This method assumes the input JSON follows the structure of Amazon SP-API's
     * OrderChangeNotification, where the following fields are expected:
     * <ul>
     *     <li>{@code Payload.OrderChangeNotification.AmazonOrderId}</li>
     *     <li>{@code NotificationMetadata.SubscriptionId}</li>
     * </ul>
     * These values are extracted and mapped to a {@code Map<String, Object>} that can be passed
     * to a Step Functions state machine.
     *
     * <p><strong>Note:</strong> This method is specifically tailored for use in Lambda handlers
     * that process OrderChange notifications. It is not designed for use with other notification types.
     *
     * @param jsonObject The parsed JSON payload of the notification event (typically from SQS/EventBridge).
     * @return A map containing {@code AmazonOrderId} and {@code SubscriptionId}, for Step Function input.
     *
     * @throws NullPointerException If the expected fields are not present in the input JSON.
     */
    public static Map<String, Object> buildInputForStepFunction(JsonObject jsonObject) {
        String amazonOrderId = jsonObject
                .getAsJsonObject("Payload")
                .getAsJsonObject("OrderChangeNotification")
                .get("AmazonOrderId")
                .getAsString();

        String subscriptionId = jsonObject
                .getAsJsonObject("NotificationMetadata")
                .get("SubscriptionId")
                .getAsString();

        Map<String, Object> inputForStepFunction = new HashMap<>();
        inputForStepFunction.put("AmazonOrderId", amazonOrderId);
        inputForStepFunction.put("SubscriptionId", subscriptionId);

        return inputForStepFunction;
    }
}
