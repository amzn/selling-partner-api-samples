<?php

namespace Src\easyship;

use SpApi\Api\feeds\v2021_06_30\FeedsApi;
use SpApi\Model\feeds\v2021_06_30\CreateFeedDocumentSpecification;
use SpApi\Model\feeds\v2021_06_30\CreateFeedSpecification;
use Src\util\Recipe;

class SubmitFeedRequestRecipe extends Recipe
{
    private FeedsApi $feedsApi;
    private string $sellerId;
    private string $amazonOrderId;
    private string $marketplaceId;

    public function start(): void
    {
        $this->initializeParameters();
        $this->initializeFeedsApi();
        $feedDocResponse = $this->createFeedDocument();
        $this->uploadFeedDocument($feedDocResponse->getUrl());
        $feedResponse = $this->createFeed($feedDocResponse->getFeedDocumentId());
        echo "Feed created: {$feedResponse}\n";
        echo "✅ Feed Id: {$feedResponse->getFeedId()}\n";
    }

    private function initializeParameters(): void
    {
        $this->sellerId = "A2ZPJ4TLUOSWY8";
        $this->amazonOrderId = "702-3035602-4225066";
        $this->marketplaceId = "A1AM78C64UM0Y8";
        echo "Parameters initialized for order: {$this->amazonOrderId}\n";
    }

    private function initializeFeedsApi(): void
    {
        $this->feedsApi = new FeedsApi($this->config);
        echo "Feeds API client initialized\n";
    }

    private function createFeedDocument()
    {
        $contentType = "text/xml; charset=UTF-8";
        $spec = new CreateFeedDocumentSpecification();
        $spec->setContentType($contentType);
        $response = $this->feedsApi->createFeedDocument($spec);
        echo "Feed document created: {$response->getFeedDocumentId()}\n";
        return $response;
    }

    private function uploadFeedDocument(string $url): void
    {
        $xmlContent = $this->generateEasyShipXml();
        $contentType = "text/xml; charset=UTF-8";

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
        curl_setopt($ch, CURLOPT_POSTFIELDS, $xmlContent);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: {$contentType}"]);
        curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($statusCode < 200 || $statusCode >= 300) {
            throw new \RuntimeException("Upload failed: {$statusCode}");
        }
        echo "Feed document uploaded successfully\n";
    }

    private function generateEasyShipXml(): string
    {
        return sprintf(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" .
            "<AmazonEnvelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" " .
            "xsi:noNamespaceSchemaLocation=\"amzn-envelope.xsd\">\n" .
            "  <Header>\n" .
            "    <DocumentVersion>1.01</DocumentVersion>\n" .
            "    <MerchantIdentifier>%s</MerchantIdentifier>\n" .
            "  </Header>\n" .
            "  <MessageType>EasyShipDocument</MessageType>\n" .
            "  <Message>\n" .
            "    <MessageID>1</MessageID>\n" .
            "    <EasyShipDocument>\n" .
            "      <AmazonOrderID>%s</AmazonOrderID>\n" .
            "      <DocumentType>ShippingLabel</DocumentType>\n" .
            "    </EasyShipDocument>\n" .
            "  </Message>\n" .
            "</AmazonEnvelope>",
            $this->sellerId,
            $this->amazonOrderId
        );
    }

    private function createFeed(string $feedDocumentId)
    {
        $feedOptions = [
            'AmazonOrderId' => $this->amazonOrderId,
            'DocumentType' => 'ShippingLabel'
        ];

        $spec = new CreateFeedSpecification();
        $spec->setFeedType('POST_EASYSHIP_DOCUMENTS');
        $spec->setMarketplaceIds([$this->marketplaceId]);
        $spec->setFeedOptions($feedOptions);
        $spec->setInputFeedDocumentId($feedDocumentId);

        $response = $this->feedsApi->createFeed($spec);
        echo "Feed created successfully\n";
        return $response;
    }
}
