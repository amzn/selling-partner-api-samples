<?php

namespace Src\easyship;

use SpApi\Api\easyship\v2022_03_23\EasyShipApi;
use SpApi\Model\easyship\v2022_03_23\Dimensions;
use SpApi\Model\easyship\v2022_03_23\ListHandoverSlotsRequest;
use SpApi\Model\easyship\v2022_03_23\UnitOfLength;
use SpApi\Model\easyship\v2022_03_23\UnitOfWeight;
use SpApi\Model\easyship\v2022_03_23\Weight;
use Src\util\Recipe;

/**
 * Code Recipe to get available handover time slots for EasyShip orders
 * Steps:
 * 1. Setup order and package details
 * 2. Initialize EasyShip API client
 * 3. Create request with package dimensions and weight
 * 4. Call listHandoverSlots API
 * 5. Display available time slots
 */
class GetHandoverSlotsRecipe extends Recipe
{
    private EasyShipApi $easyShipApi;
    private string $amazonOrderId;
    private string $marketplaceId;

    public function start(): void
    {
        $this->setupOrderDetails();
        $this->initializeEasyShipApi();
        $response = $this->listHandoverSlots();
        $this->displayTimeSlots($response);
        echo "✅ Successfully retrieved handover slots\n";
    }

    private function setupOrderDetails(): void
    {
        $this->amazonOrderId = "702-3035602-4225066";
        $this->marketplaceId = "A1AM78C64UM0Y8";
        echo "Order details configured: {$this->amazonOrderId}\n";
    }

    private function initializeEasyShipApi(): void
    {
        $this->easyShipApi = new EasyShipApi($this->config);
        echo "EasyShip API client initialized\n";
    }

    private function listHandoverSlots()
    {
        $request = new ListHandoverSlotsRequest();
        $request->setAmazonOrderId($this->amazonOrderId);
        $request->setMarketplaceId($this->marketplaceId);
        $request->setPackageDimensions($this->createPackageDimensions());
        $request->setPackageWeight($this->createPackageWeight());

        $response = $this->easyShipApi->listHandoverSlots($request);
        echo "Handover slots retrieved for order: {$this->amazonOrderId}\n";
        return $response;
    }

    private function createPackageDimensions(): Dimensions
    {
        // TODO: In production, retrieve actual dimensions from CalculateOrderDimensionsRecipe
        // These are sample values for demonstration purposes only
        $dimensions = new Dimensions();
        $dimensions->setLength(10.0);
        $dimensions->setWidth(8.0);
        $dimensions->setHeight(5.0);
        $dimensions->setUnit(UnitOfLength::CM);
        return $dimensions;
    }

    private function createPackageWeight(): Weight
    {
        // TODO: In production, retrieve actual dimensions from CalculateOrderDimensionsRecipe
        // These are sample values for demonstration purposes only
        $weight = new Weight();
        $weight->setValue(500.0);
        $weight->setUnit(UnitOfWeight::G);
        return $weight;
    }

    private function displayTimeSlots($response): void
    {
        $timeSlots = $response->getTimeSlots();
        if (!$timeSlots || empty($timeSlots)) {
            echo "No time slots available\n";
            return;
        }
        
        echo "Available time slots: " . count($timeSlots) . "\n";
        foreach ($timeSlots as $slot) {
            echo "  Slot ID: " . $slot->getSlotId() . "\n";
            echo "    Method: " . $slot->getHandoverMethod() . "\n";
        }
    }
}
