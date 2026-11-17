package lambda.process.crossplatform;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSBatchResponse;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import com.google.gson.Gson;
import lambda.common.NotificationDestinationType;
import lambda.utils.CrossPlatformUtils;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

import static lambda.common.Constants.*;

/**
 * Generic Lambda handler for forwarding notifications received via SQS to a configured cross-platform destination.
 * This class is intended as a reusable sample that demonstrates how to:
 * - Receive SQS messages containing SP-API notifications
 * - Determine the destination type (EventBridge, SQS, GCP Pub/Sub, etc.) via environment variable
 * - Forward the raw message payload to the specified destination using CrossPlatformUtils
 * Behavior:
 * - Reads the destination type from the CROSS_PLATFORM_DESTINATION_TYPE environment variable
 * - Logs and forwards each incoming SQS message payload
 * Required environment variable:
 * - CROSS_PLATFORM_DESTINATION_TYPE: The target destination type ("AWS_SQS", "AWS_EVENTBRIDGE", "GCP_PUBSUB", etc.)
 * This sample is useful as a plug-and-play handler in cross-platform event forwarding scenarios.
 */

public class SQSNotificationsHandler implements RequestHandler<SQSEvent, SQSBatchResponse> {

    public SQSBatchResponse handleRequest(SQSEvent input, Context context) {
        LambdaLogger logger = context.getLogger();
        List<SQSBatchResponse.BatchItemFailure> batchItemFailures = new ArrayList<>();

        String destinationEnv = System.getenv(CROSS_PLATFORM_DESTINATION_TYPE_ENV_VARIABLE);

        logger.log("ProcessNotification Lambda initiated: " +
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
                String body = message.getBody();
                logger.log("Notification: " + body);

                CrossPlatformUtils.publishCrossPlatform(logger, destinationType, body);

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