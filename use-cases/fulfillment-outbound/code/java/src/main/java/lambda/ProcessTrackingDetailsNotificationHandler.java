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
import lambda.utils.SPAPITrackingDetailsNotification;
import lambda.utils.OrderItem;
import lambda.utils.FulfillmentOrderStatusNotification;
import lambda.utils.TrackingDetailsStateMachineInput;

import java.util.UUID;

import static lambda.utils.Constants.REFRESH_TOKEN_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.REGION_CODE_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.STATE_MACHINE_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.NOTIFICATION_FULFILLMENT_ORDER_STATUS_EVENT_TYPE_ORDER;
import static lambda.utils.Constants.NOTIFICATION_FULFILLMENT_ORDER_STATUS_COMPLETE;
import static lambda.utils.Constants.NOTIFICATION_FULFILLMENT_ORDER_STATUS_EVENT_TYPE_SHIPMENT;

import java.io.IOException;

public class ProcessTrackingDetailsNotificationHandler implements RequestHandler<SQSEvent, String> {

    public String handleRequest(SQSEvent event, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("ProcessNotification Lambda started");

        //Iterate over SQS messages
        //Start a Step Functions workflow execution for unprocessed MCF orders
        for (SQSEvent.SQSMessage message : event.getRecords()) {
            logger.log(String.format("Received new notification: %s", message.getBody()));

            try {
                SPAPITrackingDetailsNotification notification = mapNotification(message.getBody());

                FulfillmentOrderStatusNotification fulfillmentOrderStatusNotification = notification.getPayload().getFulfillmentOrderStatusNotification();

                // If this is a notification that contains shipment information about an order, then start a stepfunction on that order
                // Else ignore
                if(isTargetNotification(fulfillmentOrderStatusNotification.getEventType(), fulfillmentOrderStatusNotification.getFulfillmentOrderStatus())) {

                    logger.log("Starting state machine execution");
                    String executionArn = startStepFunctionsExecution(fulfillmentOrderStatusNotification, context);
                    logger.log(String.format("State machine successfully started. Execution arn: %s", executionArn));

                } else {
                    logger.log("Notification is skipped");
                }

            } catch (JsonProcessingException e) {
                logger.log(String.format("Message body could not be mapped to a SP-API Notification: %s", e.getMessage()));
            } catch (IOException e) {
                logger.log(String.format("Message body could not be mapped to a SP-API Notification: %s", e.getMessage()));
            }
        }

        return "Finished processing incoming notifications";
    }

    private SPAPITrackingDetailsNotification mapNotification(String notificationBody) throws JsonProcessingException, IOException {
        ObjectMapper mapper = new ObjectMapper();
        SPAPITrackingDetailsNotification notification = mapper.readValue(notificationBody, SPAPITrackingDetailsNotification.class);

        return notification;
    }

    // If the event is about a shipment, or about a complete order, we know the order has associated package information
    // https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide#fulfillmentorderstatusnotification
    private boolean isTargetNotification(String eventType, String fulfillmentOrderStatus) {
        return NOTIFICATION_FULFILLMENT_ORDER_STATUS_EVENT_TYPE_SHIPMENT.equals(eventType) || 
            (NOTIFICATION_FULFILLMENT_ORDER_STATUS_EVENT_TYPE_ORDER.equals(eventType)
                    && NOTIFICATION_FULFILLMENT_ORDER_STATUS_COMPLETE.equals(fulfillmentOrderStatus));

    }

    private String startStepFunctionsExecution(FulfillmentOrderStatusNotification fulfillmentOrderStatusNotification, Context context) throws JsonProcessingException {
        LambdaLogger logger = context.getLogger();
        ObjectMapper mapper = new ObjectMapper();
        TrackingDetailsStateMachineInput input = getTrackingDetailsStateMachineInput(fulfillmentOrderStatusNotification);
        String inputStr = mapper.writeValueAsString(input);
        logger.log(String.format("State machine Input: %s", inputStr));

        StartExecutionRequest request = StartExecutionRequest.builder()
            .stateMachineArn(System.getenv(STATE_MACHINE_ARN_ENV_VARIABLE))
            .name(String.format("%s-%s", fulfillmentOrderStatusNotification.getSellerFulfillmentOrderId(), UUID.randomUUID()))
            .input(inputStr)
            .build();

        SfnClient stepFunctions = SfnClient.builder().build();
        StartExecutionResponse result = stepFunctions.startExecution(request);

        return result.executionArn();
    }

    private TrackingDetailsStateMachineInput getTrackingDetailsStateMachineInput(FulfillmentOrderStatusNotification fulfillmentOrderStatusNotification) {
        return TrackingDetailsStateMachineInput.builder()
                .sellerFulfillmentOrderId(fulfillmentOrderStatusNotification.getSellerFulfillmentOrderId())
                .refreshToken(System.getenv(REFRESH_TOKEN_ARN_ENV_VARIABLE))
                .regionCode(System.getenv(REGION_CODE_ARN_ENV_VARIABLE))
                .build();
    }
}
