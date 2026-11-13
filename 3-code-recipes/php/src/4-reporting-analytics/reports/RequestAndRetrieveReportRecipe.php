<?php

namespace Src\reports;

use SpApi\Api\reports\v2021_06_30\ReportsApi;
use SpApi\Model\reports\v2021_06_30\CreateReportSpecification;
use SpApi\Model\reports\v2021_06_30\ReportDocument;
use Src\util\Recipe;

/**
 * Reports API Recipe: Request, Retrieve and Download a Report
 * ===========================================================
 *
 * This recipe shows the complete, end-to-end Reports flow in four steps:
 *
 * 1. Request a report with createReport, which returns a reportId.
 * 2. Wait for the report to finish processing. Subscribe to the REPORT_PROCESSING_FINISHED
 *    notification and read the reportDocumentId from its payload (see handleNotification()).
 * 3. Call getReportDocument with the reportDocumentId to get a short-lived, pre-signed download
 *    URL and, optionally, the compression algorithm used.
 * 4. Download the document and parse it correctly.
 *
 * Step 4 is where a naive "decode as UTF-8 text" goes wrong. Three things make report documents
 * tricky:
 *
 * - Character encoding: SP-API reports are NOT all UTF-8. Some are Windows-1252,
 *   Japanese-marketplace reports use Shift-JIS (Windows-31J), and some UTF-8 reports begin with a
 *   Byte Order Mark (BOM). Encoding can differ by marketplace and change over time, so it is read
 *   from the download's Content-Type header rather than assumed. The getReportDocument API
 *   response itself never carries a charset; only the pre-signed S3 download does.
 * - Document format: reports come as delimited text (TSV/CSV), JSON, XML, or binary (e.g.
 *   FBA_BULK_INVOICE is a .tar.gz of PDFs, FEE_DISCOUNTS_REPORT is an .xlsx, GET_EASYSHIP_DOCUMENTS
 *   is a PDF). Binary reports must be returned as raw bytes, never decoded as text.
 * - Compression: the getReportDocument response may report a compressionAlgorithm (e.g. GZIP).
 *   This transport-level compression is separate from a report whose *content* is itself an archive.
 *
 * Docs: https://developer-docs.amazon.com/sp-api/docs/reports-api-v2021-06-30-reference
 */
class RequestAndRetrieveReportRecipe extends Recipe
{
    /**
     * The report type to request. See the Report Type Values reference for the full list:
     * https://developer-docs.amazon.com/sp-api/docs/report-type-values
     */
    private const string SAMPLE_REPORT_TYPE = "GET_FLAT_FILE_OPEN_LISTINGS_DATA";

    /** US marketplace id. See https://developer-docs.amazon.com/sp-api/docs/marketplace-ids */
    private const string SAMPLE_MARKETPLACE_ID = "ATVPDKIKX0DER";

    /** Maximum number of attempts to download the report document before giving up. */
    private const int DOWNLOAD_MAX_ATTEMPTS = 3;

    /**
     * Base delay (in microseconds) used to back off between download retries. The actual delay
     * grows with each attempt (delay = base * attemptNumber).
     */
    private const int DOWNLOAD_RETRY_BASE_DELAY_MICROS = 1000000;

    /**
     * Sample REPORT_PROCESSING_FINISHED notification. In production you subscribe to this
     * notification (via the Notifications API) instead of polling getReport, and read the
     * reportDocumentId from the payload once processingStatus is DONE.
     * https://developer-docs.amazon.com/sp-api/docs/notification-type-values#report_processing_finished
     */
    private const string SAMPLE_NOTIFICATION = <<<'JSON'
    {
      "notificationVersion": "2021-06-30",
      "notificationType": "REPORT_PROCESSING_FINISHED",
      "payloadVersion": "2021-06-30",
      "eventTime": "2023-12-23T21:30:13.713Z",
      "payload": {
        "reportProcessingFinishedNotification": {
          "sellerId": "A3TUGXWLNSFPBS",
          "accountId": "amzn1.merchant.o.ABCD012345689",
          "reportId": "ID323",
          "reportType": "GET_FLAT_FILE_OPEN_LISTINGS_DATA",
          "processingStatus": "DONE",
          "reportDocumentId": "amzn1.spdoc.1.3.sample-report-document"
        }
      },
      "notificationMetadata": {
        "applicationId": "amzn1.sellerapps.app.aacccfff-4455-4b7c-4422-664ecacdd336",
        "subscriptionId": "subscription-id-d0e9e693-c3ad-4373-979f-ed4ec98dd746",
        "publishTime": "2023-12-23T21:30:16.903Z",
        "notificationId": "d0e9e693-c3ad-4373-979f-ed4ec98dd746"
      }
    }
    JSON;

