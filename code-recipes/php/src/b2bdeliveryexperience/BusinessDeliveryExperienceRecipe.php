<?php

namespace Src\b2bdeliveryexperience;

use DateTime;
use Exception;
use SpApi\Api\orders\v0\OrdersV0Api;
use SpApi\Model\orders\v0\Address;
use SpApi\Model\orders\v0\ConfirmShipmentOrderItem;
use SpApi\Model\orders\v0\ConfirmShipmentRequest;
use SpApi\Model\orders\v0\Order;
use SpApi\Model\orders\v0\OrderAddress;
use SpApi\Model\orders\v0\OrderItem;
use SpApi\Model\orders\v0\PackageDetail;
use Src\util\Recipe;

/**
 * Amazon Business Delivery Experience is a seven-step process:
 * - Get order details and check if it's a business order
 * - Retrieve purchase order number for business orders
 * - Get order address and verify it's commercial
 * - Get delivery preferences for the order
 * - Filter carrier options to exclude weekend deliveries
 * - Generate shipping label with PO number
 * - Confirm shipment with selected carrier
 */
class BusinessDeliveryExperienceRecipe extends Recipe
{
    private OrdersV0Api $ordersApi;

    public function __construct()
    {
        parent::__construct();
        $this->ordersApi = new OrdersV0Api($this->config);
    }

    public function start(): void
    {
        $orderId = "123-4567890-1234567"; // Sample order ID
        
        $order = $this->getOrder($orderId);
        
        if ($order->getIsBusinessOrder()) {
            $poNumber = $this->getPurchaseOrderNumber($orderId);
            $orderItems = $this->getOrderItems($orderId);
            $address = $this->getOrderAddress($orderId);
            
            $preferences = $address->getDeliveryPreferences();
            $carriers = $this->getCarrierOptions();
            
            // Filter weekend deliveries only for commercial addresses
             $shipping = $address->getShippingAddress();
        if ($shipping !== null && strcasecmp($shipping->getAddressType(), 'Commercial') === 0) {
            $carriers = $this->filterWeekendDeliveries($carriers);
        }
            
            $selectedCarrier = $this->selectCarrier($carriers);
            $label = $this->generateShippingLabel($orderId, $selectedCarrier, $poNumber);
            $this->confirmShipment($order, $orderItems, $selectedCarrier);
        }
    }

