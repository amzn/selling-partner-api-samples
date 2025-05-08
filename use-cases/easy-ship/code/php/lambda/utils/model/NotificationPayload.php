<?php

namespace Lambda\Utils\Model;

use JsonSerializable;
use Lambda\attributes\Property;

class NotificationPayload implements JsonSerializable
{
    #[Property("Order Change Notification")]
    private ?OrderChangeNotification $orderChangeNotification;

    /**
     * NotificationPayload constructor.
     *
     * @param OrderChangeNotification|null $orderChangeNotification
     */
    public function __construct(?OrderChangeNotification $orderChangeNotification = null)
    {
        $this->orderChangeNotification = $orderChangeNotification ?? new OrderChangeNotification();
    }

    /**
     * Get order change notification.
     *
     * @return OrderChangeNotification|null
     */
    public function getOrderChangeNotification(): ?OrderChangeNotification
    {
        return $this->orderChangeNotification;
    }

    /**
     * Set order change notification.
     *
     * @param OrderChangeNotification|null $orderChangeNotification
     */
    public function setOrderChangeNotification(?OrderChangeNotification $orderChangeNotification): void
    {
        $this->orderChangeNotification = $orderChangeNotification;
    }

    // Implement JsonSerializable
    public function jsonSerialize(): array
    {
        return [
            'OrderChangeNotification' => $this->orderChangeNotification
        ];
    }
}
