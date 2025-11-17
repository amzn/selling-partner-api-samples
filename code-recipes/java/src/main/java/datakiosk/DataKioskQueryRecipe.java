package datakiosk;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import software.amazon.spapi.api.datakiosk.v2023_11_15.DataKioskApi;
import software.amazon.spapi.model.datakiosk.v2023_11_15.*;
import util.Constants;
import util.Recipe;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Base64;
import java.util.zip.GZIPInputStream;

/**
 * Data Kiosk API Recipe: End-to-End Query Flow
 * =============================================
 * 
 * This recipe shows a simple, end-to-end Data Kiosk flow in four steps:
 * 
 * 1. Submit a GraphQL query with createQuery.
 * 2. Wait for a DATA_KIOSK_QUERY_PROCESSING_FINISHED notification.
 * 3. Use dataDocumentId or errorDocumentId with getDocument.
 * 4. Download and parse the document (JSON / JSONL).
 */
public class DataKioskQueryRecipe extends Recipe {

    private final DataKioskApi dataKioskApi = new DataKioskApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void start() {
        String queryId = submitQuery();
        System.out.println("Query submitted with ID: " + queryId);
        
        // In real implementation, you would receive notification asynchronously
        handleNotificationFlow(Constants.DATAKIOSK_SAMPLE_NOTIFICATION);
    }

    /**
     * Step 1: Submit a GraphQL query to Data Kiosk
     */
    private String submitQuery() {
        try {
            CreateQueryRequest request = new CreateQueryRequest();
            request.setQuery(Constants.DATAKIOSK_SAMPLE_QUERY);
            
            CreateQueryResponse response = dataKioskApi.createQuery(request);
            String queryId = response.getQueryId();
            
            System.out.println("[Step 1] Query submitted successfully. queryId = " + queryId);
            return queryId;
        } catch (Exception e) {
            System.err.println("Error submitting query: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    /**
     * Step 2: Handle DATA_KIOSK_QUERY_PROCESSING_FINISHED notification
     */
    private void handleNotificationFlow(String notificationJson) {
        try {
            JsonNode notification = objectMapper.readTree(notificationJson);
            NotificationResult result = handleNotification(notification);
            
            if (result.documentId != null) {
                GetDocumentResponse metadata = getDocumentMetadata(result.documentId);
                downloadAndParseDocument(metadata);
            } else {
                System.out.println("[Step 2] No document to process. Status: " + result.status);
            }
        } catch (Exception e) {
            System.err.println("Error handling notification: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    private NotificationResult handleNotification(JsonNode notification) {
        String notificationType = notification.path("notificationType").asText();
        if (!"DATA_KIOSK_QUERY_PROCESSING_FINISHED".equals(notificationType)) {
            System.out.println("Ignored wrong notificationType: " + notificationType);
            return new NotificationResult("IGNORED_WRONG_TYPE", null);
        }

        JsonNode payload = notification.path("payload");
        String status = payload.path("processingStatus").asText();
        String dataDocumentId = payload.path("dataDocumentId").asText(null);
        String errorDocumentId = payload.path("errorDocumentId").asText(null);
        String queryId = payload.path("queryId").asText();

        System.out.println("[Step 2] Received notification for queryId=" + queryId + ", status=" + status);

        if ("PENDING".equals(status) || "PROCESSING".equals(status) || "QUEUED".equals(status)) {
            return new NotificationResult("NOT_READY (" + status + ")", null);
        }

        if ("FATAL".equals(status)) {
            if (errorDocumentId != null && !errorDocumentId.isEmpty()) {
                System.out.println("Using errorDocumentId=" + errorDocumentId);
                return new NotificationResult("FATAL_WITH_ERROR_DOCUMENT", errorDocumentId);
            }
            return new NotificationResult("FATAL_NO_ERROR_DOCUMENT", null);
        }

        if ("DONE".equals(status)) {
            if (dataDocumentId != null && !dataDocumentId.isEmpty()) {
                System.out.println("Using dataDocumentId=" + dataDocumentId);
                return new NotificationResult("DONE_WITH_DATA_DOCUMENT", dataDocumentId);
            }
            if (errorDocumentId != null && !errorDocumentId.isEmpty()) {
                System.out.println("Done but only errorDocumentId=" + errorDocumentId);
                return new NotificationResult("DONE_WITH_ERROR_DOCUMENT_ONLY", errorDocumentId);
            }
            return new NotificationResult("DONE_NO_DOCUMENT", null);
        }

        return new NotificationResult("UNKNOWN_STATUS (" + status + ")", null);
    }

    /**
     * Step 3: Call getDocument to retrieve document metadata
     */
    private GetDocumentResponse getDocumentMetadata(String documentId) {
        try {
            System.out.println("[Step 3] Calling getDocument for document_id=" + documentId);
            return dataKioskApi.getDocument(documentId);
        } catch (Exception e) {
            System.err.println("Error getting document metadata: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    /**
     * Step 4: Download and parse document from pre-signed URL
     */
    private void downloadAndParseDocument(GetDocumentResponse documentMetadata) {
        try {
            String url = documentMetadata.getUrl();
            if (url == null || url.isEmpty()) {
                throw new RuntimeException("Document metadata does not contain a URL field.");
            }

            System.out.println("[Step 4] Downloading document from: " + url);

            byte[] data = downloadDocument(url);
            
            // Handle compression
            if ("GZIP".equalsIgnoreCase(documentMetadata.getCompressionAlgorithm())) {
                System.out.println("Detected compressionAlgorithm=GZIP. Decompressing...");
                data = decompressGzip(data);
            }

            String content = new String(data, "UTF-8");
            parseDocument(content);

        } catch (Exception e) {
            System.err.println("Error downloading/parsing document: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    private byte[] downloadDocument(String url) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setRequestMethod("GET");
        
        try (InputStream inputStream = connection.getInputStream()) {
            return inputStream.readAllBytes();
        }
    }

    private byte[] decompressGzip(byte[] data) throws IOException {
        try (GZIPInputStream gzipInputStream = new GZIPInputStream(new java.io.ByteArrayInputStream(data))) {
            return gzipInputStream.readAllBytes();
        }
    }

    private void parseDocument(String content) {
        try {
            String trimmed = content.trim();
            
            if (trimmed.contains("\n")) {
                System.out.println("Detected JSONL document. Parsing lines...");
                String[] lines = trimmed.split("\n");
                for (String line : lines) {
                    if (!line.trim().isEmpty()) {
                        JsonNode jsonLine = objectMapper.readTree(line);
                        System.out.println("JSONL line: " + jsonLine.toString());
                    }
                }
            } else {
                System.out.println("Detected JSON document. Parsing...");
                JsonNode json = objectMapper.readTree(trimmed);
                System.out.println("JSON content: " + json.toString());
            }
        } catch (Exception e) {
            System.err.println("Error parsing document: " + e.getMessage());
            System.out.println("Raw content (first 500 chars): " + content.substring(0, Math.min(500, content.length())));
        }
    }



    private static class NotificationResult {
        final String status;
        final String documentId;

        NotificationResult(String status, String documentId) {
            this.status = status;
            this.documentId = documentId;
        }
    }
}