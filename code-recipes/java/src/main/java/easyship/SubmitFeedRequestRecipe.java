package easyship;

import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.feeds.v2021_06_30.FeedsApi;
import software.amazon.spapi.models.feeds.v2021_06_30.CreateFeedDocumentResponse;
import software.amazon.spapi.models.feeds.v2021_06_30.CreateFeedDocumentSpecification;
import software.amazon.spapi.models.feeds.v2021_06_30.CreateFeedResponse;
import software.amazon.spapi.models.feeds.v2021_06_30.CreateFeedSpecification;
import util.Recipe;
import util.Constants;

import com.amazon.SellingPartnerAPIAA.LWAException;
import software.amazon.spapi.models.feeds.v2021_06_30.FeedOptions;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

import static java.net.URI.create;

/**
 * Code Recipe to submit feed request for printing EasyShip shipping labels
 * Steps:
 * 1. Create feed document to get upload URL
 * 2. Generate and upload XML feed document
 * 3. Create feed to process the document
 */
public class SubmitFeedRequestRecipe extends Recipe {

    private FeedsApi feedsApi;
    private String sellerId;
    private String amazonOrderId;
    private String marketplaceId;

    @Override
    protected void start() {
        initializeParameters();
        initializeFeedsApi();
        CreateFeedDocumentResponse feedDocResponse = createFeedDocument();
        uploadFeedDocument(feedDocResponse.getUrl());
        CreateFeedResponse feedResponse = createFeed(feedDocResponse.getFeedDocumentId());
        System.out.println("Feed created: " + feedResponse.toString());
        System.out.println("✅ Feed Id: " + feedResponse.getFeedId());
    }

    private void initializeParameters() {
        sellerId = "A2ZPJ4TLUOSWY8";
        amazonOrderId = "702-3035602-4225066";
        marketplaceId = "A1AM78C64UM0Y8";
        System.out.println("Parameters initialized for order: " + amazonOrderId);
    }

    private void initializeFeedsApi() {
        feedsApi = new FeedsApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        System.out.println("Feeds API client initialized");
    }

    private CreateFeedDocumentResponse createFeedDocument() {
        try {
            String contentType = String.format("text/xml; charset=%s", StandardCharsets.UTF_8);
            CreateFeedDocumentSpecification spec = new CreateFeedDocumentSpecification()
                    .contentType(contentType);
            CreateFeedDocumentResponse response = feedsApi.createFeedDocument(spec);
            System.out.println("Feed document created: " + response.getFeedDocumentId());
            return response;
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to create feed document", e);
        }
    }

    private void uploadFeedDocument(String url) {
        try {
            String xmlContent = generateEasyShipXml();
            String contentType = String.format("text/xml; charset=%s", StandardCharsets.UTF_8);
            byte[] xmlBytes = xmlContent.getBytes(StandardCharsets.UTF_8);
            
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(create(url))
                    .PUT(HttpRequest.BodyPublishers.ofByteArray(xmlBytes))
                    .header("Content-Type", contentType)
                    .build();
            
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new RuntimeException("Upload failed: " + response.statusCode());
            }
            System.out.println("Feed document uploaded successfully");
        } catch (IOException | InterruptedException e) {
            throw new RuntimeException("Failed to upload feed document", e);
        }
    }

    private String generateEasyShipXml() {
        return String.format(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
            "<AmazonEnvelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" " +
            "xsi:noNamespaceSchemaLocation=\"amzn-envelope.xsd\">\n" +
            "  <Header>\n" +
            "    <DocumentVersion>1.01</DocumentVersion>\n" +
            "    <MerchantIdentifier>%s</MerchantIdentifier>\n" +
            "  </Header>\n" +
            "  <MessageType>EasyShipDocument</MessageType>\n" +
            "  <Message>\n" +
            "    <MessageID>1</MessageID>\n" +
            "    <EasyShipDocument>\n" +
            "      <AmazonOrderID>%s</AmazonOrderID>\n" +
            "      <DocumentType>ShippingLabel</DocumentType>\n" +
            "    </EasyShipDocument>\n" +
            "  </Message>\n" +
            "</AmazonEnvelope>",
            sellerId, amazonOrderId
        );
    }

    private CreateFeedResponse createFeed(String feedDocumentId) {
        try {
            FeedOptions feedOptions = new FeedOptions();
            feedOptions.put("AmazonOrderId", amazonOrderId);
            feedOptions.put("DocumentType", "ShippingLabel");
            
            CreateFeedSpecification spec = new CreateFeedSpecification()
                    .feedType("POST_EASYSHIP_DOCUMENTS")
                    .marketplaceIds(Collections.singletonList(marketplaceId))
                    .feedOptions(feedOptions)
                    .inputFeedDocumentId(feedDocumentId);
            
            CreateFeedResponse response = feedsApi.createFeed(spec);
            System.out.println("Feed created successfully");
            return response;
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to create feed", e);
        }
    }
}
