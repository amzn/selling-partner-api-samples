package lambda.utils;

import com.amazonaws.services.lambda.runtime.LambdaLogger;
import lambda.common.ClientCredentials;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

import static lambda.common.Constants.*;


public class DBUtils {

    private static final DynamoDbClient dynamoDbClient = DynamoDbClient.create();

    /**
     * Saves subscription metadata to a DynamoDB table.
     *
     * <p>This method creates a new item in the specified DynamoDB table containing the subscription ID,
     * seller ID, destination ID, notification type, secret ARN, and the current timestamp. It is intended
     * for tracking SP-API notification subscriptions and their associated resources.</p>
     *
     * <p>The primary key configuration of the DynamoDB table is assumed to include {@code SubscriptionId}
     * as a partition key or part of a composite key.</p>
     *
     * @param tableName The name of the DynamoDB table where the subscription data should be saved
     * @param sellerId The unique identifier of the seller
     * @param subscriptionId The ID of the created or reused subscription
     * @param destinationId The ID of the destination associated with the subscription
     * @param notificationType The type of SP-API notification being subscribed to
     * @param arn The ARN of the Secrets Manager secret storing seller credentials
     */
    public static void saveSubscriptionToDynamoDB(
            String tableName,
            String sellerId,
            String subscriptionId,
            String destinationId,
            String notificationType,
            String arn) {

        Map<String, AttributeValue> item = Map.of(
                SUBSCRIPTION_ID, AttributeValue.builder().s(subscriptionId).build(),
                SELLER_ID, AttributeValue.builder().s(sellerId).build(),
                DESTINATION_ID, AttributeValue.builder().s(destinationId).build(),
                TIMESTAMP, AttributeValue.builder().s(java.time.Instant.now().toString()).build(),
                NOTIFICATION_TYPE, AttributeValue.builder().s(notificationType).build(),
                SELLER_SECRETS_ARN, AttributeValue.builder().s(arn).build()
        );

        PutItemRequest putItemRequest = PutItemRequest.builder()
                .tableName(tableName)
                .item(item)
                .build();

        dynamoDbClient.putItem(putItemRequest);
    }

    /**
     * Retrieves SP-API client credentials associated with a given subscription ID
     * by querying a DynamoDB table and resolving the corresponding Secrets Manager ARN.
     *
     * <p>This method performs the following steps:
     * <ol>
     *     <li>Looks up the record in DynamoDB using the provided subscription ID as the key.</li>
     *     <li>Extracts the ARN of the secret stored in AWS Secrets Manager from the result.</li>
     *     <li>Fetches and deserializes the secret value into a {@link ClientCredentials} object.</li>
     * </ol>
     *
     * @param subscriptionId The unique subscription ID used to query DynamoDB.
     * @return A {@link ClientCredentials} object retrieved from AWS Secrets Manager.
     * @throws RuntimeException if the DynamoDB item or secret cannot be retrieved.
     */
    public static ClientCredentials getClientCredentialsFromDynamoDB(String subscriptionId) {
        Map<String, AttributeValue> key = Map.of(
                SUBSCRIPTION_ID, AttributeValue.fromS(subscriptionId)
        );

        GetItemRequest getItemRequest = GetItemRequest.builder()
                .tableName(System.getenv(CLIENT_TABLE_NAME_ENV_VARIABLE))
                .key(key)
                .build();

        GetItemResponse getItemResult = dynamoDbClient.getItem(getItemRequest);
        Map<String, AttributeValue> item = getItemResult.item();

        String sellerSecretArn = item.get(SELLER_SECRETS_ARN).s();
        return SecretManagerUtils.getSecretCredentials(sellerSecretArn);
    }

