<?php

namespace Src\easyship;

use SpApi\Api\reports\v2021_06_30\ReportsApi;
use Src\util\Recipe;

class DownloadShippingLabelRecipe extends Recipe
{
    private ReportsApi $reportsApi;
    private string $reportId;

    public function start(): void
    {
        $this->initializeParameters();
        $this->initializeReportsApi();
        $reportDocumentId = $this->getReportDocumentId();
        $documentUrl = $this->getReportDocumentUrl($reportDocumentId);
        $labelData = $this->downloadAndDecompressDocument($documentUrl);
        echo "Shipping label downloaded successfully (" . strlen($labelData) . " bytes)\n";
    }

    private function initializeParameters(): void
    {
        $this->reportId = "amzn1.easyship.document.12345678-abcd-efgh-ijkl-123456789012";
        echo "Parameters initialized for report: {$this->reportId}\n";
    }

    private function initializeReportsApi(): void
    {
        $this->reportsApi = new ReportsApi($this->config);
        echo "Reports API client initialized\n";
    }

    private function getReportDocumentId(): string
    {
        $report = $this->reportsApi->getReport($this->reportId);
        echo "Report status: {$report->getProcessingStatus()}\n";
        return $report->getReportDocumentId();
    }

    private function getReportDocumentUrl(string $reportDocumentId): string
    {
        $reportDocument = $this->reportsApi->getReportDocument($reportDocumentId);
        echo "Report document URL retrieved\n";
        return $reportDocument->getUrl();
    }

    private function downloadAndDecompressDocument(string $url): string
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $compressedData = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($statusCode < 200 || $statusCode >= 300) {
            throw new \RuntimeException("Download failed: {$statusCode}");
        }

        echo "Document downloaded, decompressing...\n";
        return gzdecode($compressedData);
    }
}
