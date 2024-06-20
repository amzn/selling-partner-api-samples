package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import lambda.utils.B2B.AOCN.BuyBoxB2B;
import lambda.utils.B2B.PricingLambdaInputB2B;
import lambda.utils.B2B.PricingRuleB2B;
import lambda.utils.B2C.Amount;
import lambda.utils.B2C.Offer;
import lambda.utils.B2C.PriceChangeRule;
import lambda.utils.B2C.PricingLambdaInput;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

import static lambda.utils.common.Constants.PRICE_CHANGE_RULE_FIXED;
import static lambda.utils.common.Constants.PRICE_CHANGE_RULE_PERCENTAGE;

public class CalculateNewPriceHandlerB2B implements RequestHandler<PricingLambdaInputB2B, PricingLambdaInputB2B> {
    public PricingLambdaInputB2B handleRequest(PricingLambdaInputB2B input, Context context) {

        LambdaLogger logger = context.getLogger();
        logger.log("CalculateNewPrice Lambda input: " + new Gson().toJson(input));

        try {
            //Calculate the landed price by summing listing price and shipping price
            Offer sellerOffer = input.getSellerOffer(); //input.getSeller().getOffers().get(0);
            List<BuyBoxB2B> buybox = input.getBuyBox();
            List<PricingRuleB2B> priceRules = input.getPricingRules();
            List<PricingRuleB2B> newpriceRules = new ArrayList<>();


            float b2bPrice = 0;
            PricingRuleB2B priceRuleB2B=null;
            for (PricingRuleB2B pr: priceRules) {
                float landedPrice = 0;
                float buyBoxPrice = 0;
                priceRuleB2B = pr;

                for (BuyBoxB2B bp : buybox) {
                    if ("B2B".equals(bp.getOfferType()) && (pr.getQuantityTier() == bp.getQuantityTier())) {
                        buyBoxPrice = bp.getListingPrice().getAmount() + bp.getShipping().getAmount();
                    }
                }
                landedPrice = sellerOffer.getListingPrice().getAmount() + sellerOffer.getShippingPrice().getAmount();

                //Check conditions to determine whether to skip new price calculation

                //Check if buy box price is less than the minimum threshold
                assert priceRuleB2B != null;
                if (buyBoxPrice < priceRuleB2B.getMinThreshold()) {
                    //Log and return indicating skipping new price calculation
                    logger.log(String.format("Buy Box Price: %f is less than threshold: %f. Skipping new price calculation.",
                            buyBoxPrice,
                            priceRuleB2B.getMinThreshold()));
                    if(1 == priceRuleB2B.getQuantityTier()) {
                        return PricingLambdaInputB2B.builder()
                                .newListingPrice(Amount.builder()
                                        .amount(-1)
                                        .build())
                                .pricingRules(priceRules)
                                .issues(String.format("Buy Box Price: %s is less than threshold", buyBoxPrice))
                                .build();
                    }
                    priceRuleB2B.setNewListingPrice(Amount.builder().amount(-1).build());
                    priceRuleB2B.setIssues(String.format("Buy Box Price: %s is less than threshold", buyBoxPrice));
                    continue;
                }

                if(1 == priceRuleB2B.getQuantityTier()) {
                    //Check if buy box price is greater than landed price
                    if (buyBoxPrice > landedPrice) {
                        logger.log(String.format("Landed Price: %f is already less than Buy Box Price: %f. Skipping new price calculation.",
                                landedPrice,
                                buyBoxPrice));

                        return PricingLambdaInputB2B.builder()
                                .newListingPrice(Amount.builder()
                                        .amount(-1)
                                        .build())
                                .pricingRules(priceRules)
                                .issues(String.format("Landed Price: %f is already less than Buy Box Price", landedPrice))
                                .build();
                    }
                }
                //Calculate the new item price based on different price change rules (percentage or fixed)
                float newItemPrice = -1;
                if (PRICE_CHANGE_RULE_PERCENTAGE.equals(priceRuleB2B.getPriceChangeRule())) {
                    newItemPrice = subtractPercentage(buyBoxPrice, priceRuleB2B.getPriceChangeRuleAmount()/100);
                } else if (PRICE_CHANGE_RULE_FIXED.equals(priceRuleB2B.getPriceChangeRule())) {
                    newItemPrice = subtractFixed(buyBoxPrice, priceRuleB2B.getPriceChangeRuleAmount());
                } else {
                    logger.log(String.format("Price Change Rule: %s is Invalid. Skipping new price calculation." +
                                    "Please change rule to match one of [PERCENTAGE, FIXED]",
                            priceRuleB2B.getPriceChangeRule()));
                    if(1 == priceRuleB2B.getQuantityTier()) {
                        return PricingLambdaInputB2B.builder()
                                .newListingPrice(Amount.builder()
                                        .amount(-1)
                                        .build())
                                .pricingRules(priceRules)
                                .issues(String.format("Price Change Rule: %s is Invalid.", priceRuleB2B.getPriceChangeRule()))
                                .build();
                    }
                    priceRuleB2B.setNewListingPrice(Amount.builder().amount(-1).build());
                    priceRuleB2B.setIssues(String.format("Price Change Rule: %s is Invalid.", priceRuleB2B.getPriceChangeRule()));
                    continue;
                }

                //Calculate the new listing price by subtracting shipping price from the new item price
                float newListingPrice = BigDecimal.valueOf(newItemPrice - sellerOffer.getShippingPrice().getAmount()).setScale(2,RoundingMode.HALF_UP).floatValue();

                //Check if the new listing price is less than the minimum threshold
                if (newListingPrice < priceRuleB2B.getMinThreshold()) {
                    logger.log(String.format("New Listings Price: %f is less than threshold: %f. Skipping new price calculation.",
                            newListingPrice,
                            priceRuleB2B.getMinThreshold()));
                    if(1 == priceRuleB2B.getQuantityTier()) {
                        return PricingLambdaInputB2B.builder()
                                .newListingPrice(Amount.builder()
                                        .amount(-1)
                                        .build())
                                .pricingRules(priceRules)
                                .issues(String.format("Buy Box Price: %f is less than threshold", buyBoxPrice))
                                .build();
                    }
                    priceRuleB2B.setNewListingPrice(Amount.builder().amount(-1).build());
                    priceRuleB2B.setIssues(String.format("Buy Box Price: %f is less than threshold", buyBoxPrice));
                    continue;
                }
                priceRuleB2B.setNewListingPrice(Amount.builder().amount(newListingPrice).build());
                newpriceRules.add(priceRuleB2B);
            }
            return PricingLambdaInputB2B.builder()
                    .pricingRules(newpriceRules)
                    .newListingPrice(Amount.builder()
                            .amount(2)
                            .build())
                    .build();
        } catch (Exception e) {
            throw new InternalError("CalculateNewPrice Lambda failed", e);
        }
    }

    private float subtractPercentage(float n1, float percentage) {
        return BigDecimal.valueOf(n1)
                .subtract(BigDecimal.valueOf(n1)
                        .multiply(BigDecimal.valueOf(percentage)))
                .setScale(2, RoundingMode.HALF_UP)
                .floatValue();
    }

    private float subtractFixed(float n1, float n2) {
        return BigDecimal.valueOf(n1)
                .subtract(BigDecimal.valueOf(n2))
                .setScale(2, RoundingMode.HALF_UP)
                .floatValue();
    }
}
