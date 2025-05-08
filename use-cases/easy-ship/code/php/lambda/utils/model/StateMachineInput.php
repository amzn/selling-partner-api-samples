<?php

namespace Lambda\Utils\Model;

use JsonSerializable;
use Lambda\attributes\Property;
use Lambda\Utils\interfaces\ApiCredentialsProvider;
use SpApi\Model\easyship\v2022_03_23\ScheduledPackageId;

class StateMachineInput implements JsonSerializable, ApiCredentialsProvider
{
    #[Property("API Credentials")]
    private ApiCredentials $apiCredentials;

    #[Property("Amazon Order ID")]
    private string $amazonOrderId;

    #[Property("Marketplace ID")]
    private string $marketplaceId;

    #[Property("Seller ID")]
    private string $sellerId;

    #[Property("EasyShip Order Information")]
    private ?EasyShipOrder $easyShipOrder;

    #[Property("EasyShip Hand Over Time Slot")]
    private ?array $timeSlots;

    #[Property("EasyShip Scheduled Package ID")]
    private ?ScheduledPackageId $scheduledPackageId;

    #[Property("Feed ID for Printing Label")]
    private ?string $feedId;

    #[Property("Report ID for Printing Label")]
    private ?string $reportId;

    #[Property("S3 Label URL")]
    private ?string $labelUri;

    /**
     * StateMachineInput constructor.
     *
     * @param ApiCredentials $apiCredentials
     * @param string $amazonOrderId
     * @param string $marketplaceId
     * @param string $sellerId
     * @param EasyShipOrder|null $easyShipOrder
     * @param array|null $timeSlots
     * @param ScheduledPackageId|null $scheduledPackageId
     * @param string|null $feedId
     * @param string|null $reportId
     * @param string|null $labelUri
     */
    public function __construct(
        ApiCredentials $apiCredentials,
        string $amazonOrderId = '',
        string $marketplaceId = '',
        string $sellerId = '',
        ?EasyShipOrder $easyShipOrder = null,
        ?array $timeSlots = null,
        ?ScheduledPackageId $scheduledPackageId = null,
        ?string $feedId = '',
        ?string $reportId = '',
        ?string $labelUri = ''
    ) {
        $this->apiCredentials = $apiCredentials;
        $this->amazonOrderId = $amazonOrderId;
        $this->marketplaceId = $marketplaceId;
        $this->sellerId = $sellerId;
        $this->easyShipOrder = $easyShipOrder;
        $this->timeSlots = $timeSlots;
        $this->scheduledPackageId = $scheduledPackageId;
        $this->feedId = $feedId;
        $this->reportId = $reportId;
        $this->labelUri = $labelUri;
    }

    /**
     * Get API credentials.
     *
     * @return ApiCredentials
     */
    public function getApiCredentials(): ApiCredentials
    {
        return $this->apiCredentials;
    }

    /**
     * Set API credentials.
     *
     * @param ApiCredentials $apiCredentials
     */
    public function setApiCredentials(ApiCredentials $apiCredentials): void
    {
        $this->apiCredentials = $apiCredentials;
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
     * Get marketplace ID.
     *
     * @return string
     */
    public function getMarketplaceId(): string
    {
        return $this->marketplaceId;
    }

    /**
     * Set marketplace ID.
     *
     * @param string $marketplaceId
     */
    public function setMarketplaceId(string $marketplaceId): void
    {
        $this->marketplaceId = $marketplaceId;
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
     * Get EasyShip order.
     *
     * @return EasyShipOrder
     */
    public function getEasyShipOrder(): EasyShipOrder
    {
        return $this->easyShipOrder;
    }

    /**
     * Set EasyShip order.
     *
     * @param EasyShipOrder $easyShipOrder
     */
    public function setEasyShipOrder(EasyShipOrder $easyShipOrder): void
    {
        $this->easyShipOrder = $easyShipOrder;
    }

    /**
     * Get EasyShip time slots.
     *
     * @return array
     */
    public function getTimeSlots(): array
    {
        return $this->timeSlots;
    }

    /**
     * Set EasyShip time slots.
     *
     * @param array $timeSlots
     */
    public function setTimeSlots(array $timeSlots): void
    {
        $this->timeSlots = $timeSlots;
    }

    /**
     * Get scheduled package ID.
     *
     * @return ScheduledPackageId
     */
    public function getScheduledPackageId(): ScheduledPackageId
    {
        return $this->scheduledPackageId;
    }

    /**
     * Set scheduled package ID.
     *
     * @param ScheduledPackageId $scheduledPackageId
     */
    public function setScheduledPackageId(ScheduledPackageId $scheduledPackageId): void
    {
        $this->scheduledPackageId = $scheduledPackageId;
    }

    /**
     * Get feed ID.
     *
     * @return string
     */
    public function getFeedId(): string
    {
        return $this->feedId;
    }

    /**
     * Set feed ID.
     *
     * @param string $feedId
     */
    public function setFeedId(string $feedId): void
    {
        $this->feedId = $feedId;
    }

    /**
     * Get report ID.
     *
     * @return string
     */
    public function getReportId(): string
    {
        return $this->reportId;
    }

    /**
     * Set report ID.
     *
     * @param string $reportId
     */
    public function setReportId(string $reportId): void
    {
        $this->reportId = $reportId;
    }

    /**
     * Get label URI.
     *
     * @return string
     */
    public function getLabelUri(): string
    {
        return $this->labelUri;
    }

    /**
     * Set label URI.
     *
     * @param string $labelUri
     */
    public function setLabelUri(string $labelUri): void
    {
        $this->labelUri = $labelUri;
    }

    // Implement JsonSerializable
    public function jsonSerialize(): array
    {
        return [
            'apiCredentials' => $this->apiCredentials,
            'amazonOrderId' => $this->amazonOrderId,
            'marketplaceId' => $this->marketplaceId,
            'sellerId' => $this->sellerId,
            'easyShipOrder' => $this->easyShipOrder,
            'timeSlots' => $this->timeSlots,
            'scheduledPackageId' => $this->scheduledPackageId,
            'feedId' => $this->feedId,
            'reportId' => $this->reportId,
            'labelUri' => $this->labelUri,
        ];
    }
}
