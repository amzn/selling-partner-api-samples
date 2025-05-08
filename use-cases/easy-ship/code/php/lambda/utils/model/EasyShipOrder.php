<?php

namespace Lambda\Utils\Model;

use JsonSerializable;
use Lambda\attributes\Property;
use SpApi\Model\easyship\v2022_03_23\Dimensions;
use SpApi\Model\easyship\v2022_03_23\Weight;

class EasyShipOrder implements JsonSerializable
{
    #[Property("Order Items Information")]
    private array $orderItems; // List of EasyShipOrderItem objects

    #[Property("Package Dimensions")]
    private ?Dimensions $packageDimensions;

    #[Property("Package Weight")]
    private ?Weight $packageWeight;

    /**
     * EasyShipOrder constructor.
     *
     * @param array $orderItems
     * @param Dimensions|null $packageDimensions
     * @param Weight|null $packageWeight
     */
    public function __construct(array $orderItems = [], ?Dimensions $packageDimensions = null, ?Weight $packageWeight = null)
    {
        foreach ($orderItems as $item) {
            if (!$item instanceof EasyShipOrderItem) {
                throw new \InvalidArgumentException("Each order item must be an instance of EasyShipOrderItem.");
            }
        }
        $this->orderItems = $orderItems;
        $this->packageDimensions = $packageDimensions;
        $this->packageWeight = $packageWeight;
    }

    /**
     * Get order items.
     *
     * @return array
     */
    public function getOrderItems(): array
    {
        return $this->orderItems;
    }

    /**
     * Set order items.
     *
     * @param array $orderItems
     */
    public function setOrderItems(array $orderItems): void
    {
        foreach ($orderItems as $item) {
            if (!$item instanceof EasyShipOrderItem) {
                throw new \InvalidArgumentException("Each order item must be an instance of EasyShipOrderItem.");
            }
        }
        $this->orderItems = $orderItems;
    }

    /**
     * Get package dimensions.
     *
     * @return Dimensions|null
     */
    public function getPackageDimensions(): ?Dimensions
    {
        return $this->packageDimensions;
    }

    /**
     * Set package dimensions.
     *
     * @param Dimensions|null $packageDimensions
     */
    public function setPackageDimensions(?Dimensions $packageDimensions): void
    {
        $this->packageDimensions = $packageDimensions;
    }

    /**
     * Get package weight.
     *
     * @return Weight|null
     */
    public function getPackageWeight(): ?Weight
    {
        return $this->packageWeight;
    }

    /**
     * Set package weight.
     *
     * @param Weight|null $packageWeight
     */
    public function setPackageWeight(?Weight $packageWeight): void
    {
        $this->packageWeight = $packageWeight;
    }

    // Implement JsonSerializable
    public function jsonSerialize(): array
    {
        return [
            'orderItems' => $this->orderItems,
            'packageDimensions' => $this->packageDimensions,
            'packageWeight' => $this->packageWeight
        ];
    }
}
