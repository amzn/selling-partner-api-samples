package lambda.subscription;

import com.amazon.SellingPartnerAPIAA.LWAException;
import com.google.common.util.concurrent.RateLimiter;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import lambda.common.AppCredentials;
import lambda.common.ClientCredentials;
import lambda.utils.*;

import static lambda.common.Constants.*;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.notifications.v1.NotificationsApi;
import software.amazon.spapi.models.notifications.v1.*;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Sample Lambda handler for automating the setup of SP-API notification subscriptions
 * across multiple sellers and notification types.
 * This handler demonstrates:
 * - Loading seller credentials from AWS Secrets Manager
 * - Creating or reusing SP-API destinations (SQS or EventBridge)
 * - Subscribing each seller to the specified notification types
 * - Storing the resulting subscription metadata (destinationId, subscriptionId, etc.) in DynamoDB
 * - Applying rate limits and retry strategies for SP-API calls
 * Input Format (Map<String, List<String>>):
 * - "notificationType": List of notification type strings (e.g. "ORDER_CHANGE")
 * - "sellerId": List of seller IDs to register
 * Required Environment Variables:
 * - SP_API_APP_CREDENTIALS_SECRET_ARN
 * - NOTIFICATION_DESTINATION (JSON map of notificationType to destination ARN)
 * - CLIENT_TABLE_NAME
 * - EVENT_BUS_DESTINATION_ID (for EventBridge)
 * - NOTIFICATION_TYPE_DEFINITION (for distinguishing SQS/EventBridge routing)
 * This class is intended as a scalable and customizable example for bulk notification onboarding.
 */
public class SubscribeNotificationsHandler implements RequestHandler<Map<String, List<String>>, String> {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final Gson gson = new Gson();

    // Static rate limiters for API control
    @SuppressWarnings("UnstableApiUsage")
    private static final RateLimiter createDestinationRateLimiter = RateLimiter.create(1.0);   // 1 req/sec
    @SuppressWarnings("UnstableApiUsage")
    private static final RateLimiter createSubscriptionRateLimiter = RateLimiter.create(1.0);
    @SuppressWarnings("UnstableApiUsage")
    private static final RateLimiter getDestinationRateLimiter = RateLimiter.create(5.0);   // 5 req/sec
    @SuppressWarnings("UnstableApiUsage")
    private static final RateLimiter getSubscriptionRateLimiter = RateLimiter.create(5.0);

