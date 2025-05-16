package lambda.process.crossplatform;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSBatchResponse;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import com.google.gson.Gson;
import lambda.common.NotificationDestinationType;
import lambda.utils.*;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

import static lambda.common.Constants.*;


/**
 * Sample Lambda handler for processing ORDER_CHANGE notifications from SP-API via SQS.
 * This class demonstrates a typical use case of handling SP-API notifications in a serverless architecture.
 * Responsibilities:
 * - Checks the condition of ORDER_CHANGE notification.
 * - Retrieves ClientCredentials from DynamoDB using subscriptionId from the notification,
 *   and fetches secrets from AWS Secrets Manager.
 * - Uses OrdersV0 API to get order information and enrich the notification payload.
 * - Publishes the combined notification to a cross-platform destination (e.g., EventBridge, SQS, GCP Pub/Sub),
 *   defined via the CROSS_PLATFORM_DESTINATION_TYPE environment variable.
 * Intended for demonstration and customization purposes in cross-platform notification pipelines.
 */
public class SQSNotificationsOrderChangeHandler implements RequestHandler<SQSEvent, SQSBatchResponse> {

    public SQSBatchResponse handleRequest(SQSEvent input, Context context) {
        LambdaLogger logger = context.getLogger();

        String destinationEnv = System.getenv(CROSS_PLATFORM_DESTINATION_TYPE_ENV_VARIABLE);
        List<SQSBatchResponse.BatchItemFailure> batchItemFailures = new ArrayList<>();

        logger.log("ProcessNotification OrderChange　Lambda initiated: " +
                ZonedDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));

        NotificationDestinationType destinationType;
        try {
            destinationType = NotificationDestinationType.fromString(destinationEnv);
        } catch (IllegalArgumentException e) {
            logger.log("Invalid DESTINATION_TYPE: " + destinationEnv);
            throw new RuntimeException("Invalid CROSS_PLATFORM_DESTINATION_TYPE environment variable: " + destinationEnv, e);
        }

        for (SQSEvent.SQSMessage message : input.getRecords()) {
            try {
                logger.log("Notification: " + message.getBody());

                String combinedJson = OrderProcessUtils.prepareNotificationPayload(message, logger);
                if (combinedJson == null) {
                    logger.log("Combined JSON is null. Marking message ID as failed: " + message.getMessageId());
                    batchItemFailures.add(new SQSBatchResponse.BatchItemFailure(message.getMessageId()));
                    continue;
                }
                logger.log("Sending combined Notification Payload: " + combinedJson);

                CrossPlatformUtils.publishCrossPlatform(logger, destinationType, combinedJson);

                logger.log("Cross Platform message sent successfully. MessageId: " + message.getMessageId());
            } catch (Exception e) {
                logger.log("Failed to forward message ID: " + message.getMessageId() + ". Error: " + e.getMessage());
                batchItemFailures.add(new SQSBatchResponse.BatchItemFailure(message.getMessageId()));
            }
        }

        logger.log("ProcessNotification Lambda completed successfully. Total messages: " +
                input.getRecords().size() + ", Failures: " + batchItemFailures.size());

        return new SQSBatchResponse(batchItemFailures);
    }
}