    /**
     * Performs a parallel scan on the DynamoDB subscription table using multiple threads,
     * aggregating all subscription records across segments.
     * <p>
     * This method utilizes DynamoDB's segmented scan feature to divide the workload among
     * the specified number of threads (segments), enabling faster retrieval of large datasets.
     * Each thread scans a unique segment and gathers subscription records independently.
     *
     * @param threadCount Number of parallel threads (segments) to use for the scan.
     *                    Should typically match the read throughput capacity or number of vCPUs.
     * @param logger      AWS Lambda logger to output progress and diagnostic information.
     * @return A combined list of all subscription records retrieved from the table.
     *
     * @throws RuntimeException If the DynamoDB scan operation fails in any thread.
     *
     * Environment Variable Required:
     * - {@code CLIENT_TABLE_NAME_ENV_VARIABLE} — Name of the DynamoDB table to scan.
     *
     * Note: The result is a list of maps where each map represents a subscription record with
     * stringified key-value pairs.
     */
    public static List<Map<String, String>> parallelScanAllSubscriptions(int threadCount, LambdaLogger logger) {
        String tableName = System.getenv(CLIENT_TABLE_NAME_ENV_VARIABLE);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        List<CompletableFuture<List<Map<String, String>>>> futures = new ArrayList<>();

        for (int segment = 0; segment < threadCount; segment++) {
            int finalSegment = segment;
            futures.add(CompletableFuture.supplyAsync(() -> {
                List<Map<String, String>> result = new ArrayList<>();
                Map<String, AttributeValue> lastEvaluatedKey = null;

                do {
                    ScanRequest.Builder requestBuilder = ScanRequest.builder()
                            .tableName(tableName)
                            .totalSegments(threadCount)
                            .segment(finalSegment)
                            .limit(100);

                    if (lastEvaluatedKey != null) {
                        requestBuilder.exclusiveStartKey(lastEvaluatedKey);
                    }

                    ScanResponse response = dynamoDbClient.scan(requestBuilder.build());
                    response.items().stream()
                            .map(DBUtils::convertAttributes)
                            .forEach(result::add);

                    lastEvaluatedKey = response.lastEvaluatedKey();

                } while (lastEvaluatedKey != null && !lastEvaluatedKey.isEmpty());

                logger.log("Segment " + finalSegment + " scanned " + result.size() + " items.\n");
                return result;

            }, executor));
        }

        List<Map<String, String>> combined = futures.stream()
                .map(CompletableFuture::join)
                .flatMap(List::stream)
                .collect(Collectors.toList());

        executor.shutdown();
        return combined;
    }

