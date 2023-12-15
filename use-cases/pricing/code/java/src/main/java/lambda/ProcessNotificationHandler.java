package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import lambda.utils.Amount;
import lambda.utils.AnyOfferChangedNotification;
import lambda.utils.ApiCredentials;
import lambda.utils.BuyBoxOffer;
import lambda.utils.NotificationOffer;
import lambda.utils.NotificationPrice;
import lambda.utils.Offer;
import lambda.utils.OfferChangeTrigger;
import lambda.utils.SPAPINotification;
import lambda.utils.Seller;
import lambda.utils.StateMachineInput;
import software.amazon.awssdk.services.sfn.SfnClient;
import software.amazon.awssdk.services.sfn.model.StartExecutionRequest;
import software.amazon.awssdk.services.sfn.model.StartExecutionResponse;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import static lambda.utils.Constants.NOTIFICATION_TYPE_ANY_OFFER_CHANGED;
import static lambda.utils.Constants.PRICE_CHANGE_OFFER_CHANGE_TYPES;
import static lambda.utils.Constants.REFRESH_TOKEN_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.STATE_MACHINE_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.getMartketplaceIdToRegionCodeMapping;

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

                // Only process the notification if it is of type 'ANY_OFFER_CHANGED'
                if (!NOTIFICATION_TYPE_ANY_OFFER_CHANGED.equals(notification.getNotificationType())) {
                    logger.log(String.format("Notification type %s skipped", notification.getNotificationType()));
                    continue;
                }

                AnyOfferChangedNotification anyOfferChangedNotification = notification.getPayload().getAnyOfferChangedNotification();

                // Only process the AOC notification if it is of type 'Internal' or 'FeaturedOffer'
                if (!PRICE_CHANGE_OFFER_CHANGE_TYPES.contains(anyOfferChangedNotification.getOfferChangeTrigger().getOfferChangeType())) {
                    logger.log(String.format("Offer change type %s skipped", anyOfferChangedNotification.getOfferChangeTrigger().getOfferChangeType()));
                    continue;
                }

                logger.log("Starting state machine execution");
                String executionArn = startStepFunctionsExecution(anyOfferChangedNotification);
                logger.log(String.format("State machine successfully started. Execution arn: %s", executionArn));

            } catch (Exception e) {
                throw new InternalError("ProcessNotification Lambda failed", e);
            }
        }

        return "Finished processing incoming notifications";
    }

    private SPAPINotification mapNotification(String notificationBody) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        SPAPINotification notification = mapper.readValue(notificationBody, SPAPINotification.class);

        return notification;
    }

    private String startStepFunctionsExecution(AnyOfferChangedNotification anyOfferChangedNotification) throws JsonProcessingException {
        ObjectMapper mapper = new ObjectMapper();
        StateMachineInput input = getStateMachineInput(anyOfferChangedNotification);
        String inputStr = mapper.writeValueAsString(input);

        StartExecutionRequest request = StartExecutionRequest.builder()
                .stateMachineArn(System.getenv(STATE_MACHINE_ARN_ENV_VARIABLE))
                .name(String.format("%s-%s-%s",
                        anyOfferChangedNotification.getSellerId(),
                        anyOfferChangedNotification.getOfferChangeTrigger().getAsin(),
                        UUID.randomUUID()))
                .input(inputStr)
                .build();

        SfnClient stepFunctions = SfnClient.builder().build();
        StartExecutionResponse result = stepFunctions.startExecution(request);

        return result.executionArn();
    }

    private StateMachineInput getStateMachineInput(AnyOfferChangedNotification anyOfferChangedNotification) {
        OfferChangeTrigger offerChangeTrigger = anyOfferChangedNotification.getOfferChangeTrigger();

        return  StateMachineInput.builder()
                .asin(offerChangeTrigger.getAsin())
                .credentials(ApiCredentials.builder()
                        .regionCode(getMartketplaceIdToRegionCodeMapping(offerChangeTrigger.getMarketplaceId()))
                        .marketplaceId(offerChangeTrigger.getMarketplaceId())
                        .refreshToken(System.getenv(REFRESH_TOKEN_ARN_ENV_VARIABLE))
                        .build())
                .buyBox(getBuyBoxOffer(anyOfferChangedNotification.getSummary().getBuyBoxPrices().get(0)))
                .seller(getSeller(anyOfferChangedNotification))
                .build();
    }

    private BuyBoxOffer getBuyBoxOffer(NotificationPrice buyBoxPrice) {
        return BuyBoxOffer.builder()
                .condition(buyBoxPrice.getCondition())
                .price(Amount.builder()
                        .currencyCode(buyBoxPrice.getLandedPrice().getCurrencyCode())
                        .amount(buyBoxPrice.getLandedPrice().getAmount())
                        .build())
                .build();
    }

    private Seller getSeller(AnyOfferChangedNotification anyOfferChangedNotification) {
        String sellerId = anyOfferChangedNotification.getSellerId();
        List<NotificationOffer> notificationOffers = anyOfferChangedNotification.getOffers();

        List<Offer> sellerOffers = notificationOffers.stream()
                .filter(o -> o.getSellerId().equals(sellerId))
                .map(o -> Offer.builder()
                        .sellerId(o.getSellerId())
                        .listingPrice(Amount.builder()
                                .currencyCode(o.getListingPrice().getCurrencyCode())
                                .amount(o.getListingPrice().getAmount())
                                .build())
                        .shippingPrice(Amount.builder()
                                .currencyCode(o.getShippingPrice().getCurrencyCode())
                                .amount(o.getShippingPrice().getAmount())
                                .build())
                        .isBuyBoxWinner(o.isBuyBoxWinner())
                        .isFulfilledByAmazon(o.isFulfilledByAmazon())
                        .build())
                .collect(Collectors.toList());

        return Seller.builder()
                .sellerId(sellerId)
                .offers(sellerOffers)
                .build();
    }
}
