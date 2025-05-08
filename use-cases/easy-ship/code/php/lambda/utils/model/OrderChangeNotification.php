<?php

namespace Lambda\Utils\Model;

use JsonSerializable;
use Lambda\attributes\Property;

class OrderChangeNotification implements JsonSerializable
{
    #[Property("Notification Level")]
    private string $notificationLevel;

    #[Property("Seller ID")]
    private string $sellerId;

    #[Property("Amazon Order ID")]
    private string $amazonOrderId;

    #[Property("Order Change Trigger")]
    private ?OrderChangeReason $orderChangeTrigger = null;

    #[Property("Summary")]
    private ?OrderChangeSummary $summary = null;

    /**
     * OrderChangeNotification constructor.
     *
     * @param string $notificationLevel
     * @param string $sellerId
     * @param string $amazonOrderId
     * @param OrderChangeReason|null $orderChangeTrigger
     * @param OrderChangeSummary|null $summary
     */
    public function __construct(
        string $notificationLevel = '',
        string $sellerId = '',
        string $amazonOrderId = '',
        ?OrderChangeReason $orderChangeTrigger = null,
        ?OrderChangeSummary $summary = null
    ) {
        $this->notificationLevel = $notificationLevel;
        $this->sellerId = $sellerId;
        $this->amazonOrderId = $amazonOrderId;
        $this->orderChangeTrigger = $orderChangeTrigger;
        $this->summary = $summary;
    }

    /**
     * Get notification level.
     *
     * @return string
     */
    public function getNotificationLevel(): string
    {
        return $this->notificationLevel;
    }

    /**
     * Set notification level.
     *
     * @param string $notificationLevel
     */
    public function setNotificationLevel(string $notificationLevel): void
    {
        $this->notificationLevel = $notificationLevel;
    }

    /**
     * Get seller ID.
     *
     * @return string
     */
    public function getSellerId(): string
    {
        return $this->sellerId;
    }

    /**
     * Set seller ID.
     *
     * @param string $sellerId
     */
    public function setSellerId(string $sellerId): void
    {
        $this->sellerId = $sellerId;
    }

    /**
     * Get Amazon order ID.
     *
     * @return string
     */
    public function getAmazonOrderId(): string
    {
        return $this->amazonOrderId;
    }

    /**
     * Set Amazon order ID.
     *
     * @param string $amazonOrderId
     */
    public function setAmazonOrderId(string $amazonOrderId): void
    {
        $this->amazonOrderId = $amazonOrderId;
    }

    /**
     * Get order change trigger.
     *
     * @return OrderChangeReason|null
     */
    public function getOrderChangeTrigger(): ?OrderChangeReason
    {
        return $this->orderChangeTrigger;
    }

    /**
     * Set order change trigger.
     *
     * @param OrderChangeReason|null $orderChangeTrigger
     */
    public function setOrderChangeTrigger(?OrderChangeReason $orderChangeTrigger): void
    {
        $this->orderChangeTrigger = $orderChangeTrigger;
    }

    /**
     * Get summary.
     *
     * @return OrderChangeSummary|null
     */
    public function getSummary(): ?OrderChangeSummary
    {
        return $this->summary;
    }

    /**
     * Set summary.
     *
     * @param OrderChangeSummary|null $summary
     */
    public function setSummary(?OrderChangeSummary $summary): void
    {
        $this->summary = $summary;
    }

    // Implement JsonSerializable
    public function jsonSerialize(): array
    {
        return [
            'NotificationLevel' => $this->notificationLevel,
            'SellerId' => $this->sellerId,
            'AmazonOrderId' => $this->amazonOrderId,
            'OrderChangeTrigger' => $this->orderChangeTrigger,
            'Summary' => $this->summary
        ];
    }
}
