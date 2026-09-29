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

            // Steps 3 & 4: Retrieve the document metadata (pre-signed URL) and download the
            // report contents, retrying the whole sequence on failure. Each retry re-fetches a
            // fresh pre-signed URL because it is only valid for a short period of time (5 minutes).
            downloadAndReadDocument(reportDocumentId);
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
     * Step 4: Download the document and print its contents.
     *
     * On failure the download is retried, but each attempt first calls getReportDocument again to
     * obtain a fresh pre-signed URL. The URL returned by getReportDocument is only valid for a short
     * period of time, so reusing the same URL on a retry would likely fail as well.
     */
    private void downloadAndReadDocument(String reportDocumentId) {
        String content = downloadDocument(reportDocumentId);
        System.out.println("[Step 4] Report content (first 1000 chars):");
        System.out.println(content.substring(0, Math.min(1000, content.length())));
    }

    /**
     * Download the report document, retrying on failure. Because pre-signed URLs are short-lived,
     * every attempt re-fetches the document metadata via getReportDocument to get a fresh URL
     * rather than reusing a URL that may already have expired.
     */
    private String downloadDocument(String reportDocumentId) {
        IOException lastError = null;
        for (int attempt = 1; attempt <= Constants.DOWNLOAD_MAX_ATTEMPTS; attempt++) {
            // Re-fetch a fresh pre-signed URL on every attempt
            ReportDocument document = getReportDocument(reportDocumentId);
            String url = document.getUrl();
            if (url == null || url.isEmpty()) {
                throw new RuntimeException("Report document metadata does not contain a URL.");
            }

            System.out.println("[Step 4] Downloading report document (attempt " + attempt + " of "
                    + Constants.DOWNLOAD_MAX_ATTEMPTS + ") from: " + url);
            try {
                return fetchUrl(url);
            } catch (IOException e) {
                lastError = e;
                System.err.println("[Step 4] Download attempt " + attempt + " failed: " + e.getMessage());
                if (attempt < Constants.DOWNLOAD_MAX_ATTEMPTS) {
                    sleepBeforeRetry(attempt);
                }
            }
        }

        throw new RuntimeException("Failed to download report document after "
                + Constants.DOWNLOAD_MAX_ATTEMPTS + " attempts.", lastError);
    }

    /**
     * Perform a single download of the pre-signed URL and return the body as a string.
     */
    private String fetchUrl(String url) throws IOException {
        Request request = new Request.Builder().url(url).get().build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("Failed to download report document, HTTP " + response.code());
            }
            ResponseBody body = response.body();
            if (body == null) {
                throw new IOException("Report document response had no body.");
            }
            return stripByteOrderMark(body.string());
        }
    }

    /**
     * Some reports are encoded as UTF-8 with a leading Byte Order Mark (BOM). The BOM is a
     * zero-width, non-printing character (U+FEFF) that some tools emit at the start of a file to
     * signal the encoding. If it is not removed, it becomes part of the first field of the first
     * row (e.g. the first column header), which breaks header matching and parsing. Strip it so the
     * content starts with the real data.
     */
    private String stripByteOrderMark(String content) {
        if (content != null && !content.isEmpty() && content.charAt(0) == '\uFEFF') {
            return content.substring(1);
        }
        return content;
    }

    /**
     * Back off between download retries using a simple exponential delay.
     */
    private void sleepBeforeRetry(int attempt) {
        try {
            Thread.sleep(Constants.DOWNLOAD_RETRY_BASE_DELAY_MILLIS * attempt);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted while waiting to retry report download.", ie);
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
