<?php

namespace Src\easyship;

use SpApi\Api\listings\items\v2021_08_01\ListingsApi;
use SpApi\Api\orders\v0\OrdersV0Api;
use Src\util\Recipe;

class CalculateOrderDimensionsRecipe extends Recipe
{
    private OrdersV0Api $ordersApi;
    private ListingsApi $listingsApi;
    private string $amazonOrderId;
    private string $marketplaceId;
    private string $sellerId;

    public function start(): void
    {
        $this->setupOrderDetails();
        $this->initializeApis();
        $orderItemsResponse = $this->getOrderItems();
        $sku = $this->extractSku($orderItemsResponse);
        $listingItem = $this->getListingItem($sku);
        $this->calculateDimensions($listingItem, $orderItemsResponse);
        echo "✅ Successfully calculated order dimensions\n";
    }

    private function setupOrderDetails(): void
    {
        $this->amazonOrderId = "702-3035602-4225066";
        $this->marketplaceId = "A1AM78C64UM0Y8";
        $this->sellerId = "A2ZPJ4TLUOSWY8";
        echo "Order details configured: {$this->amazonOrderId}\n";
    }

    private function initializeApis(): void
    {
        $this->ordersApi = new OrdersV0Api($this->config);
        $this->listingsApi = new ListingsApi($this->config);
        echo "APIs initialized\n";
    }

    private function getOrderItems()
    {
        $response = $this->ordersApi->getOrderItems($this->amazonOrderId);
        $itemCount = count($response->getPayload()->getOrderItems());
        echo "Order items retrieved: {$itemCount} items\n";
        return $response;
    }

    private function extractSku($response): string
    {
        $sku = $response->getPayload()->getOrderItems()[0]->getSellerSku();
        echo "Extracted SKU: {$sku}\n";
        return $sku;
    }

    private function getListingItem(string $sku)
    {
        $response = $this->listingsApi->getListingsItem(
            $this->sellerId,
            $sku,
            [$this->marketplaceId],
            null,
            ['attributes', 'fulfillmentAvailability']
        );
        echo "Listing item retrieved for SKU: {$sku}\n";
        return $response;
    }

    private function calculateDimensions($listingItem, $orderItemsResponse): void
    {
        $attributes = $listingItem->getAttributes();
        if (!$attributes) {
            echo "No attributes found\n";
            return;
        }
        $quantity = $orderItemsResponse->getPayload()->getOrderItems()[0]->getQuantityOrdered();
        $dimensions = $this->extractPackageDimensions($attributes);
        $weight = $this->extractPackageWeight($attributes);
        $totalWeight = $weight * $quantity;

        echo "Package Dimensions:\n";
        echo "  Length: {$dimensions['length']} cm\n";
        echo "  Width: {$dimensions['width']} cm\n";
        echo "  Height: {$dimensions['height']} cm\n";
        echo "  Weight per unit: {$weight} g\n";
        echo "  Total weight (quantity {$quantity}): {$totalWeight} g\n";
    }

    private function extractPackageDimensions(array $attributes): array
    {
        $packageDimensions = $attributes['item_package_dimensions'] ?? null;
        if ($packageDimensions && !empty($packageDimensions)) {
            $dims = (array)$packageDimensions[0];
            return [
                'length' => $this->extractValue((array)($dims['length'] ?? [])),
                'width' => $this->extractValue((array)($dims['width'] ?? [])),
                'height' => $this->extractValue((array)($dims['height'] ?? []))
            ];
        }
        return ['length' => 0, 'width' => 0, 'height' => 0];
    }

    private function extractPackageWeight(array $attributes): float
    {
        $packageWeight = $attributes['item_package_weight'] ?? null;
        if ($packageWeight && !empty($packageWeight)) {
            return $this->extractValue((array)$packageWeight[0]);
        }
        return 0.0;
    }

    private function extractValue(array $data): float
    {
        return isset($data['value']) ? (float)$data['value'] : 0.0;
    }
}