    @Override
    public String handleRequest(Map<String, List<String>> input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("Subscribe SQS Notifications Lambda started\n");

        try {
            logger.log("Input payload: " + objectMapper.writeValueAsString(input) + "\n");

            List<String> notificationTypes = input.get(NOTIFICATION_TYPE_KEY_NAME);
            List<String> sellerIds = input.get(SELLER_ID_KEY_NAME);

            // Step 1: Load secret mapping (sellerId -> secretArn)
            Map<String, String> combinedSecretsMap
                    = SecretManagerUtils.fetchCombinedSecretsMap(
                            logger, System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));

            // Step 2: Fetch credentials
            Set<ClientCredentials> credentialsSet
                    = SecretManagerUtils.fetchCredentialsForSellers(sellerIds, combinedSecretsMap, logger);

            // Step 3: Process each notification type for each credential
            return processNotificationTypes(notificationTypes, credentialsSet, combinedSecretsMap, logger);

        } catch (Exception e) {
            logger.log("Error occurred: " + e.getMessage() + "\n");
            throw new RuntimeException("Subscribe SQS Notification failed", e);
        }
    }

    /**
     * Processes each notification type for all provided seller credentials by creating or reusing
     * SP-API destinations and subscriptions, and storing the resulting subscription metadata into DynamoDB.
     *
     * <p>This method executes the processing logic in parallel using a fixed-size thread pool
     * to improve performance when handling a large number of sellers and notification types.</p>
     *
     * <p>For each (notificationType, seller) combination, the method performs the following steps:
     * <ol>
     *   <li>Creates or retrieves a destination (SQS or EventBridge) from SP-API</li>
     *   <li>Subscribes the seller to the destination with the given notification type</li>
     *   <li>Stores the subscription metadata (destination ID, subscription ID, etc.) in a DynamoDB table</li>
     * </ol>
     *
     * <p>EventBridge destinations are assumed to be pre-created and shared across sellers.
     * SQS destinations are created or reused per seller if necessary.</p>
     *
     * @param notificationTypes The list of SP-API notification types to subscribe to
     * @param credentialsSet A set of {@link ClientCredentials} containing credentials for each seller
     * @param combinedSecretsMap A mapping of sellerId to its corresponding secret ARN (used for logging or auditing)
     * @param logger The Lambda logger instance used for logging internal messages
     * @return A formatted string containing the result of all successful subscription operations
     * @throws IOException If the destination configuration cannot be parsed
     * @throws ApiException If any SP-API operation fails (destination or subscription creation)
     * @throws LWAException If Login With Amazon (LWA) token retrieval fails
     */
    private String processNotificationTypes(
            List<String> notificationTypes,
            Set<ClientCredentials> credentialsSet,
            Map<String, String> combinedSecretsMap,
            LambdaLogger logger) throws IOException, LWAException, ApiException {

        String destinationsRaw = System.getenv(NOTIFICATION_DESTINATION_ENV_VARIABLE);
        Map<String, String> destinationMap = objectMapper.readValue(destinationsRaw, new TypeReference<>() {});
        List<String> eventBridgeRequiredList = getEventBridgeRequiredList();

        int threadCount = Math.min(credentialsSet.size() * notificationTypes.size(), 4);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        List<CompletableFuture<String>> futures = new ArrayList<>();

        for (String notificationType : notificationTypes) {
            String destinationValue = destinationMap.get(notificationType);

            for (ClientCredentials credentials : credentialsSet) {
                futures.add(CompletableFuture.supplyAsync(() -> {
                    try {
                        AppCredentials appCredentials = new AppCredentials(credentials.getClientId(), credentials.getClientSecret());
                        NotificationsApi destApi = ApiUtils.buildNotificationsApi(null, credentials.getRegionCode(), appCredentials, true);
                        NotificationsApi subApi = ApiUtils.buildNotificationsApi(credentials.getRefreshToken(), credentials.getRegionCode(), appCredentials, false);

                        logger.log("Creating or fetching destination for notificationType: " + notificationType + "\n");

                        String destinationId;
                        if (eventBridgeRequiredList.contains(notificationType)) {
                            destinationId = System.getenv(EVENT_BUS_DESTINATION_ID_ENV_VARIABLE);
                        } else {
                            destinationId = getOrCreateSqsDestination(destApi, destinationValue);
                        }

                        logger.log("Destination ID obtained: " + destinationId + "\n");

                        String subscriptionId = getOrCreateSubscription(subApi, destinationId, notificationType);
                        logger.log("Subscription ID obtained: " + subscriptionId + "\n");

                        DBUtils.saveSubscriptionToDynamoDB(
                                System.getenv(CLIENT_TABLE_NAME_ENV_VARIABLE),
                                credentials.getSellerId(),
                                subscriptionId,
                                destinationId,
                                notificationType,
                                combinedSecretsMap.get(credentials.getSellerId()));

                        return String.format("NotificationType: %s\nDestination Id: %s\nSubscription Id: %s\n",
                                notificationType, destinationId, subscriptionId);

                    } catch (Exception e) {
                        logger.log("Failed to process subscription for sellerId=" + credentials.getSellerId()
                                + ", notificationType=" + notificationType + ": " + e.getMessage());
                        return null;
                    }
                }, executor));
            }
        }

        StringBuilder combinedResult = new StringBuilder();
        futures.stream()
                .map(CompletableFuture::join)
                .filter(Objects::nonNull)
                .forEach(combinedResult::append);

        executor.shutdown();
        return combinedResult.toString();
    }


    /**
     * Creates a new SQS destination using the given ARN, or returns an existing destination ID
     * if one already exists for the same SQS resource.
     *
     * <p>This method enforces a rate limit (1 request/sec) using a {@link RateLimiter}, and retries
     * up to 3 times if the SP-API responds with a temporary error (HTTP 429 or 5xx). If a conflict
     * (HTTP 409) occurs, it attempts to retrieve the existing destination using
     * {@link #findExistingDestination(NotificationsApi, String, String, String)}.</p>
     *
     * <p>If the rate limiter cannot acquire a permit within 5 seconds, the request is skipped to prevent overloading.</p>
     *
     * @param api The {@link NotificationsApi} client used to call SP-API
     * @param sqsArn The ARN of the SQS queue to register as a destination
     * @return The destination ID for the newly created or existing SQS destination
     * @throws ApiException If destination creation fails after retries or returns an unrecoverable error
     * @throws LWAException If authentication via Login With Amazon (LWA) fails
     * @throws RuntimeException If rate limiting or retries are exhausted
     */
    private String getOrCreateSqsDestination(NotificationsApi api, String sqsArn) throws ApiException, LWAException {
        final int maxRetries = 3;
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (!createDestinationRateLimiter.tryAcquire(5, TimeUnit.SECONDS)) {
                    throw new RuntimeException("RateLimiter timeout: createDestination");
                }

                CreateDestinationRequest request = new CreateDestinationRequest()
                        .name(UUID.randomUUID().toString())
                        .resourceSpecification(new DestinationResourceSpecification()
                                .sqs(new SqsResource().arn(sqsArn)));

                return api.createDestination(request).getPayload().getDestinationId();

            } catch (ApiException e) {
                if (e.getCode() == 409) {
                    return findExistingDestination(api, sqsArn, null, null);
                } else if (attempt < maxRetries && (e.getCode() == 429 || e.getCode() >= 500)) {
                    try {
                        Thread.sleep(1000L * attempt); // simple exponential backoff
                    } catch (InterruptedException ignored) {}
                    continue; // retry
                }
                throw new RuntimeException("Failed to create destination after attempt " + attempt + ": " + e.getMessage(), e);
            } catch (LWAException e) {
                throw new RuntimeException("LWA failed during destination creation", e);
            }
        }

        throw new RuntimeException("Exceeded max retries for createDestination");
    }


    /**
     * Searches for an existing SP-API destination that matches either the provided SQS ARN
     * or EventBridge parameters (accountId and region).
     *
     * @param api        The SP-API NotificationsApi instance used to retrieve destinations
     * @param sqsArn     The ARN of the SQS queue to match
     * @param accountId  The AWS Account ID used for EventBridge destination matching
     * @param region     The AWS region used for EventBridge destination matching
     * @return           The matching destinationId if found
     * @throws ApiException    If the SP-API call fails
     * @throws LWAException    If the Login With Amazon (LWA) token fails
     * @throws RuntimeException If no matching destination is found
     */
    private String findExistingDestination(NotificationsApi api, String sqsArn, String accountId, String region)
            throws ApiException, LWAException {
        // Rate limited Get destination
        getDestinationRateLimiter.acquire();
        List<Destination> destinations = api.getDestinations().getPayload();

        for (Destination destination : destinations) {
            if (destination.getResource() != null) {
                // Match SQS Destination
                if (sqsArn != null) {
                    SqsResource sqs = destination.getResource().getSqs();
                    if (sqs != null && sqsArn.equals(sqs.getArn())) {
                        return destination.getDestinationId();
                    }
                }

                // Match EventBridge Destination
                if (accountId != null && region != null) {
                    EventBridgeResource eb = destination.getResource().getEventBridge();
                    if (eb != null && accountId.equals(eb.getAccountId()) && region.equals(eb.getRegion())) {
                        return destination.getDestinationId();
                    }
                }
            }
        }

        throw new RuntimeException("Matching destination not found for SQS or EventBridge.");
    }

    /**
     * Creates a new SP-API subscription for the given notification type and destination,
     * or returns an existing subscription ID if one already exists.
     *
     * <p>The method builds a {@link CreateSubscriptionRequest} using the provided destination ID and
     * applies an {@link EventFilter} if required. It enforces rate limiting using a
     * {@link RateLimiter} (1 request/sec), and includes retry logic for transient errors (HTTP 429 or 5xx),
     * retrying up to 3 times with incremental backoff.</p>
     *
     * <p>If the subscription already exists (HTTP 409), it retrieves the existing subscription via
     * {@link #getExistingSubscription(NotificationsApi, String)}. If the rate limiter cannot acquire
     * a permit within 5 seconds, the request is skipped.</p>
     *
     * @param api The {@link NotificationsApi} client used to make subscription requests
     * @param destinationId The destination ID to which the subscription should be associated
     * @param notificationType The SP-API notification type (e.g., "ORDER_CHANGE")
     * @return The subscription ID of the newly created or existing subscription
     * @throws ApiException If subscription creation fails after retries or returns an unrecoverable error
     * @throws LWAException If Login With Amazon (LWA) authentication fails
     * @throws RuntimeException If rate limiting or retries are exhausted
     */
    private String getOrCreateSubscription(NotificationsApi api, String destinationId, String notificationType)
            throws ApiException, LWAException {

        final int maxRetries = 3;

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (!createSubscriptionRateLimiter.tryAcquire(5, TimeUnit.SECONDS)) {
                    throw new RuntimeException("RateLimiter timeout: createSubscription");
                }

                CreateSubscriptionRequest request = new CreateSubscriptionRequest()
                        .destinationId(destinationId)
                        .payloadVersion("1.0");

                if (EVENT_FILTER_REQUIRED_NOTIFICATION_TYPE.containsKey(notificationType)) {
                    request.setProcessingDirective(
                            new ProcessingDirective().eventFilter(
                                    new EventFilter().eventFilterType(EVENT_FILTER_REQUIRED_NOTIFICATION_TYPE.get(notificationType))));
                }

                return api.createSubscription(request, notificationType).getPayload().getSubscriptionId();

            } catch (ApiException e) {
                if (e.getCode() == 409) {
                    return getExistingSubscription(api, notificationType);
                } else if (attempt < maxRetries && (e.getCode() == 429 || e.getCode() >= 500)) {
                    try {
                        Thread.sleep(1000L * attempt);
                    } catch (InterruptedException ignored) {}
                    continue;
                }
                throw new RuntimeException("Failed to create subscription after attempt " + attempt + ": " + e.getMessage(), e);
            } catch (LWAException e) {
                throw new RuntimeException("LWA failed during subscription", e);
            }
        }

        throw new RuntimeException("Exceeded max retries for createSubscription");
    }


    /**
     * Retrieves an existing subscription for the specified notification type.
     *
     * <p>This is used as a fallback when a subscription creation attempt fails
     * due to an existing subscription (i.e., a conflict error with HTTP status 409).</p>
     *
     * @param api The {@link NotificationsApi} client used to retrieve the subscription
     * @param notificationType The SP-API notification type whose subscription is to be fetched
     * @return The existing subscription ID
     * @throws ApiException if the subscription cannot be retrieved
     * @throws LWAException if LWA (Login With Amazon) authentication fails
     */
    private String getExistingSubscription(NotificationsApi api, String notificationType) throws ApiException, LWAException {
        // Rate limited getSubscription
        getSubscriptionRateLimiter.acquire();
        return api.getSubscription(notificationType, null).getPayload().getSubscriptionId();
    }

    /**
     * Retrieves the list of notification types that require EventBridge integration.
     * <p>
     * The method expects a JSON string in the following format to be set in the environment
     * variable defined by {@code NOTIFICATION_TYPE_DEFINITION_ENV_VARIABLE}:
     * <pre>
     * {
     *   "EventBridge": [
     *     "BRANDED_ITEM_CONTENT_CHANGE",
     *     "ITEM_PRODUCT_TYPE_CHANGE",
     *     ...
     *   ],
     *   "Sqs": [
     *     "ANY_OFFER_CHANGED",
     *     ...
     *   ]
     * }
     * </pre>
     *
     * The method parses the JSON, extracts the {@code "EventBridge"} array, and returns
     * it as a list of strings.
     *
     * @return a list of notification types that require EventBridge routing
     * @throws NullPointerException if the environment variable is not set or invalid
     */
    private static List<String> getEventBridgeRequiredList() {
        // Parse JSON string
        JsonObject jsonObject = gson.fromJson(System.getenv(NOTIFICATION_TYPE_DEFINITION_ENV_VARIABLE), JsonObject.class);

        // Get EventBridge array
        JsonArray eventBridgeArray = jsonObject.getAsJsonArray("EventBridge");

        // Convert to List<String>
        List<String> eventBridgeList = new ArrayList<>();
        for (int i = 0; i < eventBridgeArray.size(); i++) {
            eventBridgeList.add(eventBridgeArray.get(i).getAsString());
        }
        return eventBridgeList;
    }
}
