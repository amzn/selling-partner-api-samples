<?php

namespace Lambda;

use Aws\Exception\AwsException;
use Aws\Sfn\SfnClient;
use Lambda\Utils\Constants;
use Lambda\Utils\LambdaContext;
use Lambda\Utils\Model\ApiCredentials;
use Lambda\Utils\Model\NotificationPayload;
use Lambda\Utils\Model\OrderChangeNotification;
use Lambda\Utils\Model\OrderChangeSummary;
use Lambda\Utils\Model\SPAPINotification;
use Lambda\Utils\Model\StateMachineInput;

class ProcessNotificationHandler
{
    public function handleRequest(array $event, LambdaContext $context): string
    {
        $logger = $context->getLogger();
        $logger->info('ProcessNotification Lambda input: ' . json_encode($event));

        // Iterate over SQS messages
        foreach ($event['Records'] as $message) {
            $logger->info(sprintf('Notification body: %s', $message['body']));

            try {
                // Map the notification
                $notification = $this->mapNotification($message['body']);

                // Only process notifications of type 'ORDER_CHANGE'
                if ($notification->getNotificationType() !== Constants::NOTIFICATION_TYPE_ORDER_CHANGE) {
                    $logger->info(sprintf('Notification type %s skipped', $notification->getNotificationType()));
                    continue;
                }

                // Skip if order status is 'Pending'
                if ($notification->getPayload()->getOrderChangeNotification()->getSummary()->getOrderStatus()
                    == Constants::NOTIFICATION_IGNORE_ORDER_STATUS) {
                    $logger->info('This event is skipped due to Pending order status');
                    continue;
                }

                $orderChangeNotification = $notification->getPayload()->getOrderChangeNotification();

                // Only process notifications with level 'ORDER_LEVEL'
                if ($orderChangeNotification->getNotificationLevel() !== Constants::NOTIFICATION_LEVEL_ORDER_LEVEL) {
                    $logger->info(sprintf(
                        'Notification level %s skipped',
                        $orderChangeNotification->getNotificationLevel()
                    ));
                    continue;
                }

                // Start Step Functions Execution
                $executionArn = $this->startStepFunctionsExecution($orderChangeNotification);
                $logger->info(sprintf('State machine successfully started. Execution ARN: %s', $executionArn));
            } catch (\Exception $e) {
                $logger->error('Error processing notification: ' . $e->getMessage());
                throw new \RuntimeException('ProcessNotification Lambda failed', 0, $e);
            }
        }

        return 'Finished processing incoming notifications';
    }

    /**
     * Maps the JSON notification body to an SPAPINotification object.
     *
     * @param string $notificationBody The JSON string representing the notification.
     *
     * @return SPAPINotification The mapped notification object.
     *
     * @throws \JsonException If JSON decoding fails.
     * @throws \Exception
     */
    private function mapNotification(string $notificationBody): SPAPINotification
    {
        $data = json_decode($notificationBody, true, 512, JSON_THROW_ON_ERROR);

        $orderChangeNotification = null;
        if (isset($data['Payload']['OrderChangeNotification'])) {
            $notificationData = $data['Payload']['OrderChangeNotification'];
            $summary = $notificationData['Summary'];
            $orderChangeSummary = isset($summary) ? new OrderChangeSummary (
                $summary['MarketplaceId'],
                $summary['OrderStatus'],
                $summary['FulfillmentType']): null;
            $orderChangeNotification = new OrderChangeNotification(
                $notificationData['NotificationLevel'] ?? '',
                '',
                $notificationData['AmazonOrderId'] ?? '',
                null,
                $orderChangeSummary
            );
        }

        return new SPAPINotification(
            $data['NotificationType'] ?? '',
            new \DateTime($data['EventTime'] ?? 'now'),
            new NotificationPayload($orderChangeNotification)
        );
    }


    /**
     * Starts an AWS Step Functions execution with the given OrderChangeNotification.
     *
     * @param OrderChangeNotification $orderChangeNotification The order change notification data.
     *
     * @return string The execution ARN of the started Step Functions execution.
     *
     * @throws \JsonException If JSON encoding fails.
     * @throws \RuntimeException If the execution fails to start.
     * @throws \Exception If an unexpected error occurs.
     */
    private function startStepFunctionsExecution(OrderChangeNotification $orderChangeNotification): string
    {
        $input = $this->getStateMachineInput($orderChangeNotification);
        $inputStr = json_encode($input, JSON_THROW_ON_ERROR);

        $sfnClient = new SfnClient([
            'region' => getenv('AWS_REGION'),
            'version' => 'latest',
        ]);

        try {
            $result = $sfnClient->startExecution([
                'stateMachineArn' => getenv(Constants::STATE_MACHINE_ARN_ENV_VARIABLE),
                'name' => sprintf('%s-%s', $orderChangeNotification->getAmazonOrderId(), uniqid()),
                'input' => $inputStr,
            ]);
            return $result['executionArn'];
        } catch (AwsException $e) {
            throw new \RuntimeException('Failed to start Step Functions execution: ' . $e->getAwsErrorMessage(), 0, $e);
        } catch (\Exception $e) {
            throw new \RuntimeException('An unexpected error occurred while starting Step Functions execution.', 0, $e);
        }
    }


    /**
     * @throws \Exception
     */
    private function getStateMachineInput(OrderChangeNotification $orderChangeNotification): StateMachineInput
    {
        $regionCode = getenv(Constants::REGION_CODE_KEY_NAME);
        $refreshToken = getenv(Constants::REFRESH_TOKEN_KEY_NAME);

        return new StateMachineInput(
            new ApiCredentials($refreshToken, $regionCode),
            $orderChangeNotification->getAmazonOrderId(),
            $orderChangeNotification->getSummary()->getMarketplaceId()
        );
    }
}
