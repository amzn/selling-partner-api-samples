<?php

namespace Src\reports;

use SpApi\Api\reports\v2021_06_30\ReportsApi;
use SpApi\Model\reports\v2021_06_30\CreateReportSpecification;
use SpApi\Model\reports\v2021_06_30\ReportDocument;
use Src\util\Recipe;

/**
 * Reports API Recipe: Request and Retrieve a Report
 * =================================================
 *
 * This recipe shows the end-to-end Reports flow in four steps:
 *
 * 1. Request a report with createReport, which returns a reportId.
 * 2. Wait for the report to finish processing. Subscribe to the REPORT_PROCESSING_FINISHED
 *    notification and read the reportDocumentId from its payload (see handleNotification()).
 * 3. Call getReportDocument with the reportDocumentId to get a pre-signed download URL and,
 *    optionally, the compression algorithm used.
 * 4. Download the document and read the contents. GZIP reports are decompressed with gzdecode().
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

        // Step 3: Retrieve the document metadata (pre-signed URL + compression).
        $document = $this->getReportDocument($reportDocumentId);

        // Step 4: Download and read the report contents.
        $this->downloadAndReadDocument($document);
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
     * Step 4: Download the document from the pre-signed URL and print its contents.
     */
    private function downloadAndReadDocument(ReportDocument $document): void
    {
        $url = $document->getUrl();
        if (empty($url)) {
            throw new \RuntimeException("Report document metadata does not contain a URL.");
        }

        echo "[Step 4] Downloading report document from: {$url}\n";
        $content = $this->downloadDocument($url, $document->getCompressionAlgorithm());

        // Most reports are tab-delimited flat files. Print the contents (truncated for readability).
        echo "[Step 4] Report content (first 1000 chars):\n";
        echo substr($content, 0, 1000) . "\n";
        echo "✅ Report retrieved successfully\n";
    }

    private function downloadDocument(string $url, ?string $compressionAlgorithm): string
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false || $statusCode < 200 || $statusCode >= 300) {
            throw new \RuntimeException("Failed to download report document, HTTP {$statusCode}");
        }

        // GZIP reports are served as raw gzip bytes and must be decompressed explicitly.
        if (strtoupper((string)$compressionAlgorithm) === "GZIP") {
            echo "[Step 4] compressionAlgorithm=GZIP; decompressing report document.\n";
            $decoded = gzdecode($response);
            if ($decoded === false) {
                throw new \RuntimeException("Failed to gzip-decompress report document.");
            }
            $response = $decoded;
        }

        return $response;
    }
}
