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
import lambda.utils.OrderChangeNotification;
import lambda.utils.NotificationOrderSummary;
import lambda.utils.SPAPINotification;
import lambda.utils.StateMachineInput;

import java.io.IOException;
import java.util.UUID;

import static lambda.utils.Constants.MFN_FULFILLMENT_CODE;
import static lambda.utils.Constants.NOTIFICATION_LEVEL_ORDER_LEVEL;
import static lambda.utils.Constants.NOTIFICATION_PROCESSING_STATUS_ALL;
import static lambda.utils.Constants.NOTIFICATION_TYPE_ORDER_CHANGE;
import static lambda.utils.Constants.REFRESH_TOKEN_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.REGION_CODE_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.STATE_MACHINE_ARN_ENV_VARIABLE;

public class ProcessNotificationHandler implements RequestHandler<SQSEvent, String> {

    public String handleRequest(SQSEvent event, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("ProcessNotification Lambda started");

        //Iterate over SQS messages
        //Start a Step Functions workflow execution for unprocessed MFN orders
        for (SQSEvent.SQSMessage message : event.getRecords()) {
            logger.log(String.format("Received new notification: %s", message.getBody()));

            try {
                SPAPINotification notification = mapNotification(message.getBody());

                if (!NOTIFICATION_TYPE_ORDER_CHANGE.equals(notification.getNotificationType())) {
                    logger.log(String.format("Notification type %s skipped", notification.getNotificationType()));
                    continue;
                }

                OrderChangeNotification orderNotification = notification.getPayload().getOrderChangeNotification();
                if (!NOTIFICATION_LEVEL_ORDER_LEVEL.equals(orderNotification.getNotificationLevel())) {
                    logger.log(String.format("Notification level %s skipped", orderNotification.getNotificationLevel()));
                    continue;
                }

                NotificationOrderSummary orderSummary = orderNotification.getSummary();

                //If the order is MFN and has not been processed, start a workflow execution
                if (MFN_FULFILLMENT_CODE.equals(orderSummary.getFulfillmentType())
                        && NOTIFICATION_PROCESSING_STATUS_ALL.contains(orderSummary.getOrderStatus())) {

                    logger.log("Starting state machine execution");
                    String executionArn = startStepFunctionsExecution(orderNotification);
                    logger.log(String.format("State machine successfully started. Execution arn: %s", executionArn));
                } else {
                    logger.log(String.format("Order channel %s and status %s skipped",
                            orderSummary.getFulfillmentType(),
                            orderSummary.getOrderStatus()));
                }
            } catch (IOException e) {
                logger.log(String.format("Message body could not be mapped to a SP-API Notification: %s", e.getMessage()));
            }
        }

        return "Finished processing incoming notifications";
    }

    private SPAPINotification mapNotification(String notificationBody) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        SPAPINotification notification = mapper.readValue(notificationBody, SPAPINotification.class);

        return notification;
    }

    private String startStepFunctionsExecution(OrderChangeNotification orderNotification) throws JsonProcessingException {
        ObjectMapper mapper = new ObjectMapper();
        StateMachineInput input = getStateMachineInput(orderNotification);
        String inputStr = mapper.writeValueAsString(input);

        StartExecutionRequest request = StartExecutionRequest.builder()
                .stateMachineArn(System.getenv(STATE_MACHINE_ARN_ENV_VARIABLE))
                .name(String.format("%s-%s", orderNotification.getAmazonOrderId(), UUID.randomUUID()))
                .input(inputStr)
                .build();

        SfnClient stepFunctions = SfnClient.builder().build();
        StartExecutionResponse result = stepFunctions.startExecution(request);

        return result.executionArn();
    }

    private StateMachineInput getStateMachineInput(OrderChangeNotification orderNotification) {
        return StateMachineInput.builder()
                .orderId(orderNotification.getAmazonOrderId())
                .refreshToken(System.getenv(REFRESH_TOKEN_ARN_ENV_VARIABLE))
                .regionCode(System.getenv(REGION_CODE_ARN_ENV_VARIABLE))
                .build();
    }
}
