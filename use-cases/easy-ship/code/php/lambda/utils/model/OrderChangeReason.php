<?php

namespace Lambda\Utils\Model;

use JsonSerializable;
use Lambda\attributes\Property;

class OrderChangeReason implements JsonSerializable
{
    #[Property("Time Of Order Change")]
    private string $timeOfOrderChange;

    #[Property("Change Reason")]
    private string $changeReason;

    /**
     * OrderChangeReason constructor.
     *
     * @param string $timeOfOrderChange
     * @param string $changeReason
     */
    public function __construct(string $timeOfOrderChange = '', string $changeReason = '')
    {
        $this->timeOfOrderChange = $timeOfOrderChange;
        $this->changeReason = $changeReason;
    }

    /**
     * Get time of order change.
     *
     * @return string
     */
    public function getTimeOfOrderChange(): string
    {
        return $this->timeOfOrderChange;
    }

    /**
     * Set time of order change.
     *
     * @param string $timeOfOrderChange
     */
    public function setTimeOfOrderChange(string $timeOfOrderChange): void
    {
        $this->timeOfOrderChange = $timeOfOrderChange;
    }

    /**
     * Get change reason.
     *
     * @return string
     */
    public function getChangeReason(): string
    {
        return $this->changeReason;
    }

    /**
     * Set change reason.
     *
     * @param string $changeReason
     */
    public function setChangeReason(string $changeReason): void
    {
        $this->changeReason = $changeReason;
    }

    // Implement JsonSerializable
    public function jsonSerialize(): array
    {
        return [
            'TimeOfOrderChange' => $this->timeOfOrderChange,
            'ChangeReason' => $this->changeReason
        ];
    }
}
