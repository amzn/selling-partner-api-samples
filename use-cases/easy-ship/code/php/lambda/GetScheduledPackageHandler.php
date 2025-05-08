<?php

namespace Lambda;

use GuzzleHttp\Exception\RequestException;
use Lambda\Utils\ApiUtils;
use Lambda\utils\LambdaContext;
use Lambda\Utils\Model\StateMachineInput;
use Lambda\Utils\StateMachineInputConverter;

class GetScheduledPackageHandler
{
    public function handleRequest(array $event, LambdaContext $context): StateMachineInput
    {
        $input = StateMachineInputConverter::convertFromArray($event);
        $logger = $context->getLogger();
        $logger->info('getScheduledPackage Lambda input: ' . json_encode($event, JSON_PRETTY_PRINT));

        try {
            // Initialize EasyShip API client
            $easyShipApi = ApiUtils::getEasyShipApi($input);

            // Call the EasyShip API to get the scheduled package
            $response = $easyShipApi->getScheduledPackage(
                $input->getAmazonOrderId(),
                $input->getMarketplaceId()
            );
            $logger->info('EasyShip API - GetScheduledPackage response: ' . json_encode($response));
            // Validate if the scheduled package ID matches the expected ID
            if (trim($response->getScheduledPackageId()->getPackageId())
                !== trim($input->getScheduledPackageId()->getPackageId())) {
                throw new \InvalidArgumentException(sprintf(
                    'Amazon Order Id: %s was not scheduled correctly',
                    $input->getAmazonOrderId()
                ));
            }

            return $input;
        } catch (RequestException $e) {
            $logger->error('RequestException: ' . $e->getMessage());
            throw new \RuntimeException('Calling EasyShip API failed', 0, $e);
        } catch (\Exception $e) {
            $logger->error('Exception: ' . $e->getMessage());
            throw new \RuntimeException('An unexpected error occurred', 0, $e);
        }
    }
}