    private ReportsApi $reportsApi;

    public function start(): void
    {
        $this->initializeReportsApi();

        // Step 1: Request the report.
        $reportId = $this->requestReport();
        echo "Report requested with ID: {$reportId}\n";

        // Step 2: Wait for processing to finish and obtain the reportDocumentId.
        $reportDocumentId = $this->handleNotification(self::SAMPLE_NOTIFICATION);
        if ($reportDocumentId === null) {
            echo "No downloadable report document available. Stopping.\n";
            return;
        }

        // Steps 3 & 4: Retrieve the document metadata (pre-signed URL + compression) and download
        // the report contents, retrying the whole sequence on failure. Each retry re-fetches a
        // fresh pre-signed URL because it is only valid for a short period of time (5 minutes).
        $this->downloadAndReadDocument($reportDocumentId);
    }

    private function initializeReportsApi(): void
    {
        $this->reportsApi = new ReportsApi($this->config);
        echo "Reports API client initialized\n";
    }

    /**
     * Step 1: Request a report by report type and marketplace.
     */
    private function requestReport(): string
    {
        $specification = new CreateReportSpecification();
        $specification->setReportType(self::SAMPLE_REPORT_TYPE);
        $specification->setMarketplaceIds([self::SAMPLE_MARKETPLACE_ID]);
        // Optional: bound the report data window with dataStartTime / dataEndTime,
        // and pass report-type-specific options via $specification->setReportOptions(...).

        $response = $this->reportsApi->createReport($specification);
        $reportId = $response->getReportId();

        echo "[Step 1] Report requested successfully. reportId = {$reportId}\n";
        return $reportId;
    }

    /**
     * Step 2: Handle a REPORT_PROCESSING_FINISHED notification and extract the
     * reportDocumentId. Returns null if the report is not ready or produced no document.
     */
    private function handleNotification(string $notificationJson): ?string
    {
        $notification = json_decode($notificationJson, true);
        if (!is_array($notification)) {
            throw new \RuntimeException("Failed to parse notification JSON");
        }

        $notificationType = $notification['notificationType'] ?? null;
        if ($notificationType !== "REPORT_PROCESSING_FINISHED") {
            echo "[Step 2a] Ignored wrong notificationType: {$notificationType}\n";
            return null;
        }

        $details = $notification['payload']['reportProcessingFinishedNotification'] ?? [];
        $reportId = $details['reportId'] ?? '';
        $processingStatus = $details['processingStatus'] ?? '';
        $reportDocumentId = $details['reportDocumentId'] ?? '';
        echo "[Step 2a] Notification for reportId={$reportId}, status={$processingStatus}\n";

        if ($processingStatus === "DONE" && $reportDocumentId !== '') {
            echo "[Step 2a] Using reportDocumentId={$reportDocumentId}\n";
            return $reportDocumentId;
        }

        echo "[Step 2a] No downloadable document from notification (status={$processingStatus}).\n";
        return null;
    }

    /**
     * Step 3: Retrieve the report document metadata (pre-signed URL + compression algorithm).
     */
    private function getReportDocument(string $reportDocumentId): ReportDocument
    {
        echo "[Step 3] Calling getReportDocument for reportDocumentId={$reportDocumentId}\n";
        return $this->reportsApi->getReportDocument($reportDocumentId);
    }

    /**
     * Step 4: Download the document, parse it according to its format, and print a short preview.
     *
     * On failure the download is retried, but each attempt first calls getReportDocument again to
     * obtain a fresh pre-signed URL. The URL returned by getReportDocument is only valid for a short
     * period of time, so reusing the same URL on a retry would likely fail as well.
     */
    private function downloadAndReadDocument(string $reportDocumentId): ReportContent
    {
        $report = $this->downloadDocument($reportDocumentId);
        $this->printReportPreview($report);
        echo "✅ Report retrieved successfully\n";
        return $report;
    }

