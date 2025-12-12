<?php

namespace Src\easyship;

use SpApi\Api\orders\v0\OrdersV0Api;
use SpApi\Model\orders\v0\EasyShipShipmentStatus;
use Src\util\Recipe;

/**
 * Code Recipe to retrieve an EasyShip order using the Orders API
 * Steps:
 * 1. Setup order details
 * 2. Initialize Orders API client
 * 3. Get order details
 * 4. Get order items
 * 5. Validate EasyShip order status
 */
class RetrieveOrderRecipe extends Recipe
{
    private OrdersV0Api $ordersApi;
    private string $amazonOrderId;

    public function start(): void
    {
        $this->setupOrderDetails();
        $this->initializeOrdersApi();
        $orderResponse = $this->getOrder();
        $orderItemsResponse = $this->getOrderItems();
        $this->validateEasyShipOrder($orderResponse);
        echo "✅ Successfully retrieved EasyShip order\n";
    }

    private function setupOrderDetails(): void
    {
        $this->amazonOrderId = "702-3035602-4225066";
        echo "Order details configured: {$this->amazonOrderId}\n";
    }

    private function initializeOrdersApi(): void
    {
        $this->ordersApi = new OrdersV0Api($this->config);
        echo "Orders API client initialized\n";
    }

    private function getOrder()
    {
        $response = $this->ordersApi->getOrder($this->amazonOrderId);
        echo "Order retrieved: {$this->amazonOrderId}\n";
        return $response;
    }

    private function getOrderItems()
    {
        $response = $this->ordersApi->getOrderItems($this->amazonOrderId);
        $itemCount = count($response->getPayload()->getOrderItems());
        echo "Order items retrieved: {$itemCount} items\n";
        return $response;
    }

    private function validateEasyShipOrder($orderResponse): void
    {
        /** EasyShipShipmentStatus 
         *      The status of the Amazon Easy Ship order. 
         *      This property is only included for Amazon Easy Ship orders.
        **/
        if ($orderResponse->getPayload()->getEasyShipShipmentStatus() !== EasyShipShipmentStatus::PENDING_SCHEDULE) {
            throw new \InvalidArgumentException("Order is not an EasyShip order with PENDING_SCHEDULE status");
        }
        echo "✅ Order validated as EasyShip order\n";
    }
}
