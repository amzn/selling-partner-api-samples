<?php

namespace Src\easyship;

use SpApi\Api\easyship\v2022_03_23\EasyShipApi;
use Src\util\Recipe;

/**
 * Code Recipe to retrieve a scheduled EasyShip package
 * Steps:
 * 1. Initialize EasyShip API client
 * 2. Call getScheduledPackage operation
 * 3. Validate Scheduled Package Id
 */
class GetScheduledPackageRecipe extends Recipe
{
    private EasyShipApi $easyShipApi;
    private string $amazonOrderId;
    private string $marketplaceId;

    public function start(): void
    {
        $this->initializeEasyShipApi();
        $packageResponse = $this->getScheduledPackage();
        $this->validateScheduledPackageId($packageResponse);
        echo "✅ Successfully retrieved and validated scheduled package\n";
    }

    private function initializeEasyShipApi(): void
    {
        $this->easyShipApi = new EasyShipApi($this->config);
        $this->amazonOrderId = "902-3159121-1390916";
        $this->marketplaceId = "A1AM78C64UM0Y8";
        echo "EasyShip API client initialized\n";
    }

    private function getScheduledPackage()
    {
        $response = $this->easyShipApi->getScheduledPackage($this->amazonOrderId, $this->marketplaceId);
        echo "Scheduled package retrieved for order: {$this->amazonOrderId}\n";
        return $response;
    }

    private function validateScheduledPackageId($packageResponse): void
    {
        $responseOrderId = $packageResponse->getScheduledPackageId()->getAmazonOrderId();
        if ($this->amazonOrderId !== $responseOrderId) {
            throw new \Exception("Scheduled Package Id mismatch. Expected: {$this->amazonOrderId}, Got: {$responseOrderId}");
        }
        echo "✅ Scheduled Package Id validated: {$responseOrderId}\n";
    }
}
