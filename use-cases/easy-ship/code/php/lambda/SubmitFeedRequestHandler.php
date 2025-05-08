<?php

namespace Lambda;

use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use Lambda\Utils\ApiUtils;
use Lambda\Utils\HttpFileTransferUtil;
use Lambda\utils\LambdaContext;
use Lambda\Utils\model\StateMachineInput;
use Lambda\Utils\StateMachineInputConverter;
use Lambda\Utils\XmlUtil;
use Lambda\utils\Constants;
use SpApi\Model\feeds\v2021_06_30\CreateFeedDocumentSpecification;
use SpApi\Model\feeds\v2021_06_30\CreateFeedSpecification;

class SubmitFeedRequestHandler
{
    public function handleRequest(array $event, LambdaContext $context): StateMachineInput
    {
        $input = StateMachineInputConverter::convertFromArray($event);

        $logger = $context->getLogger();
        $logger->info('SubmitFeedRequest Lambda input: ' . json_encode($event, JSON_PRETTY_PRINT));

        try {
            // Initialize Feeds API client
            $feedsApi = ApiUtils::getFeedsApi($input);

            // Create Feed Document
            $contentType = 'text/xml; charset=UTF-8';
            $createFeedDocumentSpec = new CreateFeedDocumentSpecification(['content_type' => $contentType]);

            $createFeedDocumentResponse = $feedsApi->createFeedDocument($createFeedDocumentSpec);
            $logger->info('Feed API - Create Feeds document response: ' . json_encode($createFeedDocumentResponse));

            // Upload Feed Document
            $url = $createFeedDocumentResponse->getUrl();
            $content = XmlUtil::generateEasyShipAmazonEnvelope(
                $input->getSellerId(),
                $input->getAmazonOrderId(),
                Constants::FEED_OPTIONS_DOCUMENT_TYPE_VALUE
            );

            HttpFileTransferUtil::upload($content, $url);

            // Create Feed
            $createFeedSpec = (new CreateFeedSpecification())
                ->setFeedType(Constants::POST_EASYSHIP_DOCUMENTS)
                ->setMarketplaceIds([$input->getMarketplaceId()])
                ->setFeedOptions([
                    Constants::FEED_OPTIONS_KEY_AMAZON_ORDER_ID => $input->getAmazonOrderId(),
                    Constants::FEED_OPTIONS_KEY_DOCUMENT_TYPE => Constants::FEED_OPTIONS_DOCUMENT_TYPE_VALUE
                ])
                ->setInputFeedDocumentId($createFeedDocumentResponse->getFeedDocumentId());


            $logger->info('Feed API - Create Feeds request body: ' . json_encode($createFeedSpec));
            $createFeedResponse = $feedsApi->createFeed($createFeedSpec);
            $logger->info('Feed API - Create Feeds response: ' . json_encode($createFeedResponse));

            // Set Feed ID in input
            $input->setFeedId($createFeedResponse->getFeedId());

            return $input;
        } catch (RequestException $e) {
            $logger->error('RequestException: ' . $e->getMessage());
            throw new \RuntimeException('Submit Feed Request failed', 0, $e);
        } catch (\Exception $e) {
            $logger->error('Exception: ' . $e->getMessage());
            throw new \RuntimeException('An unexpected error occurred', 0, $e);
        } catch (GuzzleException $e) {
        }
    }
}
