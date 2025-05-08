<?php

namespace Lambda\Utils\Model;

use DateTime;
use DateTimeInterface;
use JsonSerializable;
use Lambda\attributes\Property;

class SPAPINotification implements JsonSerializable
{
    #[Property("Notification Type")]
    private string $notificationType;

    #[Property("Event Published Time")]
    private DateTime $eventTime;

    #[Property("Event Payload")]
    private NotificationPayload $payload;

    /**
     * SPAPINotification constructor.
     *
     * @param string $notificationType
     * @param DateTime|null $eventTime
     * @param NotificationPayload|null $payload
     */
    public function __construct(
        string $notificationType = '',
        ?DateTime $eventTime = null,
        ?NotificationPayload $payload = null
    ) {
        $this->notificationType = $notificationType;
        $this->eventTime = $eventTime ?? new DateTime();
        $this->payload = $payload ?? new NotificationPayload();
    }

    /**
     * Get notification type.
     *
     * @return string
     */
    public function getNotificationType(): string
    {
        return $this->notificationType;
    }

    /**
     * Set notification type.
     *
     * @param string $notificationType
     */
    public function setNotificationType(string $notificationType): void
    {
        $this->notificationType = $notificationType;
    }

    /**
     * Get event time.
     *
     * @return DateTime
     */
    public function getEventTime(): DateTime
    {
        return $this->eventTime;
    }

    /**
     * Set event time.
     *
     * @param DateTime $eventTime
     */
    public function setEventTime(DateTime $eventTime): void
    {
        $this->eventTime = $eventTime;
    }

    /**
     * Get event payload.
     *
     * @return NotificationPayload
     */
    public function getPayload(): NotificationPayload
    {
        return $this->payload;
    }

    /**
     * Set event payload.
     *
     * @param NotificationPayload $payload
     */
    public function setPayload(NotificationPayload $payload): void
    {
        $this->payload = $payload;
    }

    // JsonSerializable implementation
    public function jsonSerialize(): array
    {
        return [
            'NotificationType' => $this->notificationType,
            'EventTime' => $this->eventTime->format(DateTimeInterface::ATOM),
            'Payload' => $this->payload
        ];
    }
}
