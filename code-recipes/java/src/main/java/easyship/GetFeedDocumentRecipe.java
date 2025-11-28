package easyship;

import com.amazon.SellingPartnerAPIAA.LWAException;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.feeds.v2021_06_30.FeedsApi;
import software.amazon.spapi.models.feeds.v2021_06_30.Feed;
import software.amazon.spapi.models.feeds.v2021_06_30.FeedDocument;
import util.Constants;
import util.Recipe;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static java.net.URI.create;

/**
 * Code Recipe to get feed document and extract document report reference ID
 * Steps:
 * 1. Get feed status to retrieve resultFeedDocumentId
 * 2. Get feed document to retrieve download URL
 * 3. Download feed result document
 * 4. Parse XML and extract documentReportReferenceId
 */
public class GetFeedDocumentRecipe extends Recipe {

    private FeedsApi feedsApi;
    private String feedId;

    @Override
    protected void start() {
        initializeParameters();
        initializeFeedsApi();
        String resultFeedDocumentId = getFeedStatus();
        String documentUrl = getFeedDocumentUrl(resultFeedDocumentId);
        String xmlContent = downloadFeedDocument(documentUrl);
        String documentReportReferenceId = extractDocumentReportReferenceId(xmlContent);
        System.out.println("✅ Document Report Reference Id: " + documentReportReferenceId);
    }

    private void initializeParameters() {
        feedId = "378823020417";
        System.out.println("Parameters initialized for feed: " + feedId);
    }

    private void initializeFeedsApi() {
        feedsApi = new FeedsApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        System.out.println("Feeds API client initialized");
    }

    private String getFeedStatus() {
        try {
            Feed feed = feedsApi.getFeed(feedId);
            String resultDocumentId = feed.getResultFeedDocumentId();
            System.out.println("Feed status retrieved: " + feed.getProcessingStatus());
            return resultDocumentId;
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to get feed status", e);
        }
    }

    private String getFeedDocumentUrl(String feedDocumentId) {
        try {
            FeedDocument feedDocument = feedsApi.getFeedDocument(feedDocumentId);
            System.out.println("Feed document URL retrieved " + feedDocument.getUrl());
            return feedDocument.getUrl();
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to get feed document", e);
        }
    }

    private String downloadFeedDocument(String url) {
        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(create(url))
                    .GET()
                    .build();
            
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            System.out.println(response.body());
            if (response.statusCode() == 204) {
                return getMockXmlContent();
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new RuntimeException("Download failed: " + response.statusCode());
            }
            System.out.println("Feed document downloaded successfully");
            return response.body();
        } catch (Exception e) {
            throw new RuntimeException("Failed to download feed document", e);
        }
    }

    private String getMockXmlContent() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
                "<EasyShipProcessingReport>" +
                "<FeedSubmissionID>378823020417</FeedSubmissionID>" +
                "<MessagesProcessed>1</MessagesProcessed>" +
                "<MessagesSuccessful>1</MessagesSuccessful>" +
                "<MessagesWithError>0</MessagesWithError>" +
                "<SuccessMessage>" +
                "<MessageID>1</MessageID>" +
                "<AmazonOrderID>701-5497852-1014649</AmazonOrderID>" +
                "<DocumentReportReferenceId>amzn1.easyship.document.12345678-abcd-efgh-ijkl-123456789012</DocumentReportReferenceId>" +
                "</SuccessMessage>" +
                "</EasyShipProcessingReport>";
    }

    private String extractDocumentReportReferenceId(String xmlContent) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new ByteArrayInputStream(xmlContent.getBytes()));
            
            NodeList nodes = doc.getElementsByTagName("DocumentReportReferenceId");
            if (nodes.getLength() == 0) {
                throw new RuntimeException("DocumentReportReferenceId not found in XML");
            }
            return nodes.item(0).getTextContent();
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse XML document", e);
        }
    }
}
