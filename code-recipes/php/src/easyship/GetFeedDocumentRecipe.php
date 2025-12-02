<?php

namespace Src\easyship;

use SpApi\Api\feeds\v2021_06_30\FeedsApi;
use Src\util\Recipe;

/**
 * Code Recipe to get feed document and extract document report reference ID
 * Steps:
 * 1. Get feed status to retrieve resultFeedDocumentId
 * 2. Get feed document to retrieve download URL
 * 3. Download feed result document
 * 4. Parse XML and extract DocumentReportReferenceID
 */
class GetFeedDocumentRecipe extends Recipe
{
    private FeedsApi $feedsApi;
    private string $feedId;

    public function start(): void
    {
        $this->initializeParameters();
        $this->initializeFeedsApi();
        $resultFeedDocumentId = $this->getFeedStatus();
        $documentUrl = $this->getFeedDocumentUrl($resultFeedDocumentId);
        $xmlContent = $this->downloadFeedDocument($documentUrl);
        $documentReportReferenceId = $this->extractDocumentReportReferenceId($xmlContent);
        echo "✅ Document Report Reference Id [Used to Retrieve the Shipping Label through the Reports API]: {$documentReportReferenceId}\n";
    }

    private function initializeParameters(): void
    {
        // Feed ID Generated during the SubmitFeedRequestRecipe to generate the Shipping Label
        $this->feedId = "378823020417";
        echo "Parameters initialized for feed: {$this->feedId}\n";
    }

    private function initializeFeedsApi(): void
    {
        $this->feedsApi = new FeedsApi($this->config);
        echo "Feeds API client initialized\n";
    }

    private function getFeedStatus(): string
    {
        $feed = $this->feedsApi->getFeed($this->feedId);
        if ($feed->getProcessingStatus() !== 'DONE') {
            throw new \RuntimeException("Feed is not done. Current status: {$feed->getProcessingStatus()}");
        }
        echo "Feed status retrieved: {$feed->getProcessingStatus()}\n";
        return $feed->getResultFeedDocumentId();
    }

    private function getFeedDocumentUrl(string $feedDocumentId): string
    {
        $feedDocument = $this->feedsApi->getFeedDocument($feedDocumentId);
        echo "Feed document URL retrieved {$feedDocument->getUrl()}\n";
        return $feedDocument->getUrl();
    }

    private function downloadFeedDocument(string $url): string
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        echo $response . "\n";
        if ($statusCode < 200 || $statusCode >= 300) {
            throw new \RuntimeException("Download failed: {$statusCode}");
        }
        echo "Feed document downloaded successfully\n";
        return $response;
    }

    private function extractDocumentReportReferenceId(string $xmlContent): string
    {
        $xml = simplexml_load_string($xmlContent);
        if ($xml === false) {
            throw new \RuntimeException("Failed to parse XML document");
        }
        $nodes = $xml->xpath('//DocumentReportReferenceID');
        if (empty($nodes)) {
            throw new \RuntimeException("DocumentReportReferenceID not found in XML");
        }
        return (string)$nodes[0];
    }
}
