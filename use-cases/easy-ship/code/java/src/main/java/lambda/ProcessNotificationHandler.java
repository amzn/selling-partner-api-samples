package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import lambda.utils.ApiCredentials;
import lambda.utils.OrderChangeNotification;
import lambda.utils.SPAPINotification;
import lambda.utils.StateMachineInput;
import software.amazon.awssdk.services.sfn.SfnClient;
import software.amazon.awssdk.services.sfn.model.StartExecutionRequest;
import software.amazon.awssdk.services.sfn.model.StartExecutionResponse;

import java.io.IOException;
import java.util.UUID;

import static lambda.utils.Constants.*;
import static lambda.utils.Constants.REFRESH_TOKEN_KEY_NAME;

public class ProcessNotificationHandler implements RequestHandler<SQSEvent, String> {

    public String handleRequest(SQSEvent input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("ProcessNotification Lambda input: " + new Gson().toJson(input));

        //Iterate over SQS messages
        //Start a Step Functions workflow execution for Order Change notifications
        for (SQSEvent.SQSMessage message : input.getRecords()) {
            logger.log(String.format("Notification body: %s", message.getBody()));

            try {
                SPAPINotification notification = mapNotification(message.getBody());
                logger.log(String.format("Notification body: %s", notification.getPayload().getOrderChangeNotification().getSummary().toString()));

                // Only process the notification if it is of type 'ORDER_CHANGE'
                if (!NOTIFICATION_TYPE_ORDER_CHANGE.equals(notification.getNotificationType())) {
                    logger.log(String.format("Notification type %s skipped", notification.getNotificationType()));
                    continue;
                }

                OrderChangeNotification orderChangeNotification = notification.getPayload().getOrderChangeNotification();

                // Only process the notification is OrderLevel
                if (!orderChangeNotification.getNotificationLevel().equals(NOTIFICATION_LEVEL_ORDER_LEVEL)) {
                    logger.log(String.format("Notification level %s skipped", orderChangeNotification.getNotificationLevel()));
                    continue;
                }

                // Skip if order status is 'Pending'
                if (orderChangeNotification.getSummary().getOrderStatus().equals(NOTIFICATION_IGNORE_ORDER_STATUS)) {
                    logger.log("This event is skipped due to Pending order status");
                    continue;
                }

                // TODO: We might need to call orderAPI to confirm if the order is EasyShip or not
                String executionArn = startStepFunctionsExecution(orderChangeNotification);
                logger.log(String.format("State machine successfully started. Execution arn: %s", executionArn));

            } catch (Exception e) {
                throw new InternalError("ProcessNotification Lambda failed", e);
            }
        }

        return "Finished processing incoming notifications";
    }

    private SPAPINotification mapNotification(String notificationBody) throws IOException {
        Gson gson = new Gson();
        return gson.fromJson(notificationBody, SPAPINotification.class);
    }

    private String startStepFunctionsExecution(OrderChangeNotification orderChangeNotification) throws JsonProcessingException {
        ObjectMapper mapper = new ObjectMapper();
        StateMachineInput input = getStateMachineInput(orderChangeNotification);
        String inputStr = mapper.writeValueAsString(input);

        StartExecutionRequest request = StartExecutionRequest.builder()
                .stateMachineArn(System.getenv(STATE_MACHINE_ARN_ENV_VARIABLE))
                .name(String.format("%s-%s",
                        orderChangeNotification.getAmazonOrderId(),
                        UUID.randomUUID()))
                .input(inputStr)
                .build();

        SfnClient stepFunctions = SfnClient.builder().build();
        StartExecutionResponse result = stepFunctions.startExecution(request);

        return result.executionArn();
    }

    private StateMachineInput getStateMachineInput(OrderChangeNotification orderChangeNotification) {
        String regionCode = System.getenv(REGION_CODE_KEY_NAME);
        String refreshToken = System.getenv(REFRESH_TOKEN_KEY_NAME);
        return  StateMachineInput.builder()
                .apiCredentials(ApiCredentials.builder()
                        .regionCode(regionCode)
                        .refreshToken(refreshToken)
                        .build())
                .amazonOrderId(orderChangeNotification.getAmazonOrderId())
                .marketplaceId(orderChangeNotification.getSummary().getMarketplaceID())
                .build();
    }
}
