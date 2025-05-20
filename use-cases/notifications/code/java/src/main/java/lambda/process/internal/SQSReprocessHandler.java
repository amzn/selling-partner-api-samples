package lambda.process.internal;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import lambda.utils.WebHookUtils;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.DeleteMessageRequest;
import software.amazon.awssdk.services.sqs.model.Message;
import software.amazon.awssdk.services.sqs.model.ReceiveMessageRequest;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import static lambda.common.Constants.DLQ_SQS_URL_ENV_VARIABLE;
import static lambda.utils.SqsMessageAdapter.extractDetailIfEventBridge;

/**
 * Handler for manually reprocessing all messages from a DLQ SQS queue and posting them to a configured Webhook endpoint.
 */
public class SQSReprocessHandler implements RequestHandler<Object, String> {

    private static final SqsClient sqsClient = SqsClient.create();
    private static final int BATCH_SIZE = 10;

    public String handleRequest(Object input, Context context) {
        LambdaLogger logger = context.getLogger();

        String queueUrl = System.getenv(DLQ_SQS_URL_ENV_VARIABLE);

        logger.log("ReprocessLambda initiated: " +
                ZonedDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));

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

                    String payloadJson = extractDetailIfEventBridge(message.body(), logger);

                    logger.log("Received DLQ notification: " + payloadJson);

                    DeleteMessageRequest deleteRequest = DeleteMessageRequest.builder()
                            .queueUrl(queueUrl)
                            .receiptHandle(message.receiptHandle())
                            .build();
                    sqsClient.deleteMessage(deleteRequest);

                    successCount++;
                } catch (Exception e) {
                    logger.log("Logging DLQ message failed for MessageId: " + message.messageId() +
                            " Error: " + e.getMessage());
                    failureCount++;
                }
            }
        }

        String resultSummary = String.format("Logging DLQ message complete. Success: %d, Failure: %d", successCount, failureCount);
        logger.log(resultSummary);
        return resultSummary;
    }
}
