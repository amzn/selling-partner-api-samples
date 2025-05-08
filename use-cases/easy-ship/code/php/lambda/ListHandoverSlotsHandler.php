<?php

namespace Lambda;

use GuzzleHttp\Exception\RequestException;
use Lambda\Utils\ApiUtils;
use Lambda\utils\LambdaContext;
use Lambda\Utils\Model\StateMachineInput;
use Lambda\Utils\StateMachineInputConverter;
use SpApi\Model\easyship\v2022_03_23\ListHandoverSlotsRequest;

class ListHandoverSlotsHandler
{
    public function handleRequest(array $event, LambdaContext $context): StateMachineInput
    {
        $input = StateMachineInputConverter::convertFromArray($event);
        $logger = $context->getLogger();
        $logger->info('ListHandoverSlots Lambda input: ' . json_encode($event, JSON_PRETTY_PRINT));

        try {
            // Prepare the request payload
            $request = (new ListHandoverSlotsRequest())
                ->setAmazonOrderId($input->getAmazonOrderId())
                ->setMarketplaceId($input->getMarketplaceId())
                ->setPackageDimensions($input->getEasyShipOrder()->getPackageDimensions())
                ->setPackageWeight($input->getEasyShipOrder()->getPackageWeight());

            $logger->info('EasyShip API - listHandoverSlots request: ' . json_encode($request));

            // Initialize the EasyShip API client
            $easyShipApi = ApiUtils::getEasyShipApi($input);

            // Call the API to list handover slots
            $response = $easyShipApi->listHandoverSlots($request);

            $logger->info('EasyShip API - listHandoverSlots response: ' . json_encode($response));

            // Set time slots in the input for further processing
            $input->setTimeSlots($response->getTimeSlots());

            return $input;
        } catch (RequestException $e) {
            $logger->error('RequestException: ' . $e->getMessage());
            throw new \RuntimeException('Message body could not be mapped to EasyShipOrder', 0, $e);
        } catch (\Exception $e) {
            $logger->error('Exception: ' . $e->getMessage());
            throw new \RuntimeException('Calling EasyShip API failed', 0, $e);
        }
    }
}
