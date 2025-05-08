<?php

namespace Lambda;

use GuzzleHttp\Exception\GuzzleException;
use Lambda\Utils\ApiUtils;
use Lambda\Utils\Constants;
use Lambda\Utils\HttpFileTransferUtil;
use Lambda\utils\LambdaContext;
use Lambda\Utils\Model\StateMachineInput;
use Lambda\Utils\StateMachineInputConverter;
use Lambda\Utils\XmlUtil;
use SpApi\Api\feeds\v2021_06_30\FeedsApi;
use SpApi\ApiException;
use SpApi\Model\feeds\v2021_06_30\Feed;
use SpApi\Model\feeds\v2021_06_30\FeedDocument;

class GetFeedDocumentHandler
{
    public function handleRequest(array $event, LambdaContext $context): StateMachineInput
    {
        $input = StateMachineInputConverter::convertFromArray($event);
        $logger = $context->getLogger();
        $logger->info('GetFeedDocument Lambda input: ' . json_encode($event, JSON_PRETTY_PRINT));

        try {
            // Initialize API Client
            $feedsApi = ApiUtils::getFeedsApi($input);

            // Wait for Feed completion
            $resultFeedDocumentId = $this->waitForFeedCompletion($feedsApi, $input->getFeedId(), $logger);

            // Get Feed Document
            $document = $this->getFeedDocument($feedsApi, $resultFeedDocumentId, $logger);

            // Download Document
            $documentStream = HttpFileTransferUtil::download($document->getUrl());

            // Extract documentReportReferenceId from the document
            $documentReportReferenceId =
                XmlUtil::getXmlDocumentTag($documentStream, Constants::FEED_DOCUMENT_REPORT_REFERENCE_ID);
            $input->setReportId($documentReportReferenceId);

            return $input;
        } catch (\Exception $e) {
            $logger->error('Error: ' . $e->getMessage());
            throw new \RuntimeException('Feed document processing failed', 0, $e);
        } catch (GuzzleException $e) {
            $logger->error('Error: ' . $e->getMessage());
            throw new \RuntimeException('Feed document processing failed', 0, $e);
        }
    }

    /**
     * Wait for the feed to complete processing
     *
     * @param FeedsApi $feedsApi
     * @param string $feedId
     * @param $logger
     * @return string
     * @throws \Exception
     */
    private function waitForFeedCompletion(FeedsApi $feedsApi, string $feedId, $logger): string
    {
        $attempts = 0;

        while ($attempts < Constants::MAX_RETRY_ATTEMPTS) {
            $feedResponse = $feedsApi->getFeed($feedId);

            if ($feedResponse->getProcessingStatus() === Feed::PROCESSING_STATUS_DONE) {
                $logger->info('Feeds API - Get Feeds response: ' . json_encode($feedResponse));
                return $feedResponse->getResultFeedDocumentId();
            }

            if ($feedResponse->getProcessingStatus() === Feed::PROCESSING_STATUS_FATAL) {
                throw new \RuntimeException('Feed processing failed with FATAL status');
            }

            $attempts++;
            usleep(Constants::POLLING_INTERVAL_MS * 1000); // Convert milliseconds to microseconds
        }

        throw new \RuntimeException('Feed processing timed out after ' . Constants::MAX_RETRY_ATTEMPTS . ' attempts');
    }

    /**
     * Get Feed Document
     *
     * @param FeedsApi $feedsApi
     * @param string $documentId
     * @param $logger
     * @return FeedDocument
     * @throws ApiException
     */
    private function getFeedDocument(FeedsApi $feedsApi, string $documentId, $logger): FeedDocument
    {
        $document = $feedsApi->getFeedDocument($documentId);
        $logger->info('Feeds API - Get Feeds Document response: ' . json_encode($document));
        return $document;
    }
}
