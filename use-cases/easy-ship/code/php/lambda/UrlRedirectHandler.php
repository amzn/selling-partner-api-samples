<?php

namespace lambda;

use Aws\DynamoDb\DynamoDbClient;
use Aws\DynamoDb\Exception\DynamoDbException;
use Lambda\Utils\Constants;
use Lambda\Utils\LambdaContext;
use Monolog\Logger;
use Psr\Log\LoggerInterface;

class UrlRedirectHandler
{
    public function handleRequest(array $event, LambdaContext $context): array
    {
        $logger = $context->getLogger();
        $logger->info('UrlRedirectHandler Lambda started', [
            'timestamp' => date('Y-m-d H:i:s'),
            'functionName' => getenv('AWS_LAMBDA_FUNCTION_NAME')
        ]);
        $orderId = $event['pathParameters']['orderId'];

        $presignedUrl = $this->getPresignedUrlForOrder($orderId, $logger);

        if (empty($presignedUrl)) {
            return [
                'statusCode' => 200,
                'headers' => ['Content-Type' => 'text/html'],
                'body' => '<html><body><h1>Invalid Link</h1><p>This link is not valid or has expired.</p></body></html>'
            ];
        }

        return [
            'statusCode' => 302,
            'headers' => [
                'Location' => $presignedUrl
            ],
            'body' => ''
        ];
    }

    /**
     * Retrieves the presigned S3 URL (long URL) for a given Amazon order ID from DynamoDB.
     *
     * Looks up the DynamoDB table using the order ID as the hash key.
     * If the item is found and contains a 'url' attribute, the URL is returned.
     * If not found or if 'url' is missing, an empty string is returned.
     *
     * @param string $orderId The Amazon order ID used as the partition key in DynamoDB.
     * @param Logger $logger
     * @return string The presigned S3 URL, or an empty string if not found.
     */
    private function getPresignedUrlForOrder(string $orderId, Logger $logger): string
    {
        $dynamoDb = new DynamoDbClient([
            'region' => getenv('AWS_REGION'),
            'version' => 'latest'
        ]);
        $key = [
            Constants::URL_TABLE_HASH_KEY_NAME => ['S' => $orderId]
        ];
        try {
            $result = $dynamoDb->getItem([
                'TableName' => getenv(Constants::URL_TABLE_NAME_ENV_VARIABLE),
                'Key' => $key
            ]);
            if (!isset($result['Item']['url']['S'])) {
                return '';
            }
            return $result['Item']['url']['S'];
        } catch (DynamoDbException $e) {
            $logger->error("Unable to get item: " . $e->getMessage());
            throw $e;
        }
    }
}
