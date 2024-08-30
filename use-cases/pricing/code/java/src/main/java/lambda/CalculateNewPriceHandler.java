package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import lambda.utils.Amount;
import lambda.utils.Offer;
import lambda.utils.PriceChangeRule;
import lambda.utils.PricingLambdaInput;

import java.math.BigDecimal;

import static lambda.utils.Constants.PRICE_CHANGE_RULE_FIXED;
import static lambda.utils.Constants.PRICE_CHANGE_RULE_PERCENTAGE;

public class CalculateNewPriceHandler implements RequestHandler<PricingLambdaInput, PricingLambdaInput> {

    public PricingLambdaInput handleRequest(PricingLambdaInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("CalculateNewPrice Lambda input: " + new Gson().toJson(input));

        try {
            //Calculate the landed price by summing listing price and shipping price
            Offer sellerOffer = input.getSellerOffer();
            float landedPrice = sellerOffer.getListingPrice().getAmount() + sellerOffer.getShippingPrice().getAmount();

            float buyBoxPrice = input.getBuyBox().getPrice().getAmount();

            //Check conditions to determine whether to skip new price calculation

            //Pricing Health Workflow - Check whether competitivePriceThreshold is present
            if (sellerOffer.referencePrice != null && input.useCompetitivePrice) {
                float newItemPrice = sellerOffer.referencePrice.getCompetitivePriceThreshold().getAmount().floatValue();
                return createNewPrice(newItemPrice, input.getMinThreshold(), buyBoxPrice, sellerOffer.referencePrice.getCompetitivePriceThreshold().getCurrencyCode(), logger);
            }

            //Check if buy box price is less than the minimum threshold
            if (buyBoxPrice < input.getMinThreshold()) {
                //Log and return indicating skipping new price calculation
                logger.log(String.format("Buy Box Price: %f is less than threshold: %f. Skipping new price calculation.",
                        buyBoxPrice,
                        input.getMinThreshold()));

                return PricingLambdaInput.builder()
                        .newListingPrice(Amount.builder()
                                .amount(-1)
                                .build())
                        .issues(String.format("Buy Box Price: %s is less than threshold", buyBoxPrice))
                        .build();
            }

            //Check if buy box price is greater than landed price
            if (buyBoxPrice > landedPrice) {
                logger.log(String.format("Landed Price: %f is already less than Buy Box Price: %f. Skipping new price calculation.",
                        landedPrice,
                        buyBoxPrice));

                return PricingLambdaInput.builder()
                        .newListingPrice(Amount.builder()
                                .amount(-1)
                                .build())
                        .issues(String.format("Landed Price: %f is already less than Buy Box Price", landedPrice))
                        .build();
            }

            //Calculate the new item price based on different price change rules (percentage or fixed)
            PriceChangeRule priceChangeRule = input.getPriceChangeRule();
            float newItemPrice;
            float buyBoxPriceExcludingShipping = buyBoxPrice - sellerOffer.getShippingPrice().getAmount();
            if (PRICE_CHANGE_RULE_PERCENTAGE.equals(priceChangeRule.getRule())) {
                newItemPrice = subtractPercentage(buyBoxPriceExcludingShipping, priceChangeRule.getValue());
            } else if (PRICE_CHANGE_RULE_FIXED.equals(priceChangeRule.getRule())) {
                newItemPrice = subtractFixed(buyBoxPriceExcludingShipping, priceChangeRule.getValue());
            } else {
                newItemPrice = -1;
                logger.log(String.format("Price Change Rule: %s is Invalid. Skipping new price calculation." +
                                "Please change rule to match one of [PERCENTAGE, FIXED]",
                        priceChangeRule.getRule()));

                return PricingLambdaInput.builder()
                        .newListingPrice(Amount.builder()
                                .amount(newItemPrice)
                                .build())
                        .issues(String.format("Price Change Rule: %s is Invalid.", priceChangeRule.getRule()))
                        .build();
            }

            //Calculate the new listing price by subtracting shipping price from the new item price
            float newListingPrice = newItemPrice;
            return createNewPrice(newListingPrice, input.getMinThreshold(), buyBoxPrice, input.sellerOffer.getListingPrice().currencyCode, logger);
        } catch (Exception e) {
            throw new InternalError("CalculateNewPrice Lambda failed", e);
        }
    }

    private PricingLambdaInput createNewPrice(float newListingPrice, float minThreshold, float buyBoxPrice, String offerCurrency, LambdaLogger logger) {
        //Check if the new listing price is less than the minimum threshold
        PricingLambdaInput.PricingLambdaInputBuilder pricingLambdaBuilder = PricingLambdaInput.builder();
        if (newListingPrice < minThreshold) {
            logger.log(String.format("New Listings Price: %f is less than threshold: %f. Skipping new price calculation.",
                    newListingPrice,
                    minThreshold));

            pricingLambdaBuilder
                    .newListingPrice(Amount.builder()
                            .amount(-1)
                            .build())
                    .issues(String.format("Buy Box Price: %f is less than threshold", buyBoxPrice));
        } else {
            pricingLambdaBuilder.newListingPrice(Amount.builder()
                            .currencyCode(offerCurrency)
                            .amount(newListingPrice)
                            .build())
                    .build();
        }
        return pricingLambdaBuilder.build();
    }

    private float subtractPercentage(float n1, float percentage) {
        return BigDecimal.valueOf(n1)
                .subtract(BigDecimal.valueOf(n1)
                        .multiply(BigDecimal.valueOf(percentage)))
                .floatValue();
    }

    private float subtractFixed(float n1, float n2) {
        return BigDecimal.valueOf(n1)
                .subtract(BigDecimal.valueOf(n2))
                .floatValue();
    }
}
