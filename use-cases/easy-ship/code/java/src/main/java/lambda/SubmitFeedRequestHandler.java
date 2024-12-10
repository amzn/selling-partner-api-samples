package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import io.swagger.client.api.FeedsApi;
import io.swagger.client.model.feeds.CreateFeedDocumentResponse;
import io.swagger.client.model.feeds.CreateFeedDocumentSpecification;
import io.swagger.client.model.feeds.CreateFeedResponse;
import io.swagger.client.model.feeds.CreateFeedSpecification;
import io.swagger.client.model.feeds.FeedOptions;
import lambda.utils.ApiUtils;
import lambda.utils.HttpFileTransferUtil;
import lambda.utils.StateMachineInput;
import lambda.utils.XmlUtil;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

import static lambda.utils.Constants.*;


public class SubmitFeedRequestHandler implements RequestHandler<StateMachineInput, StateMachineInput> {

    public StateMachineInput handleRequest(StateMachineInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("SubmitFeedRequest Lambda input: " + new Gson().toJson(input));

        try {
            // Create Feeds document
            FeedsApi feedsApi = ApiUtils.getFeedsApi(input);
            String contentType = String.format("text/xml; charset=%s", StandardCharsets.UTF_8);
            CreateFeedDocumentSpecification createFeedDocumentbody = new CreateFeedDocumentSpecification().contentType(contentType);
            CreateFeedDocumentResponse createFeedDocumentresponse = feedsApi.createFeedDocument(createFeedDocumentbody);
            logger.log("Feed API -  Create Feeds document response: " + new Gson().toJson(createFeedDocumentresponse));
            // Upload Feeds Document
            String url = createFeedDocumentresponse.getUrl();
            String content = XmlUtil.generateEasyShipAmazonEnvelope(
                    input.getSellerId(),input.getAmazonOrderId(), FEED_OPTIONS_DOCUMENT_TYPE_VALUE);
            HttpFileTransferUtil.upload(content.getBytes(StandardCharsets.UTF_8), url);
            // Create Feeds
            FeedOptions feedOptions = new FeedOptions();
            feedOptions.put(FEED_OPTIONS_KEY_AMAZON_ORDER_ID, input.getAmazonOrderId());
            feedOptions.put(FEED_OPTIONS_KEY_DOCUMENT_TYPE, FEED_OPTIONS_DOCUMENT_TYPE_VALUE);
            String feedDocumentId = createFeedDocumentresponse.getFeedDocumentId();
            CreateFeedSpecification createFeedbody = new CreateFeedSpecification()
                    .feedType(POST_EASYSHIP_DOCUMENTS)
                    .marketplaceIds(Collections.singletonList(input.getMarketplaceId()))
                    .feedOptions(feedOptions)
                    .inputFeedDocumentId(feedDocumentId);
            logger.log("Feed API -  Create Feeds  request body: " + new Gson().toJson(createFeedbody));
            CreateFeedResponse createFeedResponse = feedsApi.createFeed(createFeedbody);
            logger.log("Feed API -  Create Feeds  response: " + new Gson().toJson(createFeedDocumentresponse));
            input.setFeedId(createFeedResponse.getFeedId());
            return input;
        } catch (Exception e) {
            throw new InternalError("Submit Feed Request failed", e);
        }
    }
}
