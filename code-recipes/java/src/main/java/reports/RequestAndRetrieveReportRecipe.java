package reports;

import com.fasterxml.jackson.jr.ob.JSON;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import reports.ReportNotification.ReportNotificationDetails;
import software.amazon.spapi.api.reports.v2021_06_30.ReportsApi;
import software.amazon.spapi.models.reports.v2021_06_30.CreateReportResponse;
import software.amazon.spapi.models.reports.v2021_06_30.CreateReportSpecification;
import software.amazon.spapi.models.reports.v2021_06_30.ReportDocument;
import util.Recipe;

import java.io.IOException;
import java.util.Collections;

/**
 * Reports API Recipe: Request and Retrieve a Report
 * =================================================
 *
 * This recipe shows the end-to-end Reports flow in four steps:
 *
 * 1. Request a report with createReport, which returns a reportId.
 * 2. Wait for the report to finish processing. Subscribe to the REPORT_PROCESSING_FINISHED notification and read the
 *       reportDocumentId from its payload (see {@link #handleNotification(String)}).
 * 3. Call getReportDocument with the reportDocumentId (and enableContentEncodingUrlHeader=true)
 *    to get a pre-signed download URL.
 * 4. Download the document and read the contents. GZIP reports are served with
 *    Content-Encoding: gzip, so HttpURLConnection decompresses them transparently.
 *
 * Docs: https://developer-docs.amazon.com/sp-api/docs/reports-api-v2021-06-30-reference
 */
public class RequestAndRetrieveReportRecipe extends Recipe {

    private final ReportsApi reportsApi = new ReportsApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(util.Constants.BACKEND_URL)
            .build();

    private final OkHttpClient httpClient = new OkHttpClient();

    @Override
    protected void start() {
        try {
            // Step 1: Request the report.
            String reportId = requestReport();
            System.out.println("Report requested with ID: " + reportId);

            // Step 2: Wait for processing to finish and obtain the reportDocumentId.
            String reportDocumentId = handleNotification(Constants.SAMPLE_NOTIFICATION);

            // Step 3: Retrieve the document metadata (pre-signed URL + compression).
            ReportDocument document = getReportDocument(reportDocumentId);

            // Step 4: Download and read the report contents.
            downloadAndReadDocument(document);
        } catch (Exception e) {
            System.err.println("Error running Reports flow: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    /**
     * Step 1: Request a report by report type and marketplace.
     */
    private String requestReport() {
        try {
            CreateReportSpecification specification = new CreateReportSpecification();
            specification.setReportType(Constants.SAMPLE_REPORT_TYPE);
            specification.setMarketplaceIds(Collections.singletonList(Constants.SAMPLE_MARKETPLACE_ID));
            // Optional: bound the report data window with dataStartTime / dataEndTime (OffsetDateTime),
            // and pass report-type-specific options via specification.setReportOptions(...).

            CreateReportResponse response = reportsApi.createReport(specification);
            String reportId = response.getReportId();

            System.out.println("[Step 1] Report requested successfully. reportId = " + reportId);
            return reportId;
        } catch (Exception e) {
            System.err.println("Error requesting report: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    /**
     * Step 2: Handle a REPORT_PROCESSING_FINISHED notification and extract the
     * reportDocumentId. Returns null if the report is not ready or produced no document.
     */
    private String handleNotification(String notificationJson) {
        ReportNotification notification = parseNotification(notificationJson);

        if (!"REPORT_PROCESSING_FINISHED".equals(notification.notificationType)) {
            System.out.println("[Step 2a] Ignored wrong notificationType: " + notification.notificationType);
            return null;
        }

        ReportNotificationDetails details = notification.payload.reportProcessingFinishedNotification;
        System.out.println("[Step 2a] Notification for reportId=" + details.reportId
                + ", status=" + details.processingStatus);

        if ("DONE".equals(details.processingStatus)
                && details.reportDocumentId != null && !details.reportDocumentId.isEmpty()) {
            System.out.println("[Step 2a] Using reportDocumentId=" + details.reportDocumentId);
            return details.reportDocumentId;
        }

        System.out.println("[Step 2a] No downloadable document from notification (status="
                + details.processingStatus + ").");
        return null;
    }

    /**
     * Step 3: Retrieve the report document metadata (pre-signed URL + compression algorithm).
     */
    private ReportDocument getReportDocument(String reportDocumentId) {
        try {
            System.out.println("[Step 3] Calling getReportDocument for reportDocumentId=" + reportDocumentId);
            return reportsApi.getReportDocument(reportDocumentId, true);
        } catch (Exception e) {
            System.err.println("Error getting report document metadata: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    /**
     * Step 4: Download the document from the pre-signed URL and print its contents.
     */
    private void downloadAndReadDocument(ReportDocument document) {
        try {
            String url = document.getUrl();
            if (url == null || url.isEmpty()) {
                throw new RuntimeException("Report document metadata does not contain a URL.");
            }

            System.out.println("[Step 4] Downloading report document from: " + url);
            // Most reports are tab-delimited flat files. Print the contents (truncated for readability).
            String content = downloadDocument(url);
            System.out.println("[Step 4] Report content (first 1000 chars):");
            System.out.println(content.substring(0, Math.min(1000, content.length())));
        } catch (Exception e) {
            System.err.println("Error downloading/reading report document: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    private String downloadDocument(String url) throws IOException {
        Request request = new Request.Builder().url(url).get().build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("Failed to download report document, HTTP " + response.code());
            }
            ResponseBody body = response.body();
            if (body == null) {
                throw new IOException("Report document response had no body.");
            }
            return body.string();
        }
    }

    private ReportNotification parseNotification(String notificationJson) {
        try {
            return JSON.std.beanFrom(ReportNotification.class, notificationJson);
        } catch (Exception e) {
            System.err.println("Error parsing notification: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }
}