    /**
     * Download the report document, retrying on failure. Because pre-signed URLs are short-lived,
     * every attempt re-fetches the document metadata via getReportDocument to get a fresh URL
     * rather than reusing a URL that may already have expired.
     */
    private function downloadDocument(string $reportDocumentId): ReportContent
    {
        $lastError = null;
        for ($attempt = 1; $attempt <= self::DOWNLOAD_MAX_ATTEMPTS; $attempt++) {
            // Re-fetch a fresh pre-signed URL on every attempt (they expire quickly).
            $document = $this->getReportDocument($reportDocumentId);
            $url = $document->getUrl();
            if (empty($url)) {
                throw new \RuntimeException("Report document metadata does not contain a URL.");
            }

            echo "[Step 4] Downloading report document (attempt {$attempt} of "
                . self::DOWNLOAD_MAX_ATTEMPTS . ") from: {$url}\n";
            try {
                return $this->fetchUrl($url, $document->getCompressionAlgorithm());
            } catch (\RuntimeException $e) {
                $lastError = $e;
                echo "[Step 4] Download attempt {$attempt} failed: {$e->getMessage()}\n";
                if ($attempt < self::DOWNLOAD_MAX_ATTEMPTS) {
                    $this->sleepBeforeRetry($attempt);
                }
            }
        }

        throw new \RuntimeException(
            "Failed to download report document after " . self::DOWNLOAD_MAX_ATTEMPTS . " attempts.",
            0,
            $lastError
        );
    }

    /**
     * Perform a single download of the pre-signed URL and parse the body into a ReportContent.
     *
     * curl is left without CURLOPT_ENCODING so the body is returned as raw bytes. This keeps the
     * bytes intact for binary reports and lets us decompress GZIP explicitly from the metadata's
     * compressionAlgorithm.
     */
    private function fetchUrl(string $url, ?string $compressionAlgorithm): ReportContent
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = strtolower((string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE));
        curl_close($ch);

        if ($response === false || $statusCode < 200 || $statusCode >= 300) {
            throw new \RuntimeException("Failed to download report document, HTTP {$statusCode}");
        }

        $data = (string)$response;

        // 1) Transport-level decompression, if getReportDocument reported it. This is separate from
        //    a report whose *content* is itself an archive (e.g. FBA_BULK_INVOICE is a .tar.gz of
        //    PDFs) - those arrive with NO compressionAlgorithm and are returned as binary below.
        //    Guard on the gzip magic number (0x1f 0x8b) so we never double-inflate a body that was
        //    already decompressed in transit.
        if (strtoupper((string)$compressionAlgorithm) === "GZIP" && $this->isGzip($data)) {
            echo "[Step 4] compressionAlgorithm=GZIP; decompressing report document.\n";
            $decoded = gzdecode($data);
            if ($decoded === false) {
                throw new \RuntimeException("Failed to gzip-decompress report document.");
            }
            $data = $decoded;
        }

        // 2) Binary reports: return bytes untouched (PDF, XLSX, ZIP, .tar.gz, ...).
        if ($this->isBinaryContentType($contentType)) {
            echo "[Step 4] Binary report (content_type={$contentType}).\n";
            return ReportContent::binary($contentType, $data);
        }

        // 3) Text: decode with the download's charset (reports are not all UTF-8; some are
        //    Windows-1252, JP reports use Shift-JIS), then strip a BOM.
        $text = $this->stripByteOrderMark($this->decodeText($data, $contentType));