    /**
     * Performs a parallel segmented scan on the DynamoDB subscription table,
     * filtering by provided NotificationTypes and optionally SellerIds.
     * <p>
     * The scan is distributed across multiple threads using DynamoDB's parallel scan mechanism.
     * Each segment is processed concurrently, applying the same filter condition on NotificationType.
     * If {@code sellerIds} is provided, additional filtering is applied after retrieval.
     *
     * @param notificationTypes List of NotificationType values to filter on (required).
     * @param sellerIds         List of SellerIds to filter on (optional; if empty, all sellers are included).
     * @param threadCount       Number of parallel scan segments/threads to use.
     * @param logger            AWS Lambda logger to record progress and debug info.
     * @return A combined list of subscription records matching the given filters.
     *
     * @throws RuntimeException If the DynamoDB scan operation fails in any thread.
     *
     * Environment Variable Required:
     * - {@code CLIENT_TABLE_NAME_ENV_VARIABLE} — Name of the DynamoDB table to scan.
     *
     * Note:
     * - The filter on SellerId is performed in-memory after the DynamoDB scan.
     * - Each result item is represented as a {@code Map<String, String>} converted from raw attribute values.
     */
    public static List<Map<String, String>> parallelScanWithNotificationTypeFilter(
            List<String> notificationTypes,
            List<String> sellerIds,
            int threadCount,
            LambdaLogger logger
    ) {
        String tableName = System.getenv(CLIENT_TABLE_NAME_ENV_VARIABLE);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        List<CompletableFuture<List<Map<String, String>>>> futures = new ArrayList<>();

        // FilterExpression: NotificationType = :nt0 OR :nt1 OR ...
        String filterExpression = notificationTypes.stream()
                .map(t -> NOTIFICATION_TYPE + " = :" + t)
                .collect(Collectors.joining(" OR "));

        Map<String, AttributeValue> expressionValues = notificationTypes.stream()
                .collect(Collectors.toMap(
                        t -> ":" + t,
                        AttributeValue::fromS
                ));

        for (int segment = 0; segment < threadCount; segment++) {
            int finalSegment = segment;

            futures.add(CompletableFuture.supplyAsync(() -> {
                List<Map<String, String>> result = new ArrayList<>();
                Map<String, AttributeValue> lastEvaluatedKey = null;

                do {
                    ScanRequest.Builder scanBuilder = ScanRequest.builder()
                            .tableName(tableName)
                            .segment(finalSegment)
                            .totalSegments(threadCount)
                            .limit(100)
                            .filterExpression(filterExpression)
                            .expressionAttributeValues(expressionValues);

                    if (lastEvaluatedKey != null) {
                        scanBuilder.exclusiveStartKey(lastEvaluatedKey);
                    }

                    ScanResponse response = dynamoDbClient.scan(scanBuilder.build());

                    response.items().stream()
                            .map(DBUtils::convertAttributes)
                            .filter(record -> sellerIds.isEmpty() || sellerIds.contains(record.get(SELLER_ID)))
                            .forEach(result::add);

                    lastEvaluatedKey = response.lastEvaluatedKey();

                } while (lastEvaluatedKey != null && !lastEvaluatedKey.isEmpty());

                logger.log(String.format("Segment %d processed %d matching items\n", finalSegment, result.size()));
                return result;

            }, executor));
        }

        List<Map<String, String>> combined = futures.stream()
                .map(CompletableFuture::join)
                .flatMap(List::stream)
                .collect(Collectors.toList());

        executor.shutdown();
        return combined;
    }


    /**
     * Deletes a subscription record from the DynamoDB table based on the given Subscription ID.
     * <p>
     * This method constructs a delete request using the subscription ID as the primary key,
     * and issues the request to the DynamoDB table specified by the environment variable.
     *
     * @param subscriptionId The unique identifier of the subscription record to delete.
     *
     * Environment Variable Required:
     * - {@code CLIENT_TABLE_NAME_ENV_VARIABLE} — Name of the DynamoDB table where subscription records are stored.
     *
     * @throws software.amazon.awssdk.services.dynamodb.model.DynamoDbException
     *         If the deletion request fails due to access issues or invalid input.
     */
    public static void deleteSubscriptionRecord(String subscriptionId) {
        Map<String, AttributeValue> key = Map.of(
                SUBSCRIPTION_ID, AttributeValue.fromS(subscriptionId)
        );

        DeleteItemRequest request = DeleteItemRequest.builder()
                .tableName(System.getenv(CLIENT_TABLE_NAME_ENV_VARIABLE))
                .key(key)
                .build();

        dynamoDbClient.deleteItem(request);
    }

    /**
     * Converts a DynamoDB item represented as a Map of {@code AttributeValue} into
     * a plain {@code Map<String, String>} by extracting string values.
     * <p>
     * This utility is useful for simplifying DynamoDB records into a more
     * general-purpose format, assuming all values are stored as strings.
     *
     * @param attrs A map representing a DynamoDB item, where each value is an {@code AttributeValue}.
     * @return A map with the same keys, but with string values extracted via {@code AttributeValue.s()}.
     *
     * @throws NullPointerException If any {@code AttributeValue} in the input map is null or does not contain a string.
     */
    private static Map<String, String> convertAttributes(Map<String, AttributeValue> attrs) {
        Map<String, String> map = new HashMap<>();
        attrs.forEach((k, v) -> map.put(k, v.s()));
        return map;
    }
}
