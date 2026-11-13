package lambda.process.internal.orderchange;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSBatchResponse;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import com.amazonaws.services.stepfunctions.AWSStepFunctions;
import com.amazonaws.services.stepfunctions.AWSStepFunctionsClientBuilder;
import com.amazonaws.services.stepfunctions.model.StartExecutionRequest;
import com.amazonaws.services.stepfunctions.model.StartExecutionResult;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import lambda.utils.OrderProcessUtils;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

import static lambda.common.Constants.STATE_MACHINE_ARN_ORDERNOTIFICATION_ENV_VARIABLE;
import static lambda.utils.OrderProcessUtils.buildInputForStepFunction;


public class SQSNotificationsOrderChangeHandler implements RequestHandler<SQSEvent, SQSBatchResponse> {

    private static final AWSStepFunctions stepFunctionsClient = AWSStepFunctionsClientBuilder.defaultClient();
    private static final Gson gson = new Gson();

    /**
     * A sample AWS Lambda function that processes SQS messages containing SP-API ORDER_CHANGE notifications.
     * <p>
     * For each message in the batch:
     * - Parses and validates the message body
     * - Applies filtering logic (e.g., skip if order status is not actionable)
     * - If valid, triggers an AWS Step Functions state machine execution
     * - Records any failures for partial batch retry using SQS partial batch response
     *
     * <p>
     * Required Environment Variable:
     * - STATE_MACHINE_ARN_ORDERNOTIFICATION: ARN of the Step Functions state machine to trigger
     */
    public SQSBatchResponse handleRequest(SQSEvent input, Context context) {
        LambdaLogger logger = context.getLogger();
        List<SQSBatchResponse.BatchItemFailure> batchItemFailures = new ArrayList<>();

        logger.log("ProcessNotification OrderChange Lambda initiated: " +
                ZonedDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));

        String stateMachineArn = System.getenv(STATE_MACHINE_ARN_ORDERNOTIFICATION_ENV_VARIABLE);

        for (SQSEvent.SQSMessage message : input.getRecords()) {
            try {
                logger.log("Notification received: " + message.getBody());

                JsonObject body = OrderProcessUtils.parseSqsMessageBody(message);

                // Check the condition of ORDER_CHANGE notification
                if (!OrderProcessUtils.shouldProcessOrderNotification(body, logger)) {
                    logger.log("Processing skipped due to order status. Marking message ID as skipped: " + message.getMessageId());
                    continue;
                }

                // Determine whether this message should trigger further processing.
                // Includes checks for duplication, order status, or other business-specific criteria.
                if (!OrderProcessUtils.shouldTriggerProcessing(body, logger)) {
                    logger.log("Message did not meet processing criteria. Skipping. MessageId: " + message.getMessageId());
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

            } catch (Exception e) {
                logger.log("Failed to prepare custom message for MessageId: " + message.getMessageId() +
                        ". Error: " + e.getMessage());
                batchItemFailures.add(new SQSBatchResponse.BatchItemFailure(message.getMessageId()));
            }
        }

        logger.log("ProcessNotification OrderChange Lambda completed. Total: " +
                input.getRecords().size() + ", Failures: " + batchItemFailures.size());

        return new SQSBatchResponse(batchItemFailures);
    }
}
