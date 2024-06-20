package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import io.swagger.client.api.FeedsApi;
import io.swagger.client.model.feeds.CreateFeedDocumentResponse;
import io.swagger.client.model.feeds.CreateFeedDocumentSpecification;
import lambda.utils.B2B.FeedDetails;
import lambda.utils.B2B.PricingLambdaInputB2B;
import static lambda.utils.common.ApiUtils.getFeedsApi;


public class CreateFeedDocumentHandler implements RequestHandler<PricingLambdaInputB2B, PricingLambdaInputB2B> {

    public PricingLambdaInputB2B handleRequest(PricingLambdaInputB2B input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("Create Feed Document Lambda input: " + new Gson().toJson(input));

        try {
            CreateFeedDocumentSpecification cfds = new CreateFeedDocumentSpecification();
            cfds.setContentType("text/xml; charset=UTF-8");

            FeedsApi feedsApi = getFeedsApi(input.getCredentials().getRegionCode(), input.getCredentials().getRefreshToken());

            CreateFeedDocumentResponse cfdr = feedsApi.createFeedDocument(cfds);
           FeedDetails feedDetails = new FeedDetails();
            feedDetails.setFeedDocumentId(cfdr.getFeedDocumentId());
           feedDetails.setFeedUrl(cfdr.getUrl());
            input.setFeedDetails(feedDetails);
            logger.log("Create Feed Document Lambda response: " + new Gson().toJson(input));
        } catch (Exception e) {
            throw new InternalError("Create Feed Document Lambda failed", e);
        }

        return input;
    }

}
