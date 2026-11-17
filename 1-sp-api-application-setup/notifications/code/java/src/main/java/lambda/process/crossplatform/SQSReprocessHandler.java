package lambda.process.crossplatform;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import lambda.common.NotificationDestinationType;
import lambda.utils.CrossPlatformUtils;
import lambda.utils.WebHookUtils;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.DeleteMessageRequest;
import software.amazon.awssdk.services.sqs.model.Message;
import software.amazon.awssdk.services.sqs.model.ReceiveMessageRequest;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import static lambda.common.Constants.*;
import static lambda.utils.SqsMessageAdapter.extractDetailIfEventBridge;

/**
 * Handler for manually reprocessing all messages from a DLQ SQS queue and posting them to a configured Webhook endpoint.
 */
public class SQSReprocessHandler implements RequestHandler<Object, String> {

    private static final SqsClient sqsClient = SqsClient.create();

    public String handleRequest(Object input, Context context) {
        LambdaLogger logger = context.getLogger();

        String destinationEnv = System.getenv(CROSS_PLATFORM_DESTINATION_TYPE_ENV_VARIABLE);
        String queueUrl = System.getenv(DLQ_SQS_URL_ENV_VARIABLE);

        logger.log("Reprocess Cross Platform publisher Lambda initiated: " +
                ZonedDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));

        NotificationDestinationType destinationType;
        try {
            destinationType = NotificationDestinationType.fromString(destinationEnv);
        } catch (IllegalArgumentException e) {
            logger.log("Invalid DESTINATION_TYPE: " + destinationEnv);
            return "Invalid destination type: " + destinationEnv;
        }

        int successCount = 0;
        int failureCount = 0;

        while (true) {
            ReceiveMessageRequest receiveRequest = ReceiveMessageRequest.builder()
                    .queueUrl(queueUrl)
                    .maxNumberOfMessages(BATCH_SIZE)
                    .waitTimeSeconds(2)
                    .build();

            List<Message> messages = sqsClient.receiveMessage(receiveRequest).messages();
            if (messages.isEmpty()) {
                logger.log("No more messages found. Exiting reprocessing loop.");
                break;
            }

            for (Message message : messages) {
                try {
                    logger.log("Reprocessing MessageId: " + message.messageId());

                    String payloadToSend = extractDetailIfEventBridge(message.body(), logger);

                    CrossPlatformUtils.publishCrossPlatform(logger, destinationType, payloadToSend);

                    DeleteMessageRequest deleteRequest = DeleteMessageRequest.builder()
                            .queueUrl(queueUrl)
                            .receiptHandle(message.receiptHandle())
                            .build();
                    sqsClient.deleteMessage(deleteRequest);

                    logger.log("Cross Platform publisher reprocessing successful for MessageId: " + message.messageId());
                    successCount++;
                } catch (Exception e) {
                    logger.log("Webhook reprocessing failed for MessageId: " + message.messageId() +
                            " Error: " + e.getMessage());
                    failureCount++;
                }
            }
        }

        String resultSummary = String.format("Reprocessing complete. Success: %d, Failure: %d", successCount, failureCount);
        logger.log(resultSummary);
        return resultSummary;
    }
}
