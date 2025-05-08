<?php

namespace Lambda;

use GuzzleHttp\Exception\RequestException;
use InvalidArgumentException;
use Lambda\Utils\ApiUtils;
use Lambda\Utils\Model\EasyShipOrderItem;
use Lambda\Utils\LambdaContext;
use Lambda\Utils\Model\EasyShipOrder;
use Lambda\Utils\Model\StateMachineInput;
use Lambda\Utils\StateMachineInputConverter;
use SpApi\Model\orders\v0\EasyShipShipmentStatus;
use SpApi\Model\orders\v0\GetOrderItemsResponse;

class RetrieveOrderHandler
{
    public function handleRequest(array $event, LambdaContext $context): StateMachineInput
    {
        $input = StateMachineInputConverter::convertFromArray($event);
        $logger = $context->getLogger();
        $logger->info('RetrieveOrder Lambda input: ' . json_encode($event, JSON_PRETTY_PRINT));


        try {
            // Validate input
            $this->validateRetrieveOrderInput($input);

            // Get Orders V0 API instance
            $ordersApi = ApiUtils::getOrdersApi($input);

            // API call to retrieve order
            $orderResponse = $ordersApi->getOrder($input->getAmazonOrderId());

            // API call to retrieve order items
            $orderItemsResponse = $ordersApi->getOrderItems($input->getAmazonOrderId(), null);

            // Validate EasyShip order
            if (
                $orderResponse->getPayload()->getEasyShipShipmentStatus() !== EasyShipShipmentStatus::PENDING_SCHEDULE
            ) {
                throw new \InvalidArgumentException(sprintf(
                    'Amazon Order Id: %s is not an EasyShip order',
                    $input->getAmazonOrderId()
                ));
            }

            // Process order items and set to EasyShipOrder
            $input->setEasyShipOrder(
                new EasyShipOrder($this->getOrderItemList($orderItemsResponse)));

            return $input;
        } catch (RequestException $e) {
            $logger->error('RequestException: ' . $e->getMessage());
            throw new \RuntimeException('Calling Orders API failed', 0, $e);
        } catch (\Exception $e) {
            $logger->error('Exception: ' . $e->getMessage());
            throw new \RuntimeException('An unexpected error occurred', 0, $e);
        }
    }

    /**
     * @throws \Exception
     */
    private function getOrderItemList(GetOrderItemsResponse $orderItemsResponse): array
    {
        $itemList = [];
        foreach ($orderItemsResponse->getPayload()->getOrderItems() as $orderItem) {
            $item = new EasyShipOrderItem(
                $orderItem->getOrderItemId(),
                $orderItem->getSellerSku(),
                $orderItem->getQuantityOrdered(),
            );
            // Add SerialNumbers if required
            if ($orderItem->getSerialNumbers() !== null && $orderItem->getSerialNumberRequired()) {
                $item->setOrderItemSerialNumbers($orderItem->getSerialNumbers());
            }
            $itemList[] = $item;
        }
        return $itemList;
    }

    /**
     * @throws \Exception
     */
    private function validateRetrieveOrderInput(StateMachineInput $input): void
    {
        if ($input->getApiCredentials() === null) {
            throw new InvalidArgumentException("API credentials cannot be null");
        }
        if (empty($input->getAmazonOrderId())) {
            throw new InvalidArgumentException("Amazon Order Id cannot be null or empty");
        }
        if (empty($input->getMarketplaceId())) {
            throw new InvalidArgumentException("Marketplace Id cannot be null or empty");
        }
    }
}