    /**
     * Gets order details - no Restricted Data Token required
     */
    private function getOrder(string $orderId): Order
    {
        try {
            $response = $this->ordersApi->getOrder($orderId);
            return $response->getPayload();
        } catch (Exception $e) {
            throw new Exception("Unsuccessful response from Orders API: " . $e->getMessage(), 0, $e);
        }
    }
 /**
     * Get Purchase Order Number - REQUIRES Restricted Data Token (RDT) for PII access
     * Must obtain RDT before calling this method using createRestrictedDataToken API
     */
    private function getPurchaseOrderNumber(string $orderId): ?string
{
    try {
        $resp = $this->ordersApi->getOrderBuyerInfo($orderId);
        $buyerInfo = $resp->getPayload();
        return $buyerInfo ? $buyerInfo->getPurchaseOrderNumber() : null;
    } catch (Exception $e) {
        throw new Exception("Unsuccessful response from Orders API: " . $e->getMessage(), 0, $e);
    }
}
    /**
     * Gets order items - no Restricted Data Token required
     */
    private function getOrderItems(string $orderId): array
    {
        try {
            $response = $this->ordersApi->getOrderItems($orderId);
            return $response->getPayload()->getOrderItems();
        } catch (Exception $e) {
            throw new Exception("Unsuccessful response from Orders API: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Gets order address - REQUIRES Restricted Data Token (RDT) for PII access
     * Must obtain RDT before calling this method using createRestrictedDataToken API
     */
    private function getOrderAddress(string $orderId): OrderAddress
    {
        try {
            $response = $this->ordersApi->getOrderAddress($orderId);
            return $response->getPayload();
        } catch (Exception $e) {
            throw new Exception("Unsuccessful response from Orders API: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * MOCK METHOD: Gets available carrier options
     * In real implementation, this would integrate with shipping APIs to get actual carrier options
     */
    private function getCarrierOptions(): array
    {
        // Mock carrier options - in real implementation, this would come from shipping API
        return [
            $this->createCarrierOption("UPS", (new DateTime())->modify('+1 day')),
            $this->createCarrierOption("FedEx", (new DateTime())->modify('+2 days')),
            $this->createCarrierOption("DHL", (new DateTime())->modify('+6 days')) // Saturday
        ];
    }

    private function createCarrierOption(string $carrier, DateTime $deliveryDate): CarrierOption
    {
        $option = new CarrierOption();
        $option->setCarrierName($carrier);
        $option->setEstimatedDeliveryDate($deliveryDate->format('Y-m-d'));
        return $option;
    }

    /**
     * MOCK METHOD: Filters out carriers that deliver on weekends
     * In real implementation, this would be part of carrier selection logic
     */
    private function filterWeekendDeliveries(array $carriers): array
    {
        return array_filter($carriers, function(CarrierOption $carrier) {
            $deliveryDate = new DateTime($carrier->getEstimatedDeliveryDate());
            $dayOfWeek = (int)$deliveryDate->format('w'); // 0 = Sunday, 6 = Saturday
            return $dayOfWeek !== 0 && $dayOfWeek !== 6;
        });
    }

    private function selectCarrier(array $carriers): ?CarrierOption
    {
        // Select first available carrier (in real implementation, this would be user choice)
        return empty($carriers) ? null : $carriers[0];
    }
    
    /**
     * MOCK METHOD: Generates shipping label with purchase order number
     * In real implementation, this would integrate with SP-API Shipping API or carrier APIs
     */
    private function generateShippingLabel(string $orderId, ?CarrierOption $carrier, ?string $poNumber): ?ShippingLabel
    {
        if ($carrier === null) {
            echo "No carrier available for label generation\n";
            return null;
        }
        
        // Mock shipping label generation - in real implementation, this would call shipping API
        $label = new ShippingLabel();
        $label->setLabelId("LBL-" . $orderId . "-" . time());
        $label->setCarrierName($carrier->getCarrierName());
        $label->setTrackingNumber("1Z999AA1234567890");
        $label->setLabelFormat("PDF");
        $label->setLabelUrl("https://mock-label-url.com/" . $label->getLabelId() . ".pdf");
        $label->setPurchaseOrderNumber($poNumber);
        
        echo "Shipping label generated: " . $label->getLabelId() . 
             ($poNumber ? " with PO: " . $poNumber : "") . "\n";
        return $label;
    }
    
    private function confirmShipment(Order $order, array $orderItems, ?CarrierOption $carrier): void
    {
        if ($carrier === null) {
            echo "No carrier available for shipment\n";
            return;
        }
        
        try {
            $confirmItems = array_map(function(OrderItem $item) {
                return (new ConfirmShipmentOrderItem())
                    ->setOrderItemId($item->getOrderItemId())
                    ->setQuantity($item->getQuantityOrdered());
            }, $orderItems);
            
            $request = (new ConfirmShipmentRequest())
                ->setMarketplaceId($order->getMarketplaceId())
                ->setPackageDetail((new PackageDetail())
                    ->setPackageReferenceId("PKG001")
                    ->setCarrierCode($carrier->getCarrierName())
                    ->setTrackingNumber("1Z999AA1234567890")
                    ->setOrderItems($confirmItems));
            
            $this->ordersApi->confirmShipment($order->getAmazonOrderId(), $request);
            echo "Shipment confirmed with carrier: " . $carrier->getCarrierName() . "\n";
        } catch (Exception $e) {
            throw new Exception("Failed to confirm shipment: " . $e->getMessage(), 0, $e);
        }
    }
}

// Mock CarrierOption class 
class CarrierOption
{
    private string $carrierName;
    private string $estimatedDeliveryDate;

    public function getCarrierName(): string
    {
        return $this->carrierName;
    }

    public function setCarrierName(string $carrierName): void
    {
        $this->carrierName = $carrierName;
    }

    public function getEstimatedDeliveryDate(): string
    {
        return $this->estimatedDeliveryDate;
    }

    public function setEstimatedDeliveryDate(string $estimatedDeliveryDate): void
    {
        $this->estimatedDeliveryDate = $estimatedDeliveryDate;
    }
}

// Mock ShippingLabel class 
class ShippingLabel
{
    private string $labelId;
    private string $carrierName;
    private string $trackingNumber;
    private string $labelFormat;
    private string $labelUrl;
    private ?string $purchaseOrderNumber;

    public function getLabelId(): string
    {
        return $this->labelId;
    }

    public function setLabelId(string $labelId): void
    {
        $this->labelId = $labelId;
    }

    public function getCarrierName(): string
    {
        return $this->carrierName;
    }

    public function setCarrierName(string $carrierName): void
    {
        $this->carrierName = $carrierName;
    }

    public function getTrackingNumber(): string
    {
        return $this->trackingNumber;
    }

    public function setTrackingNumber(string $trackingNumber): void
    {
        $this->trackingNumber = $trackingNumber;
    }

    public function getLabelFormat(): string
    {
        return $this->labelFormat;
    }

    public function setLabelFormat(string $labelFormat): void
    {
        $this->labelFormat = $labelFormat;
    }

    public function getLabelUrl(): string
    {
        return $this->labelUrl;
    }

    public function setLabelUrl(string $labelUrl): void
    {
        $this->labelUrl = $labelUrl;
    }

    public function getPurchaseOrderNumber(): ?string
    {
        return $this->purchaseOrderNumber;
    }

    public function setPurchaseOrderNumber(?string $purchaseOrderNumber): void
    {
        $this->purchaseOrderNumber = $purchaseOrderNumber;
    }
}etTrackingNumber(string $trackingNumber): void
    {
        $this->trackingNumber = $trackingNumber;
    }

    public function getLabelFormat(): string
    {
        return $this->labelFormat;
    }

    public function setLabelFormat(string $labelFormat): void
    {
        $this->labelFormat = $labelFormat;
    }

    public function getLabelUrl(): string
    {
        return $this->labelUrl;
    }

    public function setLabelUrl(string $labelUrl): void
    {
        $this->labelUrl = $labelUrl;
    }

    public function getPurchaseOrderNumber(): ?string
    {
        return $this->purchaseOrderNumber;
    }

    public function setPurchaseOrderNumber(?string $purchaseOrderNumber): void
    {
        $this->purchaseOrderNumber = $purchaseOrderNumber;
    }
}
