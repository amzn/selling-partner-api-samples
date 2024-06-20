package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import io.swagger.client.api.FeedsApi;
import io.swagger.client.model.feeds.CreateFeedResponse;
import io.swagger.client.model.feeds.CreateFeedSpecification;
import lambda.utils.B2B.FeedDetails;
import lambda.utils.B2B.PricingLambdaInputB2B;

import java.util.ArrayList;
import java.util.List;

import static lambda.utils.common.ApiUtils.getFeedsApi;

public class CreateFeedHandler implements RequestHandler<PricingLambdaInputB2B, PricingLambdaInputB2B> {

    public PricingLambdaInputB2B handleRequest(PricingLambdaInputB2B input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("Create Feed Lambda input: " + new Gson().toJson(input));

        try {

            CreateFeedSpecification createFeedSpecification = new CreateFeedSpecification();
            List<String> marketplaceIds = new ArrayList<>();
            marketplaceIds.add(input.getCredentials().getMarketplaceId());
            createFeedSpecification.setMarketplaceIds(marketplaceIds);
            createFeedSpecification.setFeedType("POST_PRODUCT_PRICING_DATA");
            createFeedSpecification.setInputFeedDocumentId(input.getFeedDetails().getFeedDocumentId());

            FeedsApi feedsApi = getFeedsApi(input.getCredentials().getRegionCode(), input.getCredentials().getRefreshToken());
            logger.log("Create Feed  Lambda createFeedSpecification: " + new Gson().toJson(createFeedSpecification));
            CreateFeedResponse cfr = feedsApi.createFeed(createFeedSpecification);

            input.getFeedDetails().setFeedId(cfr.getFeedId());
            logger.log("Create Feed  Lambda response: " + new Gson().toJson(input));
        } catch (Exception e) {
            throw new InternalError("Create Feed Lambda failed", e);
        }

        return input;
    }

}
