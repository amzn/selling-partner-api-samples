package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.common.collect.Lists;
import com.google.gson.Gson;
import io.swagger.client.ApiException;
import io.swagger.client.api.ListingsApi;
import io.swagger.client.model.listings.ListingsItemPatchRequest;
import io.swagger.client.model.listings.ListingsItemSubmissionResponse;
import io.swagger.client.model.listings.PatchOperation;
import lambda.utils.B2B.PricingLambdaInputB2B;
import lambda.utils.B2B.PricingRuleB2B;
import lambda.utils.B2B.PurchasableOfferElement;
import lambda.utils.B2B.PurchasableOfferElement.PurchasableOfferPrice;
import lambda.utils.B2B.PurchasableOfferElement.PurchasableOfferPrice.PurchasableOfferPriceBuilder;
import lambda.utils.B2B.PurchasableOfferElement.QuantityDiscountPlan;
import lambda.utils.B2B.PurchasableOfferElement.QuantityDiscountPlan.OfferSchedule;
import lambda.utils.B2B.PurchasableOfferElement.QuantityDiscountPlan.OfferSchedule.QuantityDiscountLevel;
import lambda.utils.B2C.Amount;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

import static lambda.utils.common.ApiUtils.getListingsApi;

public class SubmitPriceHandler implements RequestHandler<PricingLambdaInputB2B, String> {

    private static final Logger log = LoggerFactory.getLogger(SubmitPriceHandler.class);

    public String handleRequest(PricingLambdaInputB2B input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("SubmitPrice Lambda input: " + new Gson().toJson(input));

        try {
            String sellerId = input.getSellerId();
            String itemSku = input.getItemSku();
            List<String> marketplaceIds = Lists.newArrayList(input.getCredentials().getMarketplaceId());
            String issueLocale = "en_US";

            ListingsApi listingsApi = getListingsApi(input.getCredentials().getRegionCode(), input.getCredentials().getRefreshToken());

            PurchasableOfferElement purchasableOfferElement = calculateB2BPurchasableOffer(input.getPricingRules(), input.getNewListingPrice(), input.getCredentials().getMarketplaceId());

            ListingsItemPatchRequest patchRequestBody = getPatchListingsRequestBody(purchasableOfferElement, logger);
            ListingsItemSubmissionResponse response = listingsApi.patchListingsItem(sellerId, itemSku, marketplaceIds, patchRequestBody, issueLocale);

            logger.log("Patch Listings Item response: " + new Gson().toJson(response));
        } catch (Exception e) {
            if (e instanceof ApiException) {
                ApiException apiException = (ApiException) e;
                logger.log(apiException.getResponseBody());
                logger.log(apiException.getMessage());
                logger.log(String.valueOf(apiException.getCode()));
            }
            throw new InternalError("SubmitPrice Lambda failed", e);
        }
        
        //Removing the paramter as B2B have multiple prices; Business price and quantity discounts
        //return String.format("Finished submitting price update. New price is %f", input.getNewListingPrice().getAmount());
        return String.format("Finished submitting price update.");
    }

    private PurchasableOfferElement calculateB2BPurchasableOffer(List<PricingRuleB2B> pricingRules, Amount newListingPrice, String marketplaceId) {
        PurchasableOfferElement purchasableOfferElement = new PurchasableOfferElement();

        purchasableOfferElement.setOfferAudience(PurchasableOfferElement.OfferAudience.B2B);
        purchasableOfferElement.setCurrency(newListingPrice.getCurrencyCode());
        purchasableOfferElement.setMarketplaceId(marketplaceId);

        PurchasableOfferPriceBuilder purchasableOfferPriceBuilder = PurchasableOfferPrice.builder();

        PricingRuleB2B tierOnePricing = pricingRules.stream()
                .filter(pricingRuleB2B -> "B2B".equals(pricingRuleB2B.getOfferType()) &&
                        pricingRuleB2B.getQuantityTier() == 1 &&
                        pricingRuleB2B.getNewListingPrice().getAmount() > 1).findFirst().orElse(null);
        if (tierOnePricing != null) {
            PurchasableOfferPrice ourPrice = purchasableOfferPriceBuilder
                    .schedule(
                            Lists.newArrayList(PurchasableOfferPrice.OfferSchedule.builder()
                                    .valueWithTax(Float.valueOf(tierOnePricing.getNewListingPrice().getAmount()))
                                    .build())
                    ).build();
            purchasableOfferElement.setOurPrices(Lists.newArrayList(ourPrice));
            pricingRules.remove(tierOnePricing);
        }

        ArrayList<QuantityDiscountLevel> quantityDiscountLevels = Lists.newArrayList();

        pricingRules.forEach(pricingRuleB2B -> {
            if (pricingRuleB2B.getNewListingPrice().getAmount() > 1) {
                quantityDiscountLevels.add(QuantityDiscountLevel.builder()
                        .lowerBound(pricingRuleB2B.getQuantityTier())
                        .value(pricingRuleB2B.getNewListingPrice().getAmount())
                        .build());
            }
        });

        purchasableOfferElement.setQuantityDiscountPlans(Lists.newArrayList(QuantityDiscountPlan.builder()
                .schedule(Lists.newArrayList(
                                OfferSchedule.builder()
                                        .discountType(PurchasableOfferElement.DiscountType.FIXED)
                                        .quantityDiscountLevels(quantityDiscountLevels).build()
                        )
                ).build())
        );
        return purchasableOfferElement;
    }

    private ListingsItemPatchRequest getPatchListingsRequestBody(PurchasableOfferElement purchasableOfferElement, LambdaLogger logger) {
        logger.log(new Gson().toJson(purchasableOfferElement));
        PatchOperation patchOperation = new PatchOperation()
                .op(PatchOperation.OpEnum.REPLACE)
                .path("/attributes/purchasable_offer")
                .value(Lists.newArrayList(purchasableOfferElement));

        return new ListingsItemPatchRequest()
                .productType("PRODUCT")
                .patches(Lists.newArrayList(patchOperation));
    }
}
