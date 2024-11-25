package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import io.swagger.client.api.FeedsApi;
import io.swagger.client.model.feeds.Feed;
import io.swagger.client.model.feeds.FeedDocument;
import lambda.utils.ApiUtils;
import lambda.utils.HttpFileTransferUtil;
import lambda.utils.StateMachineInput;
import lambda.utils.XmlUtil;

import java.io.IOException;
import java.io.InputStream;

import static lambda.utils.Constants.FEED_DOCUMENT_REPORT_REFERENCE_ID;
import static lambda.utils.Constants.MAX_RETRY_ATTEMPTS;
import static lambda.utils.Constants.POLLING_INTERVAL_MS;


public class GetFeedDocumentHandler implements RequestHandler<StateMachineInput, StateMachineInput> {

    @Override
    public StateMachineInput handleRequest(StateMachineInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("GetFeedDocument Lambda input: " + new Gson().toJson(input));

        try {
            //Initialize API Client
            FeedsApi feedsApi = ApiUtils.getFeedsApi(input);

            // Get Feeds
            String resultFeedDocumentId = waitForFeedCompletion(feedsApi, input.getFeedId(), logger);

            // Get Feed Document
            FeedDocument document = getFeedDocument(feedsApi, resultFeedDocumentId, logger);

            // Download Document
            InputStream documentStream = HttpFileTransferUtil.download(document.getUrl(), null);

            // Extract documentReportReferenceId from the document
            String documentReportReferenceId = XmlUtil.getXmlDocumentTag(documentStream, FEED_DOCUMENT_REPORT_REFERENCE_ID);
            input.setReportId(documentReportReferenceId);

            return input;
        } catch (Exception e) {
            throw new InternalError("Feed document processing failed", e);
        }
    }


    /**
     * Wait for the feed to complete processing
     * @param feedsApi
     * @param feedId
     * @param logger
     * @return
     * @throws Exception
     */
    private String waitForFeedCompletion(FeedsApi feedsApi, String feedId, LambdaLogger logger) throws Exception {
        int attempts = 0;

        while (attempts < MAX_RETRY_ATTEMPTS) {
            Feed feedResponse = feedsApi.getFeed(feedId);

            if (Feed.ProcessingStatusEnum.DONE.equals(feedResponse.getProcessingStatus())) {
                logger.log("Feeds API - Get Feeds response: " + new Gson().toJson(feedResponse));
                return feedResponse.getResultFeedDocumentId();
            }

            if (Feed.ProcessingStatusEnum.FATAL.equals(feedResponse.getProcessingStatus())) {
                throw new IOException("Feed processing failed with FATAL status");
            }

            attempts++;
            Thread.sleep(POLLING_INTERVAL_MS);
        }

        throw new IOException("Feed processing timed out after " + MAX_RETRY_ATTEMPTS + " attempts");
    }

    /**
     * Get Feed Document
     * @param feedsApi
     * @param documentId
     * @param logger
     * @return
     * @throws Exception
     */
    private FeedDocument getFeedDocument(FeedsApi feedsApi, String documentId, LambdaLogger logger) throws Exception {
        // Get Feed Document
        FeedDocument document = feedsApi.getFeedDocument(documentId);
        logger.log("Feeds API - Get Feeds Document response: " + new Gson().toJson(document));
        return document;
    }
}
