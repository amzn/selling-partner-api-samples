package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.common.collect.Lists;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import io.swagger.client.api.ListingsApi;
import io.swagger.client.model.listings.Item;
import io.swagger.client.model.listings.ListingsItemPatchRequest;
import io.swagger.client.model.listings.ListingsItemSubmissionResponse;
import io.swagger.client.model.listings.PatchOperation;
import lambda.utils.B2B.PricingLambdaInputB2B;
import lambda.utils.B2C.Amount;
import lambda.utils.B2C.PricingLambdaInput;

import java.util.List;

import static lambda.utils.common.ApiUtils.getListingsApi;

public class SubmitPriceHandler implements RequestHandler<PricingLambdaInputB2B, String> {

    public String handleRequest(PricingLambdaInputB2B input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("SubmitPrice Lambda input: " + new Gson().toJson(input));

        try {
            String sellerId = input.getSellerId();
            String itemSku = input.getItemSku();
            List<String> marketplaceIds = Lists.newArrayList(input.getCredentials().getMarketplaceId());
            String issueLocale = "en_US";
            List<String> includedData = Lists.newArrayList("attributes");

            ListingsApi listingsApi = getListingsApi(input.getCredentials().getRegionCode(), input.getCredentials().getRefreshToken());

            Item listingsItem = listingsApi.getListingsItem(sellerId, itemSku, marketplaceIds, issueLocale, includedData);

            ListingsItemPatchRequest patchRequestBody = getPatchListingsRequestBody(input.getNewListingPrice(), listingsItem);
            ListingsItemSubmissionResponse response = listingsApi.patchListingsItem(sellerId, itemSku, marketplaceIds, patchRequestBody, issueLocale);

            logger.log("Patch Listings Item response: " + new Gson().toJson(response));
        } catch (Exception e) {
            throw new InternalError("SubmitPrice Lambda failed", e);
        }

        return String.format("Finished submitting price update. New price is %f", input.getNewListingPrice().getAmount());
    }

    public ListingsItemPatchRequest getPatchListingsRequestBody(Amount newListingPrice, Item listingsItem) {
        JsonObject attributes = listingsItem.getAttributes();
        JsonArray purchasableOffer = attributes.getAsJsonArray("purchasable_offer");

        //Set the new value_with_tax to the purchasable offer
        purchasableOffer.get(0).getAsJsonObject()
                .getAsJsonArray("our_price")
                .get(0).getAsJsonObject()
                .getAsJsonArray("schedule")
                .get(0).getAsJsonObject()
                .addProperty("value_with_tax", newListingPrice.amount);

        PatchOperation patchOperation = new PatchOperation()
                .op(PatchOperation.OpEnum.REPLACE)
                .path("/attributes/purchasable_offer")
                .value(Lists.newArrayList(purchasableOffer));

        return new ListingsItemPatchRequest()
                .productType("PRODUCT")
                .patches(Lists.newArrayList(patchOperation));
    }
}
