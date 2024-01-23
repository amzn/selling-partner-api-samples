package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import software.amazon.awssdk.services.sfn.SfnClient;
import software.amazon.awssdk.services.sfn.model.StartExecutionRequest;
import software.amazon.awssdk.services.sfn.model.StartExecutionResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lambda.utils.NotificationOrderSummary;
import lambda.utils.SPAPICancelNotification;
import lambda.utils.CancelOrderStateMachineInput;
import lambda.utils.CancelFulfillmentOrderNotification;
import lambda.utils.OrderItem;

import java.util.UUID;

import static lambda.utils.Constants.REFRESH_TOKEN_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.REGION_CODE_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.STATE_MACHINE_ARN_ENV_VARIABLE;

import java.io.IOException;

public class ProcessCancelNotificationHandler implements RequestHandler<SQSEvent, String> {

    public String handleRequest(SQSEvent event, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("ProcessNotification Lambda started");

        //Iterate over SQS messages
        //Start a Step Functions workflow execution for each unprocessed message
        for (SQSEvent.SQSMessage message : event.getRecords()) {
            logger.log(String.format("Received new notification: %s", message.getBody()));

            try {
                SPAPICancelNotification notification = mapNotification(message.getBody());

                CancelFulfillmentOrderNotification cancelFulfillmentOrderNotification = notification.getPayload().getCancelFulfillmentOrderNotification();
                
                logger.log("Starting state machine execution");
                String executionArn = startStepFunctionsExecution(cancelFulfillmentOrderNotification, context);
                logger.log(String.format("State machine successfully started. Execution arn: %s", executionArn));

            } catch (JsonProcessingException e) {
                logger.log(String.format("Message body could not be mapped to a SP-API Notification: %s", e.getMessage()));
            } catch (IOException e) {
                logger.log(String.format("Message body could not be mapped to a SP-API Notification: %s", e.getMessage()));
            }
        }

        return "Finished processing incoming notifications";
    }

    private SPAPICancelNotification mapNotification(String notificationBody) throws JsonProcessingException, IOException {
        ObjectMapper mapper = new ObjectMapper();
        SPAPICancelNotification notification = mapper.readValue(notificationBody, SPAPICancelNotification.class);

        return notification;
    }

    private String startStepFunctionsExecution(CancelFulfillmentOrderNotification cancelFulfillmentOrderNotification, Context context) throws JsonProcessingException {
        LambdaLogger logger = context.getLogger();
        ObjectMapper mapper = new ObjectMapper();

        CancelOrderStateMachineInput input = getCancelOrderStateMachineInput(cancelFulfillmentOrderNotification, logger);
        String inputStr = mapper.writeValueAsString(input);
        logger.log(String.format("State machine Input: %s", inputStr));

        StartExecutionRequest request = StartExecutionRequest.builder()
            .stateMachineArn(System.getenv(STATE_MACHINE_ARN_ENV_VARIABLE))
            .name(String.format("%s-%s", cancelFulfillmentOrderNotification.getSellerFulfillmentOrderId(), UUID.randomUUID()))
            .input(inputStr)
            .build();

        SfnClient stepFunctions = SfnClient.builder().build();
        StartExecutionResponse result = stepFunctions.startExecution(request);

        return result.executionArn();
    }

    private CancelOrderStateMachineInput getCancelOrderStateMachineInput(CancelFulfillmentOrderNotification cancelFulfillmentOrderNotification, LambdaLogger logger) {
        return CancelOrderStateMachineInput.builder()
                .cancelFulfillmentOrderNotification(cancelFulfillmentOrderNotification)
                .refreshToken(System.getenv(REFRESH_TOKEN_ARN_ENV_VARIABLE))
                .regionCode(System.getenv(REGION_CODE_ARN_ENV_VARIABLE))
                .build();
    }
}

