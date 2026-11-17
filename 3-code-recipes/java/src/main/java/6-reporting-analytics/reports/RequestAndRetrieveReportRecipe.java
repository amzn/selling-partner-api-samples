package reports;

import com.fasterxml.jackson.jr.ob.JSON;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.w3c.dom.Document;
import reports.ReportNotification.ReportNotificationDetails;
import software.amazon.spapi.api.reports.v2021_06_30.ReportsApi;
import software.amazon.spapi.models.reports.v2021_06_30.CreateReportResponse;
import software.amazon.spapi.models.reports.v2021_06_30.CreateReportSpecification;
import software.amazon.spapi.models.reports.v2021_06_30.ReportDocument;
import util.Recipe;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.zip.GZIPInputStream;

/**
 * Reports API Recipe: Request, Retrieve and Download a Report
 * ===========================================================
 *
 * This recipe shows the complete, end-to-end Reports flow in four steps:
 *
 * 1. Request a report with createReport, which returns a reportId.
 * 2. Wait for the report to finish processing. Subscribe to the REPORT_PROCESSING_FINISHED notification and read the
 *       reportDocumentId from its payload (see {@link #handleNotification(String)}).
 * 3. Call getReportDocument with the reportDocumentId to get a short-lived, pre-signed download URL
 *    and, optionally, the compressionAlgorithm used.
 * 4. Download the document and parse it correctly.
 *
 * Step 4 is where a naive "decode as UTF-8 text" goes wrong. Three things make report documents
 * tricky:
 *
 * <ul>
 *   <li>Character encoding: SP-API reports are NOT all UTF-8. Some are Windows-1252,
 *       Japanese-marketplace reports use Shift-JIS (Windows-31J), and some UTF-8 reports begin
 *       with a Byte Order Mark (BOM). Encoding can differ by marketplace and change over time, so
 *       it is read from the download's Content-Type header rather than assumed. The
 *       getReportDocument API response itself never carries a charset; only the pre-signed S3
 *       download does.</li>
 *   <li>Document format: reports come as delimited text (TSV/CSV), JSON, XML, or binary (e.g.
 *       FBA_BULK_INVOICE is a .tar.gz of PDFs, FEE_DISCOUNTS_REPORT is an .xlsx,
 *       GET_EASYSHIP_DOCUMENTS is a PDF). Binary reports must be returned as raw bytes, never
 *       decoded as text.</li>
 *   <li>Compression: the getReportDocument response may report a compressionAlgorithm (e.g. GZIP).
 *       This transport-level compression is separate from a report whose <em>content</em> is
 *       itself an archive.</li>
 * </ul>
 *
 * To keep decompression and binary handling under our own control, the download request sends
 * {@code Accept-Encoding: identity} so OkHttp does not transparently gunzip the body; GZIP is then
 * handled explicitly based on the metadata's compressionAlgorithm.
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
     *
     * We decompress based on the returned compressionAlgorithm ourselves (see
     * {@link #fetchUrl(String, String)}), so enableContentEncodingUrlHeader is left false.
     */
    private ReportDocument getReportDocument(String reportDocumentId) {
        try {
            System.out.println("[Step 3] Calling getReportDocument for reportDocumentId=" + reportDocumentId);
            return reportsApi.getReportDocument(reportDocumentId, false);
        } catch (Exception e) {
            System.err.println("Error getting report document metadata: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    /**
     * Step 4: Download the document, parse it according to its format, and print a short preview.
     *
     * On failure the download is retried, but each attempt first calls getReportDocument again to
     * obtain a fresh pre-signed URL. The URL returned by getReportDocument is only valid for a short
     * period of time, so reusing the same URL on a retry would likely fail as well.
     */
    private ReportContent downloadAndReadDocument(String reportDocumentId) {
        ReportContent report = downloadDocument(reportDocumentId);
        printReportPreview(report);
        System.out.println("Report retrieved successfully.");
        return report;
    }

    /**
     * Download the report document, retrying on failure. Because pre-signed URLs are short-lived,
     * every attempt re-fetches the document metadata via getReportDocument to get a fresh URL
     * rather than reusing a URL that may already have expired.
     */
    private ReportContent downloadDocument(String reportDocumentId) {
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
                String compression = document.getCompressionAlgorithm() == null
                        ? null : document.getCompressionAlgorithm().getValue();
                return fetchUrl(url, compression);
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
     * Perform a single download of the pre-signed URL and parse the body into a {@link ReportContent}.
     *
     * The request sends {@code Accept-Encoding: identity} so OkHttp does not transparently gunzip
     * the response. This keeps the raw bytes available for binary reports and lets us decompress
     * GZIP explicitly from the metadata's compressionAlgorithm, matching the PHP and Python recipes.
     */
    private ReportContent fetchUrl(String url, String compressionAlgorithm) throws IOException {
        Request request = new Request.Builder()
                .url(url)
                .header("Accept-Encoding", "identity")
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("Failed to download report document, HTTP " + response.code());
            }
            ResponseBody body = response.body();
            if (body == null) {
                throw new IOException("Report document response had no body.");
            }

            byte[] data = body.bytes();

            // 1) Transport-level decompression, if getReportDocument reported it. This is separate
            //    from a report whose *content* is itself an archive (e.g. FBA_BULK_INVOICE is a
            //    .tar.gz of PDFs) - those arrive with NO compressionAlgorithm and are returned as
            //    binary below. Guard on the gzip magic number (0x1f 0x8b) so we never double-inflate
            //    a body that was already decompressed in transit.
            if (compressionAlgorithm != null && compressionAlgorithm.equalsIgnoreCase("GZIP")
                    && isGzip(data)) {
                System.out.println("[Step 4] compressionAlgorithm=GZIP; decompressing report document.");
                data = gunzip(data);
            }

            String contentType = response.header("Content-Type", "");
            String contentTypeLower = contentType.toLowerCase();

            // 2) Binary reports: return bytes untouched (PDF, XLSX, ZIP, .tar.gz, ...).
            if (isBinaryContentType(contentTypeLower)) {
                System.out.println("[Step 4] Binary report (content_type=" + contentType + ").");
                return ReportContent.binary(contentType, data);
            }

            // 3) Text: decode with the download's charset (reports are not all UTF-8; some are
            //    Windows-1252, JP reports use Shift-JIS), then strip a BOM.
            String text = stripByteOrderMark(decodeText(data, contentTypeLower));

            // 4) Dispatch on Content-Type, with a first-character fallback because SP-API sometimes
            //    labels JSON/XML report bodies as text/plain.
            String head = firstNonWhitespace(text);
            if (contentTypeLower.contains("json") || "{".equals(head) || "[".equals(head)) {
                System.out.println("[Step 4] Parsed JSON report.");
                return ReportContent.json(contentType, parseJson(text));
            }
            if (contentTypeLower.contains("xml") || "<".equals(head)) {
                // parse from raw bytes so the XML prolog's declared encoding is honored
                System.out.println("[Step 4] Parsed XML report.");
                return ReportContent.xml(contentType, parseXml(data));
            }

            // 5) Otherwise a delimited flat file (TSV/CSV) - return the decoded text.
            System.out.println("[Step 4] Decoded delimited (TSV/CSV) report.");
            return ReportContent.text(contentType, text);
        }
    }

    /** True if the Content-Type denotes a binary report that must not be decoded as text. */
    private boolean isBinaryContentType(String contentTypeLower) {
        return contentTypeLower.contains("application/pdf")
                || contentTypeLower.contains("octet-stream")
                || contentTypeLower.contains("zip")
                || contentTypeLower.contains("gzip")
                || contentTypeLower.contains("vnd.ms-excel")
                || contentTypeLower.contains("spreadsheetml")
                || contentTypeLower.contains("vnd.openxmlformats");
    }

    /**
     * Decode report bytes using the charset declared in the Content-Type header. SP-API reports are
     * not all UTF-8, so when no charset is declared we try UTF-8 and fall back to Windows-1252
     * (cp1252) rather than assuming UTF-8 unconditionally.
     */
    private String decodeText(byte[] data, String contentTypeLower) {
        String charsetName = null;
        int idx = contentTypeLower.indexOf("charset=");
        if (idx >= 0) {
            charsetName = contentTypeLower.substring(idx + "charset=".length()).split(";")[0].trim();
        }

        if (charsetName != null && !charsetName.isEmpty()) {
            return new String(data, Charset.forName(charsetName));
        }

        // No charset declared: try UTF-8 strictly, then fall back to Windows-1252.
        try {
            return new String(decodeStrict(data, StandardCharsets.UTF_8));
        } catch (RuntimeException e) {
            return new String(data, Charset.forName("windows-1252"));
        }
    }

    /** Decode strictly so invalid UTF-8 triggers the Windows-1252 fallback instead of mojibake. */
    private char[] decodeStrict(byte[] data, Charset charset) {
        java.nio.charset.CharsetDecoder decoder = charset.newDecoder()
                .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT);
        try {
            return decoder.decode(java.nio.ByteBuffer.wrap(data)).array();
        } catch (java.nio.charset.CharacterCodingException e) {
            throw new RuntimeException(e);
        }
    }

    private Object parseJson(String text) {
        try {
            // A JSON report body is typically an object or an array.
            String head = firstNonWhitespace(text);
            if ("[".equals(head)) {
                return JSON.std.listFrom(text);
            }
            return JSON.std.mapFrom(text);
        } catch (IOException e) {
            throw new RuntimeException("Failed to parse JSON report document.", e);
        }
    }

    private Document parseXml(byte[] data) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            // Harden against XXE: the report body is untrusted input.
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setExpandEntityReferences(false);
            return factory.newDocumentBuilder().parse(new ByteArrayInputStream(data));
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse XML report document.", e);
        }
    }

    /** Returns the first non-whitespace character of the text as a String, or "" if none. */
    private String firstNonWhitespace(String text) {
        for (int i = 0; i < text.length(); i++) {
            if (!Character.isWhitespace(text.charAt(i))) {
                return text.substring(i, i + 1);
            }
        }
        return "";
    }

    private boolean isGzip(byte[] data) {
        return data.length >= 2 && (data[0] & 0xff) == 0x1f && (data[1] & 0xff) == 0x8b;
    }

    private byte[] gunzip(byte[] data) throws IOException {
        try (GZIPInputStream in = new GZIPInputStream(new ByteArrayInputStream(data))) {
            return in.readAllBytes();
        }
    }

    /** Preview the parsed report based on its kind (replace with real processing for your use case). */
    private void printReportPreview(ReportContent report) {
        switch (report.kind) {
            case JSON:
                System.out.println("[Step 4] Report is JSON.");
                break;
            case XML:
                System.out.println("[Step 4] Report is XML. Root tag: <"
                        + report.xml.getDocumentElement().getNodeName() + ">");
                break;
            case BINARY:
                System.out.println("[Step 4] Report is binary (" + report.contentType + ", "
                        + report.bytes.length + " bytes). Write it to a file, e.g. untar FBA_BULK_INVOICE.");
                break;
            case TEXT:
                System.out.println("[Step 4] Report is a delimited flat file (TSV/CSV). First lines:");
                String[] lines = report.text.split("\\R", 6);
                for (int i = 0; i < lines.length && i < 5; i++) {
                    System.out.println(lines[i]);
                }
                break;
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