        // 4) Dispatch on Content-Type, with a first-character fallback because SP-API sometimes
        //    labels JSON/XML report bodies as text/plain.
        $head = substr(ltrim($text), 0, 1);
        if (str_contains($contentType, "json") || $head === "{" || $head === "[") {
            echo "[Step 4] Parsed JSON report.\n";
            $decoded = json_decode($text, true);
            if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
                throw new \RuntimeException("Failed to parse JSON report document: " . json_last_error_msg());
            }
            return ReportContent::json($contentType, $decoded);
        }
        if (str_contains($contentType, "xml") || $head === "<") {
            echo "[Step 4] Parsed XML report.\n";
            return ReportContent::xml($contentType, $this->parseXml($data));
        }

        // 5) Otherwise a delimited flat file (TSV/CSV) - return the decoded text.
        echo "[Step 4] Decoded delimited (TSV/CSV) report.\n";
        return ReportContent::text($contentType, $text);
    }

    /** True if the Content-Type denotes a binary report that must not be decoded as text. */
    private function isBinaryContentType(string $contentType): bool
    {
        foreach (
            [
                "application/pdf",
                "octet-stream",
                "zip",
                "gzip",
                "vnd.ms-excel",
                "spreadsheetml",
                "vnd.openxmlformats",
            ] as $token
        ) {
            if (str_contains($contentType, $token)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Decode report bytes using the charset declared in the Content-Type header. SP-API reports are
     * not all UTF-8, so when no charset is declared we try UTF-8 and fall back to Windows-1252
     * (cp1252) rather than assuming UTF-8 unconditionally.
     */
    private function decodeText(string $data, string $contentType): string
    {
        $charset = null;
        if (preg_match('/charset=([^;]+)/i', $contentType, $matches)) {
            $charset = strtoupper(trim($matches[1]));
        }

        if ($charset !== null && $charset !== "" && $charset !== "UTF-8") {
            // Normalize everything to UTF-8 for downstream handling.
            return mb_convert_encoding($data, "UTF-8", $charset);
        }

        if ($charset === "UTF-8") {
            return $data;
        }

        // No charset declared: if the bytes are not valid UTF-8, treat them as Windows-1252.
        if (!mb_check_encoding($data, "UTF-8")) {
            return mb_convert_encoding($data, "UTF-8", "Windows-1252");
        }
        return $data;
    }

    private function parseXml(string $data): \SimpleXMLElement
    {
        // Harden against XXE: the report body is untrusted input. libxml disables external entity
        // loading by default on modern libxml, but we parse without LIBXML_NOENT to be explicit.
        $previous = libxml_use_internal_errors(true);
        $xml = simplexml_load_string($data);
        libxml_use_internal_errors($previous);
        if ($xml === false) {
            throw new \RuntimeException("Failed to parse XML report document.");
        }
        return $xml;
    }

    private function isGzip(string $data): bool
    {
        return strlen($data) >= 2 && ord($data[0]) === 0x1f && ord($data[1]) === 0x8b;
    }

    /** Preview the parsed report based on its kind (replace with real processing for your use case). */
    private function printReportPreview(ReportContent $report): void
    {
        switch ($report->getKind()) {
            case ReportContent::KIND_JSON:
                echo "[Step 4] Report is JSON.\n";
                break;
            case ReportContent::KIND_XML:
                echo "[Step 4] Report is XML. Root tag: <{$report->getXml()->getName()}>\n";
                break;
            case ReportContent::KIND_BINARY:
                $size = strlen($report->getBytes());
                echo "[Step 4] Report is binary ({$report->getContentType()}, {$size} bytes). "
                    . "Write it to a file, e.g. untar FBA_BULK_INVOICE.\n";
                break;
            case ReportContent::KIND_TEXT:
                echo "[Step 4] Report is a delimited flat file (TSV/CSV). First lines:\n";
                $lines = preg_split('/\R/', $report->getText());
                foreach (array_slice($lines, 0, 5) as $line) {
                    echo $line . "\n";
                }
                break;
        }
    }

    /**
     * Some reports are encoded as UTF-8 with a leading Byte Order Mark (BOM). The BOM is a
     * zero-width, non-printing sequence (the bytes 0xEF 0xBB 0xBF) that some tools emit at the
     * start of a file to signal the encoding. If it is not removed, it becomes part of the first
     * field of the first row (e.g. the first column header), which breaks header matching and
     * parsing. Strip it so the content starts with the real data.
     */
    private function stripByteOrderMark(string $content): string
    {
        if (str_starts_with($content, "\xEF\xBB\xBF")) {
            return substr($content, 3);
        }
        return $content;
    }

    /**
     * Back off between download retries using a simple exponential delay.
     */
    private function sleepBeforeRetry(int $attempt): void
    {
        usleep(self::DOWNLOAD_RETRY_BASE_DELAY_MICROS * $attempt);
    }
}
