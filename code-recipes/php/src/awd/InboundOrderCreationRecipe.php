<?php

namespace Src\awd;

use Exception;
use SpApi\Api\awd\v2024_05_09\AwdApi;
use SpApi\Model\awd\v2024_05_09\Address;
use SpApi\Model\awd\v2024_05_09\DistributionPackage;
use SpApi\Model\awd\v2024_05_09\DistributionPackageContents;
use SpApi\Model\awd\v2024_05_09\DistributionPackageQuantity;
use SpApi\Model\awd\v2024_05_09\DistributionPackageType;
use SpApi\Model\awd\v2024_05_09\InboundEligibilityStatus;
use SpApi\Model\awd\v2024_05_09\InboundOrderCreationData;
use SpApi\Model\awd\v2024_05_09\InboundPackages;
use SpApi\Model\awd\v2024_05_09\MeasurementData;
use SpApi\Model\awd\v2024_05_09\PackageWeight;
use SpApi\Model\awd\v2024_05_09\ProductQuantity;
use SpApi\Model\awd\v2024_05_09\WeightUnitOfMeasurement;
use Src\util\Recipe;

/**
 * AWD Inbound order creation is a simple four-step process:
 * - Check inbound eligibility (optional) - Make sure that your inventory is accepted by AWD.
 * - Create inbound order - Submit all necessary information to create a new inbound order.
 * - Get inbound order - Before confirmation, verify that all information is correct.
 * - Confirm inbound order - Confirm inbound order to let AWD know that your order is ready to ship.
 */
class InboundOrderCreationRecipe extends Recipe
{

    private AwdApi $awdApi;
    private DistributionPackageQuantity $packageQuantity;

    public function __construct()
    {
        parent::__construct();
        $this->awdApi = new AwdApi($this->config);
    }

    public function start(): void
    {
        $status = $this->checkInboundEligibility();

        if ($status == InboundEligibilityStatus::ELIGIBLE) {
            $orderId = $this->createInbound();
            $this->getInbound($orderId);
            $this->confirmInbound($orderId);
        }
    }

    private function checkInboundEligibility(): string
    {
        $productQuantity = new ProductQuantity(['sku' => 'test-socks', 'quantity' => 100]);
        $contents = new DistributionPackageContents(['products' => [$productQuantity]]);

        $packageWeight = new PackageWeight(['unit_of_measurement' => WeightUnitOfMeasurement::KILOGRAMS, 'weight' => 6.0]);
        $measurementData = new MeasurementData(['weight' => $packageWeight]);

        $distributionPackage = new DistributionPackage([
            'contents' => $contents,
            'measurements' => $measurementData,
            'type' => DistributionPackageType::_CASE
        ]);

        $this->packageQuantity = new DistributionPackageQuantity([
            'count' => 1,
            'distribution_package' => $distributionPackage
        ]);

        $inboundPackages = new InboundPackages(['packages_to_inbound' => [$this->packageQuantity]]);

        try {
            $response = $this->awdApi->checkInboundEligibility($inboundPackages);
            return $response->getStatus();
        } catch (Exception $e) {
            echo 'An exception occurred when checking inbound eligibility: ' . $e->getMessage();
            throw $e;
        }
    }

    private function createInbound(): string
    {
        $address = new Address([
            'address_line1' => '2031 7th Ave',
            'postal_code' => '98121',
            'country_code' => 'US',
            'name' => 'John Doe',
            'state_or_region' => 'WA'
        ]);

        $inboundOrderCreationData = new InboundOrderCreationData([
            'packages_to_inbound' => [$this->packageQuantity],
            'origin_address' => $address
        ]);

        try {
            $response = $this->awdApi->createInbound($inboundOrderCreationData);
            return $response->getOrderId();
        } catch (Exception $e) {
            echo 'An exception occurred when creating inbound order: ' . $e->getMessage();
            throw $e;
        }
    }

    private function getInbound(string $orderId): void
    {
        try {
            $this->awdApi->getInbound($orderId);
        } catch (Exception $e) {
            echo 'An exception occurred when getting inbound order: ' . $e->getMessage();
            throw $e;
        }
    }

    private function confirmInbound(string $orderId): void
    {
        try {
            $this->awdApi->confirmInbound($orderId);
        } catch (Exception $e) {
            echo 'An exception occurred when confirming inbound order: ' . $e->getMessage();
            throw $e;
        }
    }
}
