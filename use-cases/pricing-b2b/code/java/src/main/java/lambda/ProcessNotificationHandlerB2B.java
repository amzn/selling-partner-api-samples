package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import lambda.utils.B2B.*;
import lambda.utils.B2B.AOCN.B2BAnyOfferChangedNotification;
import lambda.utils.B2B.AOCN.B2BOffer;
import lambda.utils.B2B.AOCN.OfferChangeTriggerB2B;
import lambda.utils.B2C.*;
import lambda.utils.common.ApiCredentials;
import lambda.utils.common.Seller;
import software.amazon.awssdk.services.sfn.SfnClient;
import software.amazon.awssdk.services.sfn.model.StartExecutionRequest;
import software.amazon.awssdk.services.sfn.model.StartExecutionResponse;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import static lambda.utils.common.Constants.*;

public class ProcessNotificationHandlerB2B implements RequestHandler<SQSEvent, String> {

    public String handleRequest(SQSEvent input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("ProcessNotification Lambda input: " + new Gson().toJson(input));

        //Iterate over SQS messages
        //Start a Step Functions workflow execution for every Any Offer Changed notifications
        for (SQSEvent.SQSMessage message : input.getRecords()) {
            logger.log(String.format("Notification body: %s", message.getBody()));

            try {
                SPAPINotificationB2B notification = mapNotification(message.getBody());

                // Only process the notification if it is of type "B2B_ANY_OFFER_CHANGED"
                if (!NOTIFICATION_TYPE_B2B_ANY_OFFER_CHANGED.equals(notification.getNotificationType())) {
                    logger.log(String.format("Notification type %s skipped", notification.getNotificationType()));
                    continue;
                }
                B2BAnyOfferChangedNotification b2bAnyOfferChangedNotification = notification.getPayload().getB2bAnyOfferChangedNotification();


                logger.log("Starting state machine execution");
                String executionArn = startStepFunctionsExecution(b2bAnyOfferChangedNotification);
                logger.log(String.format("State machine successfully started. Execution arn: %s", executionArn));

            } catch (Exception e) {
                throw new InternalError("ProcessNotification Lambda failed", e);
            }
        }

        return "Finished processing incoming notifications";
    }

    private SPAPINotificationB2B mapNotification(String notificationBody) throws IOException {

        try {
            ObjectMapper mapper = new ObjectMapper();
            SPAPINotificationB2B notification = mapper.readValue(notificationBody, SPAPINotificationB2B.class);
            return notification;
        }
        catch(Exception e)
            {
                throw new InternalError("mapNotification failed", e);
            }
    }

    private String startStepFunctionsExecution(B2BAnyOfferChangedNotification b2banyOfferChangedNotification) throws JsonProcessingException {
        ObjectMapper mapper = new ObjectMapper();
        StateMachineInputB2B input = getStateMachineInput(b2banyOfferChangedNotification);
        String inputStr = mapper.writeValueAsString(input);

        StartExecutionRequest request = StartExecutionRequest.builder()
                .stateMachineArn(System.getenv(STATE_MACHINE_ARN_ENV_VARIABLE))
                .name(String.format("%s-%s-%s",
                        b2banyOfferChangedNotification.getSellerId(),
                        b2banyOfferChangedNotification.getOfferChangeTrigger().getAsin(),
                        UUID.randomUUID()))
                .input(inputStr)
                .build();

        SfnClient stepFunctions = SfnClient.builder().build();
        StartExecutionResponse result = stepFunctions.startExecution(request);

        return result.executionArn();
    }

    private StateMachineInputB2B getStateMachineInput(B2BAnyOfferChangedNotification b2banyOfferChangedNotification) {
        OfferChangeTriggerB2B offerChangeTrigger = b2banyOfferChangedNotification.getOfferChangeTrigger();

        return  StateMachineInputB2B.builder()
                .asin(offerChangeTrigger.getAsin())
                .credentials(ApiCredentials.builder()
                        .regionCode(getMartketplaceIdToRegionCodeMapping(offerChangeTrigger.getMarketplaceId()))
                        .marketplaceId(offerChangeTrigger.getMarketplaceId())
                        .refreshToken(System.getenv(REFRESH_TOKEN_ARN_ENV_VARIABLE))
                        .build())
                .buyBox(b2banyOfferChangedNotification.getSummary().getBuyBoxPrices())
                .seller(getSeller(b2banyOfferChangedNotification))
                .build();
    }
    private Seller getSeller(B2BAnyOfferChangedNotification b2bAnyOfferChangedNotification) {
        String sellerId = b2bAnyOfferChangedNotification.getSellerId();
        List<B2BOffer> notificationB2BOffers = b2bAnyOfferChangedNotification.getOffers();

        List<Offer> sellerOffers = notificationB2BOffers.stream()
                .filter(o -> o.getSellerId().equals(sellerId))
                .map(o -> Offer.builder()
                        .sellerId(o.getSellerId())
                        .listingPrice(Amount.builder()
                                .currencyCode(o.getListingPrice().getCurrencyCode())
                                .amount(o.getListingPrice().getAmount())
                                .build())
                        .shippingPrice(Amount.builder()
                                .currencyCode(o.getShipping().getCurrencyCode())
                                .amount(o.getShipping().getAmount())
                                .build())
                        .isBuyBoxWinner(o.getIsBuyBoxWinner())
                        .isFulfilledByAmazon(o.getIsFulfilledByAmazon())
                        .build())
                .collect(Collectors.toList());

        return Seller.builder()
                .sellerId(sellerId)
                .offers(sellerOffers)
                .build();
    }



}
