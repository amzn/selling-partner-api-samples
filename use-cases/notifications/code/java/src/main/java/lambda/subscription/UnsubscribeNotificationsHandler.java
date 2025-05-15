package lambda.subscription;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.common.util.concurrent.RateLimiter;
import com.google.gson.Gson;
import lambda.common.AppCredentials;
import lambda.common.ClientCredentials;
import lambda.common.UnsubscribeRequest;
import lambda.utils.ApiUtils;
import lambda.utils.DBUtils;
import lambda.utils.SecretManagerUtils;
import software.amazon.spapi.api.notifications.v1.NotificationsApi;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static lambda.common.Constants.*;
import static lambda.common.Constants.SELLER_SECRETS_ARN;


/**
 * AWS Lambda handler for unsubscribing SP-API notifications.
 * Supports full deletion (`DeleteAll`), deletion by NotificationTypes,
 * or deletion by NotificationTypes and SellerIds.
 *
 * Expected input format:
 *
 * {
 *   "DeleteAll": true,
 *   "DeleteDestination": true,
 *   "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"],
 *   "SellerIds": ["A3TUGXXXXXXXX"]
 * }
 *
 * Full deletion
 * {
 *   "DeleteAll": true
 * }
 *
 * Deletion by NotificationType
 * {
 *   "DeleteDestination": true,
 *   "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"]
 * }
 *
 * Deletion by NotificationType & SellerId
 * Note: Destination won't be deleted with this operation
 * {
 *   "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"],
 *   "SellerIds": ["A3TUGXXXXXXXX"]
 * }
 *
 */
public class UnsubscribeNotificationsHandler implements RequestHandler<Map<String, Object>, String> {

    private static final Gson gson = new Gson();

    @SuppressWarnings("UnstableApiUsage")
    private static final RateLimiter deleteSubscriptionRateLimiter = RateLimiter.create(1.0);

    @Override
    public String handleRequest(Map<String, Object> input, Context context) {
        LambdaLogger logger = context.getLogger();

        try {
            logger.log("Input: " + gson.toJson(input));

            String json = gson.toJson(input);
            UnsubscribeRequest request = gson.fromJson(json, UnsubscribeRequest.class);
            request.initDefaults();

            if (request.getDeleteAll()) {
                boolean hasOtherParams =
                        !request.getNotificationTypes().isEmpty() ||
                                !request.getSellerIds().isEmpty() ||
                                request.getDeleteDestination();

                if (hasOtherParams) {
                    throw new IllegalArgumentException("If 'DeleteAll' is true, other parameters must not be provided.");
                }
                return deleteAllSubscriptions(logger);
            }

            if (request.getNotificationTypes().isEmpty()) {
                throw new IllegalArgumentException("Error: NotificationTypes must be provided unless DeleteAll is true.");
            }

            if (request.getSellerIds().isEmpty()) {
                return deleteByNotificationTypeOnly(request, logger);
            }

            return deleteByNotificationTypeAndSeller(request, logger);
        } catch (Exception e) {
            logger.log("Failed to process input: " + e.getMessage());
            return "Error: " + e.getMessage();
        }
    }

    /**
     * Deletes all subscription records and optionally their destinations.
     */
    private String deleteAllSubscriptions(LambdaLogger logger) throws Exception {
        logger.log("Deleting all subscriptions and destinations...\n");

        List<Map<String, String>> allRecords = DBUtils.parallelScanAllSubscriptions(8, logger);
        return deleteRecords(allRecords, logger);
    }

    /**
     * Deletes subscriptions by NotificationTypes only (for all sellers).
     * If DeleteDestination is true, it will try to delete Destination, if there is no other usage for the Destination.
     */
    private String deleteByNotificationTypeOnly(UnsubscribeRequest request, LambdaLogger logger) throws Exception {
        logger.log("Deleting by NotificationTypes only...\n");

        List<Map<String, String>> matched = DBUtils.parallelScanWithNotificationTypeFilter(
                request.getNotificationTypes(),
                List.of(),
                8,
                logger
        );
        return deleteRecords(matched, logger, request.getDeleteDestination());
    }

