package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.common.collect.Lists;
import com.google.gson.Gson;
import io.swagger.client.api.ProductPricingApi;
import io.swagger.client.model.pricing.GetPricingResponse;
import io.swagger.client.model.pricing.PriceType;
import lambda.utils.B2C.Amount;
import lambda.utils.B2C.PricingLambdaInput;

import java.util.List;

import static lambda.utils.common.ApiUtils.getProductPricingApi;

public class FetchPriceHandler implements RequestHandler<PricingLambdaInput, PricingLambdaInput> {

    public PricingLambdaInput handleRequest(PricingLambdaInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("FetchPrice Lambda input: " + new Gson().toJson(input));

        List<String> skus = Lists.newArrayList(input.getItemSku());

        try {
            ProductPricingApi pricingApi = getProductPricingApi(input.getCredentials().getRegionCode(), input.getCredentials().getRefreshToken());
            GetPricingResponse getPricingResponse = pricingApi.getPricing(
                    input.getCredentials().getMarketplaceId(),
                    "Sku",
                    null,
                    skus,
                    null,
                    "B2B");

            logger.log("GetPricing Response: " + new Gson().toJson(getPricingResponse));

            //Check for a client error response from the pricing API
            if ("ClientError".equals(getPricingResponse.getPayload().get(0).getStatus())) {
                //Return placeholders for listing and shipping price
                logger.log("ClientError received from Product Pricing API");
                return PricingLambdaInput.builder()
                        .listingPrice(Amount.builder().amount(-1).build())
                        .shippingPrice(Amount.builder().amount(-1).build())
                        .build();
            }

            PriceType skuPrices = null;
            try {
                skuPrices = getPricingResponse.getPayload().get(0).getProduct().getOffers().get(0).getBuyingPrice();
            } catch(Exception e){
                logger.log("No BD set for this sku :" + skus);
            }
            if(null==skuPrices){
                // No BD set. Fetch B2C price.
                 getPricingResponse = pricingApi.getPricing(
                        input.getCredentials().getMarketplaceId(),
                        "Sku",
                        null,
                        skus,
                        null,
                        "B2C");

                logger.log("GetPricing Response B2C: " + new Gson().toJson(getPricingResponse));

                //Check for a client error response from the pricing API
                if ("ClientError".equals(getPricingResponse.getPayload().get(0).getStatus())) {
                    //Return placeholders for listing and shipping price
                    logger.log("ClientError received from Product Pricing API");
                    return PricingLambdaInput.builder()
                            .listingPrice(Amount.builder().amount(-1).build())
                            .shippingPrice(Amount.builder().amount(-1).build())
                            .build();
                }
                skuPrices = getPricingResponse.getPayload().get(0).getProduct().getOffers().get(0).getBuyingPrice();
            }
            return PricingLambdaInput.builder()
                    .listingPrice(Amount.builder()
                            .currencyCode(skuPrices.getLandedPrice().getCurrencyCode())
                            .amount(skuPrices.getLandedPrice().getAmount().floatValue())
                            .build())
                    .shippingPrice(Amount.builder()
                            .currencyCode(skuPrices.getShipping().getCurrencyCode())
                            .amount(skuPrices.getShipping().getAmount().floatValue())
                            .build())
                    .build();

        } catch (Exception e) {
            throw new InternalError("FetchPrice Lambda failed", e);
        }
    }
}
