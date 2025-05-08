<?php

namespace Lambda;

use Aws\DynamoDb\DynamoDbClient;
use Aws\S3\Exception\S3Exception;
use Aws\S3\S3Client;
use DateTimeInterface;
use GuzzleHttp\Exception\GuzzleException;
use Lambda\Utils\ApiUtils;
use Lambda\utils\Constants;
use Lambda\Utils\HttpFileTransferUtil;
use Lambda\utils\LambdaContext;
use Lambda\Utils\Model\StateMachineInput;
use Lambda\Utils\StateMachineInputConverter;
use Monolog\Logger;

class GetReportDocumentHandler
{
    public function handleRequest(array $event, LambdaContext $context): array
    {
        $input = StateMachineInputConverter::convertFromArray($event);
        $logger = $context->getLogger();
        $logger->info('GetReportDocument Lambda input: ' . json_encode($event, JSON_PRETTY_PRINT));

        try {
            // Initialize API Client
            $reportsApi = ApiUtils::getReportsApi($input);

            // Get reportDocumentId from ReportAPI
            $reportDocumentId = $this->waitForReportCompletion($reportsApi, $input, $logger);

            // Get Report Document
            $documentUrl = $this->getReportDocumentUrl($reportsApi, $reportDocumentId, $logger);

            // Download Report Document
            $documentStream = HttpFileTransferUtil::download($documentUrl);

            // Get S3 bucket name from environment variables
            $s3BucketName = getenv(Constants::EASYSHIP_LABEL_S3_BUCKET_NAME_ENV_VARIABLE);
            $objectKey = $this->generateObjectKey($input);

            $logger->info('S3 Bucket Name: ' . $s3BucketName . ' S3 Object Key: ' . $objectKey);

            // Store into S3 bucket
            $this->storeDocumentInS3($s3BucketName, $objectKey, $documentStream);

            // Generate a presigned URL
            $presignedUrl = $this->generatePresignedUrl($s3BucketName, $objectKey, $logger);

            // Generate shortlink and store to DynamoDB
            $shortUrl = $this->convertToShortUrl($presignedUrl, $input, $logger);

            // Generate Message content
            return $this->generateMessageContents($shortUrl, $input, $logger);

        } catch (\Exception $e) {
            $logger->error('Error: ' . $e->getMessage());
            throw new \RuntimeException('GetReportDocument request failed', 0, $e);
        } catch (GuzzleException $e) {
        }
    }

    /**
     * Generates the subject and message body for the Easy Ship label notification.
     *
     * @param string $shortUrl The shortened URL pointing to the downloadable label.
     * @param StateMachineInput $input The input data containing order details.
     * @param Logger $logger used to log the generated message.
     * @return array Associative array with 'subject' and 'message' keys for the notification.
     */
    private function generateMessageContents(string $shortUrl, StateMachineInput $input, Logger $logger): array
    {
        $orderId = $input->getAmazonOrderId();

        $timeSlots = $input->getTimeSlots();
        $pickupTime = '';
        if (!empty($timeSlots)) {
            $firstSlot = $timeSlots[0];
            $pickupTime = $firstSlot->getStartTime()->format(DateTimeInterface::ATOM) . ' ~ ' . $firstSlot->getEndTime()->format(DateTimeInterface::ATOM);
        }

        $orderItems = $input->getEasyShipOrder()->getOrderItems() ?? [];
        $skuList = array_map(fn($item) => $item->getSku(), $orderItems);
        $skuJoined = implode(', ', $skuList);

        // Generate Message and Title
        $subject = "Label Ready - Order " . $orderId;
        $message = sprintf(
            "Your shipping label is ready.\nOrder Number: %s\nTime of Pickup: %s\nSku: %s\nDownload your label:\n%s",
            $orderId,
            $pickupTime,
            $skuJoined,
            $shortUrl
        );

        $logger->info("Generated message: " . $message);

        // return as array
        return [
            'subject' => $subject,
            'message' => $message
        ];
    }

    /**
     * Converts a presigned S3 URL into a short URL and stores the mapping in DynamoDB.
     *
     * @param string $presignedUrl The long presigned URL to be shortened.
     * @param StateMachineInput $input The input containing the order ID.
     * @param Logger $logger Logger used for logging information and errors.
     * @return string The generated short URL.
     * @throws \RuntimeException If the SHORTLINK_BASE_URL environment variable is not set.
     */
    private function convertToShortUrl(string $presignedUrl, StateMachineInput $input, Logger $logger): string
    {
        $shortlinkBaseUrl = getenv(Constants::SHORTLINK_BASE_URL_ENV_VARIABLE);
        $orderId = $input->getAmazonOrderId();

        if (!$shortlinkBaseUrl) {
            throw new \RuntimeException('SHORTLINK_BASE_URL is not set in environment variables');
        }

        // Store long URL to DynamoDB
        $this->storeUrlInDynamoDb($orderId, $presignedUrl, $logger);

        // Generate short URL
        return rtrim($shortlinkBaseUrl, '/') . '/' . $orderId;
    }

