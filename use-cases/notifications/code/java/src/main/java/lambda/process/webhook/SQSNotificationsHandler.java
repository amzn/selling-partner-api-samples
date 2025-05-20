package lambda.process.webhook;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSBatchResponse;
import com.google.gson.Gson;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import lambda.utils.WebHookUtils;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

import static lambda.common.Constants.*;


/**
 * Default handler for forwarding SP-API notifications received via SQS to a configured Webhook endpoint.
 * This class provides a minimal implementation that forwards each SQS message directly
 * to a Webhook URL using optional authentication headers.
 * Behavior:
 * - Iterates over all SQS messages
 * - Sends each message body to the WebHook endpoint defined by the WEB_HOOK_URL environment variable
 * - Adds authentication headers if provided
 * Required environment variables:
 * - WEB_HOOK_URL: Target webhook URL
 * - WEB_HOOK_AUTH_TOKEN (optional): Authorization token to include in the request
 * - WEB_HOOK_AUTH_HEADER_NAME (optional): Header name for the token (e.g., "Authorization")
 * This class is suitable as a default, pluggable handler for notification forwarding scenarios.
 */
public class SQSNotificationsHandler implements RequestHandler<SQSEvent, SQSBatchResponse> {

    private static final Gson gson = new Gson();

    public SQSBatchResponse handleRequest(SQSEvent input, Context context) {
        LambdaLogger logger = context.getLogger();
        List<SQSBatchResponse.BatchItemFailure> batchItemFailures = new ArrayList<>();

        logger.log("ProcessNotification Lambda initiated: " +
                ZonedDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));

        for (SQSEvent.SQSMessage message : input.getRecords()) {
            try {
                logger.log("Notification: " + message.getBody());

                WebHookUtils.sendWebhookRequest(message.getBody());

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