    /**
     * Deletes subscriptions by both NotificationTypes and SellerIds.
     * DeleteDestination parameter will be ignored with this operation.
     */
    private String deleteByNotificationTypeAndSeller(UnsubscribeRequest request, LambdaLogger logger) throws Exception {
        logger.log("Deleting by NotificationTypes + SellerIds...\n  DeleteDestination parameter will be ignored with this operation.");

        List<Map<String, String>> matched = DBUtils.parallelScanWithNotificationTypeFilter(
                request.getNotificationTypes(),
                request.getSellerIds(),
                8,
                logger
        );
        return deleteRecords(matched, logger, false);
    }

    /**
     * Deletes subscription records from SP-API and DynamoDB with default: deleteDestination = true.
     */
    private String deleteRecords(List<Map<String, String>> records, LambdaLogger logger) throws Exception {
        return deleteRecords(records, logger, true);
    }

    /**
     * Deletes subscriptions from SP-API and removes records from DynamoDB.
     * Also deletes destinations if specified.
     *
     * @param records List of subscription records from DB
     * @param logger Lambda logger
     * @param deleteDestination Whether to delete the destination as well
     */
    private String deleteRecords(List<Map<String, String>> records, LambdaLogger logger, boolean deleteDestination) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(Math.min(records.size(), 4));
        List<CompletableFuture<String>> futures = new ArrayList<>();

        Set<String> destinationsToDelete = new HashSet<>();
        Map<String, ClientCredentials> destinationOwnerMap = new HashMap<>();

        for (Map<String, String> record : records) {
            futures.add(CompletableFuture.supplyAsync(() -> {
                String subscriptionId = record.get(SUBSCRIPTION_ID);
                String destinationId = record.get(DESTINATION_ID);
                String notificationType = record.get(NOTIFICATION_TYPE);
                String secretArn = record.get(SELLER_SECRETS_ARN);

                try {
                    ClientCredentials credentials = SecretManagerUtils.getSecretCredentials(secretArn);
                    AppCredentials appCredentials = new AppCredentials(credentials.getClientId(), credentials.getClientSecret());
                    NotificationsApi api = ApiUtils.buildNotificationsApi(credentials.getRefreshToken(), credentials.getRegionCode(), appCredentials, false);

                    deleteSubscriptionRateLimiter.acquire();
                    api.deleteSubscriptionById(subscriptionId, notificationType);
                    logger.log("Deleted Subscription: " + subscriptionId);

                    DBUtils.deleteSubscriptionRecord(subscriptionId);
                    logger.log("Deleted record from DynamoDB: " + subscriptionId);

                    if (deleteDestination) {
                        synchronized (destinationsToDelete) {
                            destinationsToDelete.add(destinationId);
                            destinationOwnerMap.putIfAbsent(destinationId, credentials);
                        }
                    }

                    return "Deleted: " + subscriptionId;

                } catch (Exception e) {
                    logger.log("Failed for subscriptionId=" + subscriptionId + ": " + e.getMessage());
                    return null;
                }
            }, executor));
        }

        StringBuilder result = new StringBuilder();
        for (CompletableFuture<String> future : futures) {
            String res = future.join();
            if (res != null) result.append(res).append("\n");
        }

        executor.shutdown();
        boolean finished = executor.awaitTermination(2, TimeUnit.MINUTES);
        if (!finished) {
            logger.log("ExecutorService did not complete in 2 minutes.\n");
            throw new RuntimeException("Background deletion tasks did not finish in time");
        }


        // Delete Destination
        if (deleteDestination && !destinationsToDelete.isEmpty()) {
            logger.log("Starting Destination cleanup (after all subscription deletions)...\n");
            for (String destinationId : destinationsToDelete) {
                ClientCredentials credentials = destinationOwnerMap.get(destinationId);
                if (credentials == null) {
                    logger.log("No credentials found for destination: " + destinationId + "\n");
                    continue;
                }

                try {
                    AppCredentials appCredentials = new AppCredentials(credentials.getClientId(), credentials.getClientSecret());
                    NotificationsApi deleteApi = ApiUtils.buildNotificationsApi(null, credentials.getRegionCode(), appCredentials, true);
                    deleteApi.deleteDestination(destinationId);
                    logger.log("🗑 Destination deleted: " + destinationId + "\n");

                } catch (Exception e) {
                    logger.log("Failed to delete destinationId=" + destinationId + ": " + e.getMessage() + "\n");
                }
            }
        }


        return result.toString();
    }
}