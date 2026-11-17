package lambda.process.internal.orderchange;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.stepfunctions.AWSStepFunctions;
import com.amazonaws.services.stepfunctions.AWSStepFunctionsClientBuilder;
import com.amazonaws.services.stepfunctions.model.StartExecutionRequest;
import com.amazonaws.services.stepfunctions.model.StartExecutionResult;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import lambda.utils.OrderProcessUtils;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.DeleteMessageRequest;
import software.amazon.awssdk.services.sqs.model.Message;
import software.amazon.awssdk.services.sqs.model.ReceiveMessageRequest;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static lambda.common.Constants.*;
import static lambda.utils.OrderProcessUtils.buildInputForStepFunction;
import static lambda.utils.SqsMessageAdapter.toLambdaSQSMessage;

public class SQSReprocessOrderChangeHandler implements RequestHandler<Object, String> {

    private static final SqsClient sqsClient = SqsClient.create();
    private static final AWSStepFunctions stepFunctionsClient = AWSStepFunctionsClientBuilder.defaultClient();
    private static final Gson gson = new Gson();

    /**
     * A sample AWS Lambda function that reprocesses failed SP-API order notifications from a Dead Letter Queue (DLQ).
     * <p>
     * For each message in the DLQ:
     * - Validates whether it should be processed again (e.g., based on order status or duplication check)
     * - Builds input for the Step Functions execution
     * - Starts the execution
     * - Deletes the message if processing was successful
     *
     * <p>
     * Environment Variables Required:
     * - DLQ_SQS_URL: URL of the SQS DLQ
     * - STATE_MACHINE_ARN_ORDERNOTIFICATION: ARN of the Step Functions state machine to execute
     */
    public String handleRequest(Object input, Context context) {
        LambdaLogger logger = context.getLogger();

        String queueUrl = System.getenv(DLQ_SQS_URL_ENV_VARIABLE);
        String stateMachineArn = System.getenv(STATE_MACHINE_ARN_ORDERNOTIFICATION_ENV_VARIABLE);

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

                    JsonObject body = OrderProcessUtils.parseSqsMessageBody(toLambdaSQSMessage(message));

                    // Check the condition of ORDER_CHANGE notification
                    if (!OrderProcessUtils.shouldProcessOrderNotification(body, logger)) {
                        logger.log("Processing skipped due to order status. Marking message ID as skipped: " + message.messageId());
                        continue;
                    }

                    // Determine whether this message should trigger further processing.
                    // Includes checks for duplication, order status, or other business-specific criteria.
                    if (!OrderProcessUtils.shouldTriggerProcessing(body, logger)) {
                        logger.log("Message did not meet processing criteria. Skipping. MessageId: " + message.messageId());
                        continue;
                    }

                    Map<String, Object> inputForStepFunction = buildInputForStepFunction(body);

                    // Execute stepFunctions
                    StartExecutionRequest request = new StartExecutionRequest()
                            .withStateMachineArn(stateMachineArn)
                            .withInput(gson.toJson(inputForStepFunction))
                            .withName("execution-" + UUID.randomUUID());

                    StartExecutionResult result = stepFunctionsClient.startExecution(request);
                    logger.log("Step Function started. Execution ARN: " + result.getExecutionArn());

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
