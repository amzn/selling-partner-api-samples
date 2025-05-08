<?php

namespace Lambda;

use GuzzleHttp\Exception\RequestException;
use Lambda\Utils\ApiUtils;
use Lambda\Utils\LambdaContext;
use Lambda\Utils\Model\StateMachineInput;
use Lambda\Utils\StateMachineInputConverter;
use SpApi\Model\easyship\v2022_03_23\CreateScheduledPackageRequest;
use SpApi\Model\easyship\v2022_03_23\Item;
use SpApi\Model\easyship\v2022_03_23\PackageDetails;
use SpApi\Model\easyship\v2022_03_23\TimeSlot;

class CreateScheduledPackageHandler
{
    /**
     * @throws \Exception
     */
    public function handleRequest(array $event, LambdaContext $context): StateMachineInput
    {
        $input = StateMachineInputConverter::convertFromArray($event);
        $logger = $context->getLogger();
        $logger->info('CreateScheduledPackage Lambda input: ' . json_encode($event, JSON_PRETTY_PRINT));
        $logger->info('CreateScheduledPackage Lambda MappedInput: ' . json_encode($input));

        try {
            $items = [];
            foreach ($input->getEasyShipOrder()->getOrderItems() as $orderItem) {
                $logger->info('EasyShipOrderItem: ' . json_encode($orderItem));
                $item = new Item();
                $item->setOrderItemId($orderItem->getOrderItemId());
                // Set the SerialNumber if it exists, as some region requires this value
                if (!empty($orderItem->getOrderItemSerialNumbers())) {
                    $item->setOrderItemSerialNumbers($orderItem->getOrderItemSerialNumbers());
                }
                $items[] = $item;
            }

            // Prepare the CreateScheduledPackageRequest payload
            $requestPayload = (new CreateScheduledPackageRequest())
                ->setAmazonOrderId($input->getAmazonOrderId())
                ->setMarketplaceId($input->getMarketplaceId())
                ->setPackageDetails(
                    (new PackageDetails())
                        ->setPackageTimeSlot($input->getTimeSlots()[0])
                        ->setPackageItems($items)
                );
            $logger->info('EasyShip API - CreateScheduledPackage request: ' . json_encode($requestPayload));

            // Create an API instance
            $easyShipApi = ApiUtils::getEasyShipApi($input);
            // Call the EasyShip API
            $response = $easyShipApi->createScheduledPackage($requestPayload);

            $logger->info('EasyShip API - CreateScheduledPackage response: ' . json_encode($response));

            // Store ScheduledPackageId to validate scheduled correctly using this information on the next step
            $input->setScheduledPackageId($response->getScheduledPackageId());

            return $input;
        } catch (RequestException $e) {
            $logger->error('RequestException: ' . $e->getMessage());
            throw new \Exception('Calling EasyShip API failed', 0, $e);
        } catch (\Exception $e) {
            $logger->error('Exception: ' . $e->getMessage());
            throw $e;
        }
    }
}
