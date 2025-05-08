<?php

namespace Lambda\Utils\Model;

use JsonSerializable;
use Lambda\attributes\Property;

class OrderChangeSummary implements JsonSerializable
{
    #[Property("Marketplace ID")]
    private string $marketplaceId;

    #[Property("The status of Order")]
    private string $orderStatus;

    #[Property("Fulfillment Type")]
    private string $fulfillmentType;

    /**
     * OrderChangeSummary constructor.
     *
     * @param string $marketplaceId
     * @param string $orderStatus
     * @param string $fulfillmentType
     */
    public function __construct(
        string $marketplaceId = '',
        string $orderStatus = '',
        string $fulfillmentType = ''
    ) {
        $this->marketplaceId = $marketplaceId;
        $this->orderStatus = $orderStatus;
        $this->fulfillmentType = $fulfillmentType;
    }


    /**
     * Get MarketPlace Id.
     *
     * @return string
     */
    public function getMarketplaceId(): string
    {
        return $this->marketplaceId;
    }

    /**
     * Get Order Status.
     *
     * @return string
     */
    public function getOrderStatus(): string
    {
        return $this->orderStatus;
    }
    /**
     * Get Fulfillment Type.
     *
     * @return string
     */
    public function getFulfillmentType(): string
    {
        return $this->fulfillmentType;
    }

    // Implement JsonSerializable
    public function jsonSerialize(): array
    {
        return [
            'MarketplaceID' => $this->marketplaceID,
            'OrderStatus' => $this->orderStatus,
            'FulfillmentType' => $this->fulfillmentType
        ];
    }
}
