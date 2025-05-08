<?php

namespace Lambda\Utils\Model;

use JsonSerializable;
use Lambda\attributes\Property;

class EasyShipOrderItem implements JsonSerializable
{
    #[Property("Order Item ID")]
    private string $orderItemId;

    #[Property("SKU")]
    private string $sku;

    #[Property("Quantity")]
    private int $quantity;

    #[Property("Order Item Serial Number")]
    private array $orderItemSerialNumbers;

    /**
     * EasyShipOrderItem constructor.
     *
     * @param string $orderItemId
     * @param string $sku
     * @param int $quantity
     * @param array $orderItemSerialNumbers
     */
    public function __construct(string $orderItemId = '', string $sku = '', int $quantity = 0, array $orderItemSerialNumbers = [])
    {
        $this->orderItemId = $orderItemId;
        $this->sku = $sku;
        $this->quantity = $quantity;
        $this->orderItemSerialNumbers = $orderItemSerialNumbers;
    }

    /**
     * Get order item ID.
     *
     * @return string
     */
    public function getOrderItemId(): string
    {
        return $this->orderItemId;
    }

    /**
     * Set order item ID.
     *
     * @param string $orderItemId
     */
    public function setOrderItemId(string $orderItemId): void
    {
        $this->orderItemId = $orderItemId;
    }

    /**
     * Get SKU.
     *
     * @return string
     */
    public function getSku(): string
    {
        return $this->sku;
    }

    /**
     * Set SKU.
     *
     * @param string $sku
     */
    public function setSku(string $sku): void
    {
        $this->sku = $sku;
    }

    /**
     * Get quantity.
     *
     * @return int
     */
    public function getQuantity(): int
    {
        return $this->quantity;
    }

    /**
     * Set quantity.
     *
     * @param int $quantity
     */
    public function setQuantity(int $quantity): void
    {
        $this->quantity = $quantity;
    }

    /**
     * Get order item serial numbers.
     *
     * @return array
     */
    public function getOrderItemSerialNumbers(): array
    {
        return $this->orderItemSerialNumbers;
    }

    /**
     * Set order item serial numbers.
     *
     * @param array $orderItemSerialNumbers
     */
    public function setOrderItemSerialNumbers(array $orderItemSerialNumbers): void
    {
        $this->orderItemSerialNumbers = $orderItemSerialNumbers;
    }

    // Implement JsonSerializable
    public function jsonSerialize(): array
    {
        return [
            'orderItemId' => $this->orderItemId,
            'sku' => $this->sku,
            'quantity' => $this->quantity,
            'orderItemSerialNumbers' => $this->orderItemSerialNumbers,
        ];
    }
}