    /**
     * Stores a mapping of order ID to the original presigned URL in DynamoDB for shortlink resolution.
     *
     * @param string $orderId The Amazon order ID.
     * @param string $presignedUrl The original presigned URL to the label.
     * @param Logger $logger Logger used for logging.
     * @throws \RuntimeException If the URL_TABLE_NAME environment variable is not set.
     */
    private function storeUrlInDynamoDb(string $orderId, string $presignedUrl, Logger $logger): void
    {
        $dynamoDb = new DynamoDbClient([
            'region' => getenv('AWS_REGION'),
            'version' => 'latest'
        ]);

        $tableName = getenv(Constants::URL_TABLE_NAME_ENV_VARIABLE);
        if (!$tableName) {
            throw new \RuntimeException('URL_TABLE_NAME is not set');
        }

        $logger->info("Storing shortlink: OrderId = $orderId");

        $dynamoDb->putItem([
            'TableName' => $tableName,
            'Item' => [
                Constants::URL_TABLE_HASH_KEY_NAME => ['S' => $orderId],
                'url' => ['S' => $presignedUrl],
                'createdAt' => ['S' => (new \DateTime())->format(DATE_ATOM)],
            ]
        ]);
    }

    /**
     * @throws \Exception
     */
    private function waitForReportCompletion($reportsApi, StateMachineInput $input, $logger): string
    {
        $attempts = 0;

        while ($attempts < Constants::MAX_RETRY_ATTEMPTS) {
            $report = $reportsApi->getReport($input->getReportId());

            if ($report->getProcessingStatus() === 'DONE') {
                $logger->info('Report API - Get Report response: ' . json_encode($report));
                return $report->getReportDocumentId();
            }

            if ($report->getProcessingStatus() === 'FATAL') {
                throw new \RuntimeException('Get Report Process Failed!');
            }

            $attempts++;
            usleep(Constants::POLLING_INTERVAL_MS * 1000); // Convert milliseconds to microseconds
        }

        throw new \RuntimeException('Report processing timed out after ' . Constants::MAX_RETRY_ATTEMPTS . ' attempts');
    }

    private function getReportDocumentUrl($reportsApi, string $reportDocumentId, $logger): string
    {
        $document = $reportsApi->getReportDocument($reportDocumentId);
        $logger->info('Report API - Get Report Document response: ' . json_encode($document));
        return $document->getUrl();
    }

    /**
     * @throws \Exception
     */
    private function generateObjectKey(StateMachineInput $input): string
    {
        return sprintf(
            '%s-%s-%s.pdf',
            $input->getAmazonOrderId(),
            $input->getMarketplaceId(),
            uniqid()
        );
    }

    private function storeDocumentInS3(string $bucketName, string $objectKey, $inputStream): void
    {
        try {
            $s3Client = new S3Client([
                'region' => getenv('AWS_REGION'),
                'version' => 'latest'
            ]);

            $content = gzdecode($inputStream->getContents());
            $s3Client->putObject([
                'Bucket' => $bucketName,
                'Key' => $objectKey,
                'Body' => $content,
                'ContentType' => Constants::PDF_CONTENT_TYPE
            ]);
        } catch (S3Exception $e) {
            throw new \RuntimeException('Document storage failed: ' . $e->getMessage(), 0, $e);
        }
    }

    private function generatePresignedUrl(string $bucketName, string $objectKey, $logger): string
    {
        try {
            $s3Client = new S3Client([
                'region' => getenv('AWS_REGION'),
                'version' => 'latest'
            ]);

            $cmd = $s3Client->getCommand('GetObject', [
                'Bucket' => $bucketName,
                'Key' => $objectKey
            ]);

            $request = $s3Client->createPresignedRequest(
                $cmd,
                '+' . Constants::PRESIGNED_URL_EXPIRATION_MINUTES . ' minutes'
            );

            $url = (string)$request->getUri();
            $logger->info('Pre-signed URL successfully generated: ' . $url);

            return $url;
        } catch (\Exception $e) {
            throw new \RuntimeException('Failed to generate pre-signed URL', 0, $e);
        }
    }
}
