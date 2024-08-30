package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import lambda.utils.AnyOfferChanged.AnyOfferChangedNotification;
import lambda.utils.AnyOfferChanged.AnyOfferChangedNotificationPayload;
import lambda.utils.PricingHealth.PricingHealthNotification;
import lambda.utils.PricingHealth.PricingHealthNotificationPayload;
import lambda.utils.PricingNotification;
import lambda.utils.SPAPINotification;
import software.amazon.awssdk.services.sfn.SfnClient;
import software.amazon.awssdk.services.sfn.model.StartExecutionRequest;
import software.amazon.awssdk.services.sfn.model.StartExecutionResponse;

import java.io.IOException;
import java.util.UUID;

import static lambda.utils.Constants.*;

public class ProcessNotificationHandler implements RequestHandler<SQSEvent, String> {

    public String handleRequest(SQSEvent input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("ProcessNotification Lambda input: " + new Gson().toJson(input));

        //Iterate over SQS messages
        //Start a Step Functions workflow execution for every Any Offer Changed notifications
        for (SQSEvent.SQSMessage message : input.getRecords()) {
            logger.log(String.format("Notification body: %s", message.getBody()));

            try {
                SPAPINotification notification = mapNotification(message.getBody());

                switch (notification.getNotificationType()) {
                    case NOTIFICATION_TYPE_ANY_OFFER_CHANGED:
                        AnyOfferChangedNotification anyOfferChangedNotification = parseAnyOfferChangedNotification(message.getBody());
                        processAnyOfferChangeNotification(anyOfferChangedNotification.getPayload().getAnyOfferChangedNotificationPayload(), logger);
                        break;
                    case NOTIFICATION_TYPE_PRICING_HEALTH:
                        PricingHealthNotification pricingHealthNotification = parsePricingHealthNotification(message.getBody());
                        processPricingHealthNotification(pricingHealthNotification.getPricingHealthNotificationPayload(), logger);
                        break;
                    default:
                        logger.log(String.format("Notification type %s skipped", notification.getNotificationType()));
                }

            } catch (Exception e) {
                throw new InternalError("ProcessNotification Lambda failed", e);
            }
        }

        return "Finished processing incoming notifications";
    }

    private void processPricingHealthNotification(PricingHealthNotificationPayload notificationPayload, LambdaLogger logger) throws JsonProcessingException {
        logger.log("Starting state machine execution");
        String executionArn = startStepFunctionsExecution(notificationPayload);

        logger.log(String.format("State machine successfully started. Execution arn: %s", executionArn));
    }

    private void processAnyOfferChangeNotification(AnyOfferChangedNotificationPayload anyOfferChangedNotificationPayload, LambdaLogger logger) throws JsonProcessingException {
        // Only process the AOC notification if it is of type 'Internal' or 'FeaturedOffer'
        if (!PRICE_CHANGE_OFFER_CHANGE_TYPES.contains(anyOfferChangedNotificationPayload.getOfferChangeTrigger().getOfferChangeType())) {
            logger.log(String.format("Offer change type %s skipped", anyOfferChangedNotificationPayload.getOfferChangeTrigger().getOfferChangeType()));
            return;
        }

        logger.log("Starting state machine execution");
        String executionArn = startStepFunctionsExecution(anyOfferChangedNotificationPayload);

        logger.log(String.format("State machine successfully started. Execution arn: %s", executionArn));
    }

    private SPAPINotification mapNotification(String notificationBody) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        //schema differ from one notification to another. E.g NotificationType in AnyOfferChange vs notificationType in PricingHealth.
        //we accept case-insensitive properties to identify the notification type.
        mapper.configure(MapperFeature.ACCEPT_CASE_INSENSITIVE_PROPERTIES, true);

        SPAPINotification notification = mapper.readValue(notificationBody, SPAPINotification.class);

        return notification;
    }

    private AnyOfferChangedNotification parseAnyOfferChangedNotification(String notificationBody) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        return mapper.readValue(notificationBody, AnyOfferChangedNotification.class);
    }

    private PricingHealthNotification parsePricingHealthNotification(String notificationBody) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        return mapper.readValue(notificationBody, PricingHealthNotification.class);
    }

    private String startStepFunctionsExecution(PricingNotification pricingNotification) throws JsonProcessingException {
        ObjectMapper mapper = new ObjectMapper();
        String inputStr = pricingNotification.mapToPricingStateMachineInput();

        StartExecutionRequest request = StartExecutionRequest.builder()
                .stateMachineArn(System.getenv(STATE_MACHINE_ARN_ENV_VARIABLE))
                .name(String.format("%s-%s-%s",
                        pricingNotification.getSellerId(),
                        pricingNotification.getAsin(),
                        UUID.randomUUID()))
                .input(inputStr)
                .build();

        SfnClient stepFunctions = SfnClient.builder().build();
        StartExecutionResponse result = stepFunctions.startExecution(request);

        return result.executionArn();
    }
}
