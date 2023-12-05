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
import lambda.utils.SPAPICreateNotification;
import lambda.utils.CreateOrderStateMachineInput;
import lambda.utils.CreateFulfillmentOrderNotification;
import lambda.utils.OrderItem;

import java.util.UUID;

import static lambda.utils.Constants.REFRESH_TOKEN_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.REGION_CODE_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.STATE_MACHINE_ARN_ENV_VARIABLE;

import java.io.IOException;

public class ProcessNotificationHandler implements RequestHandler<SQSEvent, String> {

    public String handleRequest(SQSEvent event, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("ProcessNotification Lambda started");

        //Iterate over SQS messages
        //Start a Step Functions workflow execution for unprocessed MCF orders
        for (SQSEvent.SQSMessage message : event.getRecords()) {
            logger.log(String.format("Received new notification: %s", message.getBody()));

            try {
                SPAPICreateNotification notification = mapNotification(message.getBody());

                CreateFulfillmentOrderNotification createFulfillmentOrderNotification = notification.getPayload().getCreateFulfillmentOrderNotification();

                logger.log("Starting state machine execution");
                String executionArn = startStepFunctionsExecution(createFulfillmentOrderNotification, context);
                logger.log(String.format("State machine successfully started. Execution arn: %s", executionArn));

            } catch (JsonProcessingException e) {
                logger.log(String.format("Message body could not be mapped to a SP-API Notification: %s", e.getMessage()));
            } catch (IOException e) {
                logger.log(String.format("Message body could not be mapped to a SP-API Notification: %s", e.getMessage()));
            }
        }

        return "Finished processing incoming notifications";
    }

    private SPAPICreateNotification mapNotification(String notificationBody) throws JsonProcessingException, IOException {
        ObjectMapper mapper = new ObjectMapper();
        SPAPICreateNotification notification = mapper.readValue(notificationBody, SPAPICreateNotification.class);

        return notification;
    }

    private String startStepFunctionsExecution(CreateFulfillmentOrderNotification createFulfillmentOrderNotification, Context context) throws JsonProcessingException {
        LambdaLogger logger = context.getLogger();
        ObjectMapper mapper = new ObjectMapper();
        CreateOrderStateMachineInput input = getCreateOrderStateMachineInput(createFulfillmentOrderNotification);
        String inputStr = mapper.writeValueAsString(input);
        logger.log(String.format("State machine Input: %s", inputStr));

        StartExecutionRequest request = StartExecutionRequest.builder()
                .stateMachineArn(System.getenv(STATE_MACHINE_ARN_ENV_VARIABLE))
                .name(String.format("%s-%s", createFulfillmentOrderNotification.getSellerFulfillmentOrderId(), UUID.randomUUID()))
                .input(inputStr)
                .build();

        SfnClient stepFunctions = SfnClient.builder().build();
        StartExecutionResponse result = stepFunctions.startExecution(request);

        return result.executionArn();
    }

    private CreateOrderStateMachineInput getCreateOrderStateMachineInput(CreateFulfillmentOrderNotification createFulfillmentOrderNotification) {
        return CreateOrderStateMachineInput.builder()
                .createFulfillmentOrderNotification(createFulfillmentOrderNotification)
                .refreshToken(System.getenv(REFRESH_TOKEN_ARN_ENV_VARIABLE))
                .regionCode(System.getenv(REGION_CODE_ARN_ENV_VARIABLE))
                .build();
    }
}
