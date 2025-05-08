<?php

namespace Lambda;

use Lambda\Utils\ApiUtils;
use Lambda\Utils\Constants;
use Lambda\Utils\LambdaContext;
use Lambda\Utils\Model\ApiCredentials;
use Lambda\Utils\Model\LambdaInput;
use SpApi\ApiException;
use SpApi\Model\notifications\v1\CreateDestinationRequest;
use SpApi\Model\notifications\v1\CreateSubscriptionRequest;
use SpApi\Model\notifications\v1\DestinationResourceSpecification;
use SpApi\Model\notifications\v1\EventFilter;
use SpApi\Model\notifications\v1\ProcessingDirective;
use SpApi\Model\notifications\v1\SqsResource;

class SubscribeNotificationsHandler
{
    public function handleRequest(array $event, LambdaContext $context): string
    {
        $logger = $context->getLogger();
        $logger->info('SubscribeNotifications Lambda started', [
            'timestamp' => date('Y-m-d H:i:s'),
            'functionName' => getenv('AWS_LAMBDA_FUNCTION_NAME')
        ]);
        $regionCode = getenv(Constants::REGION_CODE_KEY_NAME);
        $refreshToken = getenv(Constants::REFRESH_TOKEN_KEY_NAME);
        $notificationType = $event[Constants::NOTIFICATION_TYPE_KEY_NAME] ?? '';

        try {
            $destinationId = $this->createDestination($regionCode);
            $logger->info("Destination created - Destination Id: {$destinationId}");
        } catch (\Exception $e) {
            throw new \RuntimeException('Create destination failed', 0, $e);
        }

        try {
            $subscriptionId = $this->createSubscription($regionCode, $refreshToken, $notificationType, $destinationId);
            $logger->info("Subscription created - Subscription Id: {$subscriptionId}");

            return "Destination Id: {$destinationId} - Subscription Id: {$subscriptionId}";
        } catch (\Exception $e) {
            throw new \RuntimeException('Create subscription failed', 0, $e);
        }
    }

    /**
     * Creates a destination in the specified region using an SQS Queue ARN.
     *
     * This method builds a `CreateDestinationRequest` using the SQS Queue ARN retrieved
     * from environment variables. It interacts with the Notifications API to create
     * or retrieve an existing destination.
     *
     * @param string $regionCode The region code for the API (e.g., "us-east-1").
     *
     * @return string The destination ID created or retrieved from the API.
     *
     * @throws ApiException If an error occurs during the API call and it's not a conflict (409).
     * @throws \Exception
     */
    private function createDestination(string $regionCode): string
    {
        // Retrieve SQS Queue Amazon Resource Name from environmental valuables
        $sqsQueueArn = getenv(Constants::SQS_QUEUE_ARN_ENV_VARIABLE);

        // Build CreateDestinationRequest with SQS Queue Amazon Resource Name
        $request = (new CreateDestinationRequest())
            ->setName(uniqid())
            ->setResourceSpecification(
                (new DestinationResourceSpecification())->setSqs(
                    (new SqsResource())->setArn($sqsQueueArn)
                )
            );

        // Build ApiCredentialProvider
        $input = new LambdaInput(new ApiCredentials(null, $regionCode));
        // Create Api instance with grantless mode
        $notificationsApi = ApiUtils::getNotificationsApi($input, true);

        $destinationId = '';
        try {
            // Call API
            $response = $notificationsApi->createDestination($request);
            $destinationId = $response->getPayload()->getDestinationId();
        } catch (ApiException $e) {
            if ($e->getCode() === 409) {
                $response = $notificationsApi->getDestinations();
                foreach ($response->getPayload() as $destination) {
                    if ($destination->getResource()->getSqs()->getArn() === $sqsQueueArn) {
                        $destinationId = $destination->getDestinationId();
                        break;
                    }
                }
            } else {
                throw $e;
            }
        }

        return $destinationId;
    }

    /**
     * Creates a subscription for the specified notification type and destination.
     *
     * This method builds a subscription request for the `ORDER_CHANGE` event filter,
     * uses the provided API credentials and destination ID, and interacts with the
     * Notifications API to create or retrieve an existing subscription.
     *
     * @param string $regionCode The region code for the API (e.g., "us-east-1").
     * @param string $refreshToken The refresh token used for API authentication.
     * @param string $notificationType The type of notification (e.g., "ORDER_CHANGE").
     * @param string $destinationId The destination ID for the subscription.
     *
     * @return string The subscription ID created or retrieved from the API.
     *
     * @throws ApiException If an error occurs during the API call and it's not a conflict (409).
     * @throws \Exception
     */
    private function createSubscription(
        string $regionCode,
        string $refreshToken,
        string $notificationType,
        string $destinationId
    ): string {
        // Build ORDER_CHANGE CreateSubscriptionRequest
        $request = (new CreateSubscriptionRequest())
            ->setDestinationId($destinationId)
            ->setPayloadVersion('1.0')
            ->setProcessingDirective(
                (new ProcessingDirective())->setEventFilter(
                    (new EventFilter())->setEventFilterType(Constants::NOTIFICATION_TYPE_ORDER_CHANGE)
                )
            );
        error_log("request: " . json_encode($request, JSON_PRETTY_PRINT));
        // Build ApiCredentialProvider
        $input = new LambdaInput(new ApiCredentials($refreshToken, $regionCode));
        // Create Api instance
        $notificationsApi = ApiUtils::getNotificationsApi($input, false);

        try {
            // Call API
            $response = $notificationsApi->createSubscription($notificationType, $request);
            $subscriptionId = $response->getPayload()->getSubscriptionId();
        } catch (ApiException $e) {
            if ($e->getCode() === 409) {
                $response = $notificationsApi->getSubscription($notificationType, null);
                $subscriptionId = $response->getPayload()->getSubscriptionId();
            } else {
                throw $e;
            }
        }

        return $subscriptionId;
    }
}
