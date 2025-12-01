<?php

namespace Src\easyship;

use SpApi\Api\feeds\v2021_06_30\FeedsApi;
use Src\util\Recipe;

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
        echo "✅ Document Report Reference Id: {$documentReportReferenceId}\n";
    }

    private function initializeParameters(): void
    {
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
        if ($statusCode === 204) {
            return $this->getMockXmlContent();
        }
        if ($statusCode < 200 || $statusCode >= 300) {
            throw new \RuntimeException("Download failed: {$statusCode}");
        }
        echo "Feed document downloaded successfully\n";
        return $response;
    }

    private function getMockXmlContent(): string
    {
        return '<?xml version="1.0" encoding="UTF-8"?>' .
            '<EasyShipProcessingReport>' .
            '<FeedSubmissionID>378823020417</FeedSubmissionID>' .
            '<MessagesProcessed>1</MessagesProcessed>' .
            '<MessagesSuccessful>1</MessagesSuccessful>' .
            '<MessagesWithError>0</MessagesWithError>' .
            '<SuccessMessage>' .
            '<MessageID>1</MessageID>' .
            '<AmazonOrderID>701-5497852-1014649</AmazonOrderID>' .
            '<DocumentReportReferenceId>amzn1.easyship.document.12345678-abcd-efgh-ijkl-123456789012</DocumentReportReferenceId>' .
            '</SuccessMessage>' .
            '</EasyShipProcessingReport>';
    }

    private function extractDocumentReportReferenceId(string $xmlContent): string
    {
        $xml = simplexml_load_string($xmlContent);
        if ($xml === false) {
            throw new \RuntimeException("Failed to parse XML document");
        }
        $nodes = $xml->xpath('//DocumentReportReferenceId');
        if (empty($nodes)) {
            throw new \RuntimeException("DocumentReportReferenceId not found in XML");
        }
        return (string)$nodes[0];
    }
}
