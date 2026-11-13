package lambda.process.webhook;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSBatchResponse;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import lambda.utils.OrderProcessUtils;
import lambda.utils.WebHookUtils;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;


/**
 * Sample Lambda handler for processing ORDER_CHANGE notifications from SP-API via SQS.
 * This class demonstrates a typical use case of handling SP-API notifications in a serverless architecture.
 * Responsibilities:
 * - Checks the condition of ORDER_CHANGE notification.
 * - Retrieves ClientCredentials from DynamoDB using subscriptionId from the notification,
 *   and fetches secrets from AWS Secrets Manager.
 * - Uses OrdersV0 API to get order information and enrich the notification payload.
 * - Publishes the combined notification to a web-hook destination defined at the app-config.json
 * Intended for demonstration and customization purposes in web-hook notification pipelines.
 */
public class SQSNotificationsOrderChangeHandler implements RequestHandler<SQSEvent, SQSBatchResponse> {

    public SQSBatchResponse handleRequest(SQSEvent input, Context context) {
        LambdaLogger logger = context.getLogger();
        List<SQSBatchResponse.BatchItemFailure> batchItemFailures = new ArrayList<>();

        logger.log("ProcessNotification OrderChange　Lambda initiated: " +
                ZonedDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));

        for (SQSEvent.SQSMessage message : input.getRecords()) {
            try {
                logger.log("Notification: " + message.getBody());
                // Customize logic for ORDER_CHANGE
                String combinedJson = OrderProcessUtils.prepareNotificationPayload(message, logger);
                if (combinedJson == null) {
                    logger.log("Combined JSON is null. Marking message ID as failed: " + message.getMessageId());
                    batchItemFailures.add(new SQSBatchResponse.BatchItemFailure(message.getMessageId()));
                    continue;
                }

                logger.log("Sending combined Notification Payload: " + combinedJson);

                // Send to Web Hook
                WebHookUtils.sendWebhookRequest(combinedJson);

                logger.log("Webhook sent successfully. MessageId: " + message.getMessageId());
            } catch (Exception e) {
                logger.log("Failed to send webhook: " + e.getMessage());
                batchItemFailures.add(new SQSBatchResponse.BatchItemFailure(message.getMessageId()));
            }
        }

        logger.log("ProcessNotification Lambda completed successfully. Total messages: " +
                input.getRecords().size() + ", Failures: " + batchItemFailures.size());

        return new SQSBatchResponse(batchItemFailures);
    }
}