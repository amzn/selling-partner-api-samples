package easyship;

import com.amazon.SellingPartnerAPIAA.LWAException;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.reports.v2021_06_30.ReportsApi;
import software.amazon.spapi.models.reports.v2021_06_30.Report;
import software.amazon.spapi.models.reports.v2021_06_30.ReportDocument;
import util.Constants;
import util.Recipe;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.zip.GZIPInputStream;

import static java.net.URI.create;

/**
 * Code Recipe to download shipping label from Report API and store to S3
 * Steps:
 * 1. Get report to retrieve reportDocumentId
 * 2. Get report document to retrieve download URL
 * 3. Download and decompress report document
 * 4. Store document to S3 and generate pre-signed URL
 */
public class DownloadShippingLabelRecipe extends Recipe {

    private ReportsApi reportsApi;
    private String reportId;

    @Override
    protected void start() {
        initializeParameters();
        initializeReportsApi();
        String reportDocumentId = getReportDocumentId();
        String documentUrl = getReportDocumentUrl(reportDocumentId);
        byte[] labelData = downloadAndDecompressDocument(documentUrl);
        System.out.println("Shipping label downloaded successfully (" + labelData.length + " bytes)");
    }

    private void initializeParameters() {
        reportId = "amzn1.easyship.document.12345678-abcd-efgh-ijkl-123456789012";
        System.out.println("Parameters initialized for report: " + reportId);
    }

    private void initializeReportsApi() {
        reportsApi = new ReportsApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        System.out.println("Reports API client initialized");
    }

    private String getReportDocumentId() {
        try {
            Report report = reportsApi.getReport(reportId);
            String documentId = report.getReportDocumentId();
            System.out.println("Report status: " + report.getProcessingStatus());
            return documentId;
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to get report", e);
        }
    }

    private String getReportDocumentUrl(String reportDocumentId) {
        try {
            ReportDocument reportDocument = reportsApi.getReportDocument(reportDocumentId);
            System.out.println("Report document URL retrieved");
            return reportDocument.getUrl();
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to get report document", e);
        }
    }

    private byte[] downloadAndDecompressDocument(String url) {
        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(create(url))
                    .GET()
                    .build();

            HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new RuntimeException("Download failed: " + response.statusCode());
            }

            byte[] compressedData = response.body();
            System.out.println("Document downloaded, decompressing...");
            return decompressGzip(compressedData);
        } catch (Exception e) {
            throw new RuntimeException("Failed to download document", e);
        }
    }

    private byte[] decompressGzip(byte[] compressedData) {
        try (ByteArrayInputStream bais = new ByteArrayInputStream(compressedData);
             GZIPInputStream gzipIn = new GZIPInputStream(bais);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = gzipIn.read(buffer)) != -1) {
                baos.write(buffer, 0, bytesRead);
            }
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to decompress document", e);
        }
    }
}
