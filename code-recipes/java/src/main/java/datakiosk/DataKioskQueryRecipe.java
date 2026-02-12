package datakiosk;

import com.fasterxml.jackson.jr.ob.JSON;
import software.amazon.spapi.api.datakiosk.v2023_11_15.QueriesApi;
import software.amazon.spapi.models.datakiosk.v2023_11_15.CreateQueryResponse;
import software.amazon.spapi.models.datakiosk.v2023_11_15.CreateQuerySpecification;
import software.amazon.spapi.models.datakiosk.v2023_11_15.GetDocumentResponse;
import util.Recipe;
import util.notifications.datakiosk.DataKioskNotificationConverter;
import util.notifications.datakiosk.DataKioskQueryProcessingFinishedNotification;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
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

    private final QueriesApi dataKioskApi = new QueriesApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(util.Constants.BACKEND_URL)
            .build();

    @Override
    protected void start() {
        String queryId = submitQuery();
        System.out.println("Query submitted with ID: " + queryId);

        try {
            DataKioskQueryProcessingFinishedNotification notification =
                    DataKioskNotificationConverter.fromJsonString(Constants.SAMPLE_NOTIFICATION);

            if (notification.getPayload().getDataDocumentid() != null) {
                GetDocumentResponse metadata = getDocumentMetadata(notification.getPayload().getDataDocumentid());
                downloadAndParseDocument(metadata);
            } else {
                System.out.println("[Step 2] No document to process. Status: " + notification.getPayload().getProcessingStatus());
            }
        } catch (Exception e) {
            System.err.println("Error running Data Kiosk flow: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    /**
     * Step 1: Submit a GraphQL query to Data Kiosk
     */
    private String submitQuery() {
        try {
            CreateQuerySpecification request = new CreateQuerySpecification();
            request.setQuery(Constants.SAMPLE_QUERY);
            
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
            String url = documentMetadata.getDocumentUrl();
            if (url == null || url.isEmpty()) {
                throw new RuntimeException("Document metadata does not contain a URL field.");
            }

            System.out.println("[Step 4] Downloading document from: " + url);

            byte[] data = downloadDocument(url);

            // System.out.println("Detected compressionAlgorithm=GZIP. Decompressing...");
            // data = decompressGzip(data);

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
                        Object jsonLine = JSON.std.anyFrom(line);
                        System.out.println("JSONL line: " + jsonLine);
                    }
                }
            } else {
                System.out.println("Detected JSON document. Parsing...");
                Object json = JSON.std.anyFrom(trimmed);
                System.out.println("JSON content: " + json);
            }
        } catch (Exception e) {
            System.err.println("Error parsing document: " + e.getMessage());
            System.out.println("Raw content (first 500 chars): " + content.substring(0, Math.min(500, content.length())));
        }
    }
}
