<?php

namespace Src\easyship;

use SpApi\Api\catalogItems\v2022_04_01\CatalogApi;
use SpApi\Api\listings\items\v2021_08_01\ListingsApi;
use SpApi\Api\orders\v0\OrdersV0Api;
use Src\util\Recipe;

/**
 * Code Recipe to calculate order weight and dimensions for EasyShip
 * Steps:
 * 1. Get order items to retrieve all SKUs
 * 2. For each SKU, search Catalog Items API for ASIN dimensions
 * 3. Fallback to Listings Items API if dimensions not available
 * 4. Sum all weights and dimensions
 * 
 * IMPORTANT: Neither APIs guarantees 100% of data availability.
 */
class CalculateOrderDimensionsRecipe extends Recipe
{
    private OrdersV0Api $ordersApi;
    private CatalogApi $catalogApi;
    private ListingsApi $listingsApi;
    private string $amazonOrderId;
    private string $marketplaceId;
    private string $sellerId;

    public function start(): void
    {
        $this->setupOrderDetails();
        $this->initializeApis();
        $orderItemsResponse = $this->getOrderItems();
        $this->calculateTotalDimensions($orderItemsResponse);
        echo "✅ Successfully calculated order dimensions\n";
    }

    private function setupOrderDetails(): void
    {
        // IMPORTANT: Replace these sample values with actual values from your environment
        // These IDs are for demonstration purposes only
        $this->amazonOrderId = "702-3035602-4225066";
        $this->marketplaceId = "A1AM78C64UM0Y8";
        $this->sellerId = "A2ZPJ4TLUOSWY8";
        echo "Order details configured: {$this->amazonOrderId}\n";
    }

    private function initializeApis(): void
    {
        $this->ordersApi = new OrdersV0Api($this->config);
        $this->catalogApi = new CatalogApi($this->config);
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

    private function calculateTotalDimensions($orderItemsResponse): void
    {
        $totalWeight = 0.0;
        $totalLength = 0.0;
        $totalWidth = 0.0;
        $totalHeight = 0.0;
        
        foreach ($orderItemsResponse->getPayload()->getOrderItems() as $orderItem) {
            $sku = $orderItem->getSellerSku();
            $asin = $orderItem->getAsin();
            $quantity = $orderItem->getQuantityOrdered();
            
            echo "Processing SKU: {$sku}, ASIN: {$asin}, Quantity: {$quantity}\n";
            
            $attributes = $this->getDimensionsFromCatalog($asin);
            if ($attributes === null) {
                $attributes = $this->getDimensionsFromListings($sku);
            }
            
            if ($attributes !== null) {
                $dimensions = $this->extractPackageDimensions($attributes);
                $weight = $this->extractPackageWeight($attributes);
                
                $totalWeight += $weight * $quantity;
                $totalLength += $dimensions['length'] * $quantity;
                $totalWidth += $dimensions['width'] * $quantity;
                $totalHeight += $dimensions['height'] * $quantity;
            }
        }
        
        echo "\nTotal Order Dimensions:\n";
        echo "  Total Length: {$totalLength} cm\n";
        echo "  Total Width: {$totalWidth} cm\n";
        echo "  Total Height: {$totalHeight} cm\n";
        echo "  Total Weight: {$totalWeight} g\n";
    }
    
    private function getDimensionsFromCatalog(string $asin): ?array
    {
        try {
            $catalogItem = $this->catalogApi->getCatalogItem(
                $asin,
                [$this->marketplaceId],
                ['attributes']
            );
            echo "  Retrieved dimensions from Catalog API\n";
            return $catalogItem->getAttributes() ? (array)$catalogItem->getAttributes() : null;
        } catch (\Exception $e) {
            echo "  Catalog API failed, will try Listings API\n";
            return null;
        }
    }
    
    private function getDimensionsFromListings(string $sku): ?array
    {
        try {
            $listingItem = $this->listingsApi->getListingsItem(
                $this->sellerId,
                $sku,
                [$this->marketplaceId],
                null,
                ['attributes']
            );
            echo "  Retrieved dimensions from Listings API\n";
            return $listingItem->getAttributes();
        } catch (\Exception $e) {
            echo "  Failed to retrieve dimensions from Listings API\n";
            return null;
        }
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
