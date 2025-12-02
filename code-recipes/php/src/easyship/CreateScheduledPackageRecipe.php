<?php

namespace Src\easyship;

use SpApi\Api\easyship\v2022_03_23\EasyShipApi;
use SpApi\Model\easyship\v2022_03_23\CreateScheduledPackageRequest;
use SpApi\Model\easyship\v2022_03_23\HandoverMethod;
use SpApi\Model\easyship\v2022_03_23\PackageDetails;
use SpApi\Model\easyship\v2022_03_23\TimeSlot;
use Src\util\Recipe;

/**
 * Code Recipe to create a scheduled EasyShip package
 * Steps:
 * 1. Prepare CreateScheduledPackageRequest with preferred shipment handover slots
 * 2. Initialize EasyShip API client
 * 3. Return Scheduled Package Id for confirmation
 */
class CreateScheduledPackageRecipe extends Recipe
{
    private EasyShipApi $easyShipApi;
    private string $amazonOrderId;
    private string $marketplaceId;

    public function start(): void
    {
        $request = $this->prepareRequest();
        $this->initializeEasyShipApi();
        $packageResponse = $this->createScheduledPackage($request);
        $scheduledPackageId = $packageResponse->getScheduledPackageId()->getAmazonOrderId();
        echo "✅ Scheduled Package Id: {$scheduledPackageId}\n";
    }

    private function prepareRequest(): CreateScheduledPackageRequest
    {
        $this->amazonOrderId = "702-3035602-4225066";
        $this->marketplaceId = "A1AM78C64UM0Y8";

        $timeSlot = new TimeSlot();
        // TODO: In production, retrieve actual slot ID from GetHandoverSlotsRecipe
        // This is a sample value for demonstration purposes only
        $timeSlot->setSlotId('AQc1HTgeAAAAAJhLqlEAAAAAyE8AAAAAAAA=');
        $timeSlot->setHandoverMethod(HandoverMethod::PICKUP);

        $packageDetails = new PackageDetails();
        $packageDetails->setPackageTimeSlot($timeSlot);

        $request = new CreateScheduledPackageRequest();
        $request->setAmazonOrderId($this->amazonOrderId);
        $request->setMarketplaceId($this->marketplaceId);
        $request->setPackageDetails($packageDetails);

        echo "Request prepared with time slot: AQc1HTgeAAAAAJhLqlEAAAAAyE8AAAAAAAA=\n";
        return $request;
    }

    private function initializeEasyShipApi(): void
    {
        $this->easyShipApi = new EasyShipApi($this->config);
        echo "EasyShip API client initialized\n";
    }

    private function createScheduledPackage(CreateScheduledPackageRequest $request)
    {
        $response = $this->easyShipApi->createScheduledPackage($request);
        echo "Scheduled package created for order: {$this->amazonOrderId}\n";
        return $response;
    }
}
